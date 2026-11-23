import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { inspectEditorialArchitecture } from "./tests-editorial-architecture-guard.mjs";
import { inspectTestArchitecture } from "./tests-domain-tests-guard.mjs";
import { inspectModuleIntegrity } from "./tests-module-integrity-guard.mjs";
import { inspectPanelHeavyPreparations } from "./tests-performance-guard.mjs";

const fixture = (t) => {
  const root = mkdtempSync(join(tmpdir(), "eqz-architecture-guard-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, text) => {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  };
  write("src/preparation/shared/editorial/mapping/prepared-editorial.ts",
    "export const resolvePreparedEditorial = () => ({ short: 'genérico' });\n");
  write("src/preparation/prepare-product.ts", "import { resolvePreparedEditorial } from './shared/editorial/mapping/prepared-editorial.js'; export const prepare = () => resolvePreparedEditorial();\n");
  write("src/commercial/projection/presentation-projection.ts",
    "export const project = (published: { description: string; description_general: string }) => ({ description: published.description, description_general: published.description_general });\n");
  write("src/preparation/shared/editorial/domain/editorial-composition.ts", "export const compose = (height: number) => `altura de ${height} m`;\n");
  write("src/preparation/shared/editorial/domain/editorial-source.ts", "export const source = (x: unknown) => x;\n");
  write("src/preparation/gam/editorial/source/domain-source.ts", "export const readSource = (record: { height: string }) => ({ workingHeight: record.height });\n");
  write("src/preparation/shared/editorial/tests/contract.test.ts", "import assert from 'node:assert/strict'; assert.equal(2 + 2, 4);\n");
  write("src/publication/tests/accreditation.test.ts", "const path = 'catalogs/providers/gam/publications/active.json';\n");
  return { root, write };
};

const rules = (findings) => new Set(findings.map((entry) => entry.rule));

test("npm test ejecuta los guards arquitectónicos y sus autopruebas antes del build", () => {
  const { scripts } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const steps = scripts.test.split(" && ");
  const required = [
    "node GUARDS/tests-editorial-architecture-guard.mjs",
    "node GUARDS/tests-domain-tests-guard.mjs",
    "node --test --test-reporter=./scripts/test-runner-ui.mjs GUARDS/tests-architecture-guards.test.mjs"
  ];
  const build = steps.indexOf("node scripts/run-build.mjs --quiet --if-needed");
  assert.ok(build > -1);
  const models = "node scripts/operations/rebuild-editorial-models.mjs --check";
  assert.equal(steps.filter((step) => step === models).length, 1);
  assert.ok(steps.indexOf(models) > build);
  assert.ok(steps.indexOf(models) < steps.indexOf("node scripts/run-tests.mjs"));
  for (const command of required) {
    assert.equal(steps.filter((step) => step === command).length, 1, command);
    assert.ok(steps.indexOf(command) < build, command);
  }
});

test("detecta preparaciones censales repetidas en el panel sin impedir lecturas aisladas legítimas", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const paths = [
    "src/panel/application/tests/dashboard.test.ts",
    "src/panel/explorer/tests/read-panel-explorer.test.ts",
    "src/panel/evidence/read-panel-snapshot.ts",
    "src/panel/explorer/read-panel-explorer.ts",
    "src/panel/application/panel-html.ts",
    "src/tools/catalog/tests/explorer-technical-evidence-cache.test.ts",
    "src/panel/explorer/tests/explorer-selection.test.ts",
    "src/panel/evidence/tests/read-panel-snapshot.test.ts"
  ];
  const sources = new Map(paths.map((path) => [path, readFileSync(join(root, path), "utf8")]));
  assert.deepEqual(inspectPanelHeavyPreparations(sources), []);
  const dashboard = paths[0];
  const original = sources.get(dashboard);
  assert.ok(original);
  const updated = original.replace("const { html } = await readStaticPanel();",
    "const { html } = await readStaticPanel(); await readPanelSnapshot(await fixture.root());");
  assert.notEqual(updated, original);
  const repeated = new Map(sources);
  repeated.set(dashboard, updated);
  assert.ok(inspectPanelHeavyPreparations(repeated).some((finding) => finding.includes("readPanelSnapshot: 2 preparaciones")));
  const duplicatedExplorer = original.replace("const dashboard = createDashboardPayload(snapshot, await readPanelExplorer(workspace, snapshot));",
    "const dashboard = createDashboardPayload(snapshot, await readPanelExplorer(workspace, snapshot)); await readPanelExplorer(workspace, snapshot);");
  assert.notEqual(duplicatedExplorer, original);
  repeated.set(dashboard, duplicatedExplorer);
  assert.ok(inspectPanelHeavyPreparations(repeated).some((finding) => finding.includes("readPanelExplorer: 2 preparaciones")));
  const looped = original.replace("const snapshot = await readPanelSnapshot(workspace);",
    `for (const provider of ["gam"]) await readPanelSnapshot(workspace); const snapshot = await readPanelSnapshot(workspace);`);
  assert.notEqual(looped, original);
  repeated.set(dashboard, looped);
  assert.ok(inspectPanelHeavyPreparations(repeated).some((finding) => finding.includes("fuera de iteraciones")));
  repeated.set(dashboard, original);
  const explorer = paths[1];
  const explorerSource = sources.get(explorer);
  assert.ok(explorerSource);
  const repeatedSnapshot = explorerSource.replace("const { explorer } = await readStaticExplorer();",
    "const { explorer } = await readStaticExplorer(); await readPanelSnapshot(await fixture.root());");
  assert.notEqual(repeatedSnapshot, explorerSource);
  repeated.set(explorer, repeatedSnapshot);
  assert.ok(inspectPanelHeavyPreparations(repeated).some((finding) => finding.includes("readPanelSnapshot: 3 preparaciones")));
  repeated.set(explorer, explorerSource);
  const technicalCache = paths[5];
  const cacheSource = sources.get(technicalCache);
  assert.ok(cacheSource);
  const cacheWithRepeatedSnapshot = cacheSource.replace("const snapshot = await readStaticSnapshot();",
    "const snapshot = await readStaticSnapshot(); await readPanelSnapshot(workspace);");
  assert.notEqual(cacheWithRepeatedSnapshot, cacheSource);
  repeated.set(technicalCache, cacheWithRepeatedSnapshot);
  assert.ok(inspectPanelHeavyPreparations(repeated).some((finding) => finding.includes("readPanelSnapshot: 2 preparaciones")));
  const cacheWithLoop = cacheSource.replace("const snapshot = await readStaticSnapshot();",
    "for (const item of [workspace]) await readPanelSnapshot(item); const snapshot = await readStaticSnapshot();");
  assert.notEqual(cacheWithLoop, cacheSource);
  repeated.set(technicalCache, cacheWithLoop);
  assert.ok(inspectPanelHeavyPreparations(repeated).some((finding) => finding.includes("fuera de iteraciones")));
  repeated.set(technicalCache, cacheSource);
  const selection = paths[6];
  const selectionSource = sources.get(selection);
  assert.ok(selectionSource);
  const uncachedSelection = selectionSource.replace("staticSource ??= prepareSource()", "prepareSource()");
  assert.notEqual(uncachedSelection, selectionSource);
  repeated.set(selection, uncachedSelection);
  assert.ok(inspectPanelHeavyPreparations(repeated).some((finding) => finding.includes("source: preparación costosa repetible")));
  const renamedSelection = selectionSource.replaceAll("staticSource", "memoizedSource");
  assert.notEqual(renamedSelection, selectionSource);
  repeated.set(selection, renamedSelection);
  assert.deepEqual(inspectPanelHeavyPreparations(repeated), []);
  const alternateCache = selectionSource.replace("staticSource ??= prepareSource()", "staticSource ||= prepareSource()");
  assert.notEqual(alternateCache, selectionSource);
  repeated.set(selection, alternateCache);
  assert.deepEqual(inspectPanelHeavyPreparations(repeated), []);
  const repeatedDirectRead = selectionSource.replace("const base = await source();",
    "const base = await source(); await readPanelSnapshot(await fixture.root());");
  assert.notEqual(repeatedDirectRead, selectionSource);
  repeated.set(selection, repeatedDirectRead);
  assert.ok(inspectPanelHeavyPreparations(repeated).some((finding) => finding.includes("readPanelSnapshot: 2 preparaciones")));
  repeated.set(selection, selectionSource);
  const uncachedExplorer = explorerSource.replace("staticExplorer ??= prepareStaticExplorer()", "prepareStaticExplorer()");
  assert.notEqual(uncachedExplorer, explorerSource);
  repeated.set(explorer, uncachedExplorer);
  assert.ok(inspectPanelHeavyPreparations(repeated).some((finding) => finding.includes("readStaticExplorer: preparación costosa repetible")));
  repeated.set(explorer, explorerSource);
  const snapshotTest = paths[7];
  const snapshotSource = sources.get(snapshotTest);
  assert.ok(snapshotSource);
  const uncachedSnapshot = snapshotSource.replace("staticSnapshot ??= fixture.root().then((root) => readPanelSnapshot(root))",
    "fixture.root().then((root) => readPanelSnapshot(root))");
  assert.notEqual(uncachedSnapshot, snapshotSource);
  repeated.set(snapshotTest, uncachedSnapshot);
  assert.ok(inspectPanelHeavyPreparations(repeated).some((finding) => finding.includes("readStaticSnapshot: preparación costosa repetible")));
});

test("el comando comercial invoca el guard protegido desde GUARDS", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const invocation = spawnSync(process.execPath, [join(root, "scripts/tooling.mjs"), "contrato:comercial"], {
    cwd: root, encoding: "utf8"
  });
  assert.equal(invocation.error, undefined);
  assert.equal(invocation.status, 0, `${invocation.stdout}\n${invocation.stderr}`);
  assert.match(invocation.stdout, /Contrato comercial v2 intacto/);
});

test("casos legítimos: el compositor compartido y los contratos controlados no producen infracciones", (t) => {
  const { root } = fixture(t);
  assert.deepEqual(inspectEditorialArchitecture(root).findings, []);
  assert.deepEqual(inspectTestArchitecture(root).findings, []);
});

test("bloquea un nuevo narrador específico conectado al recorrido de preparación", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/gam/editorial/general/new-general.ts", "export const generalForGam = () => 'texto por ficha';\n");
  write("src/preparation/prepare-product.ts", "import { resolvePreparedEditorial } from './shared/editorial/mapping/prepared-editorial.js'; import { generalForGam } from './gam/editorial/general/new-general.js'; export const prepare = () => [resolvePreparedEditorial(), generalForGam()];\n");
  assert.ok(rules(inspectEditorialArchitecture(root).findings).has("E-ACTIVE-PROVIDER-NARRATOR"));
});

test("bloquea bifurcación por proveedor, referencia y composición posterior a preparación", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/shared/editorial/domain/editorial-composition.ts",
    "export const compose = (record: { providerId: string }) => record.providerId === 'gam' ? 'texto GAM' : 'texto general';\n");
  write("src/preparation/shared/editorial/mapping/additional.ts",
    "export const special = (record: { reference: string }) => record.reference === '12345';\n");
  write("src/commercial/projection/presentation-projection.ts",
    "export const project = (published: { description: string; description_general: string }) => ({ description: published.description.trim(), description_general: published.description_general });\n");
  write("src/catalog/editorial/providers/gam/verified-description.ts",
    "export const mutate = (product: { description: string }) => ({ ...product, description: product.description.slice(0, 10) });\n");
  const found = rules(inspectEditorialArchitecture(root).findings);
  for (const rule of ["E-DOMAIN-PROVIDER-BRANCH", "E-HARDCODED-REFERENCE", "E-PROJECTION-REWRITE", "E-POST-PREP-EDITORIAL"]) {
    assert.ok(found.has(rule), rule);
  }
});

test("el mapping no selecciona narraciones específicas por proveedor", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/shared/editorial/mapping/proveedor.ts",
    "export const compose = (record: { providerId: string }) => record.providerId === 'gam' ? 'Descripción inventada para GAM' : 'Descripción inventada para otros';\n");
  assert.ok(rules(inspectEditorialArchitecture(root).findings).has("E-MAPPING-PROVIDER-NARRATIVE"));
  write("src/preparation/shared/editorial/mapping/proveedor.ts",
    "export const compose = (record: { providerId: string }) => { if (record.providerId === 'gam') return 'Descripción creada exclusivamente para GAM'; return 'Descripción creada para otro proveedor'; };\n");
  assert.ok(rules(inspectEditorialArchitecture(root).findings).has("E-MAPPING-PROVIDER-NARRATIVE"));
  write("src/preparation/shared/editorial/mapping/proveedor.ts",
    "export const choose = (record: { providerId: string; title: string }) => record.providerId === 'gam' ? record.title : record.title.trim();\n");
  assert.deepEqual(inspectEditorialArchitecture(root).findings, []);
});

test("las referencias literales indirectas tampoco determinan narración", (t) => {
  const { root, write } = fixture(t);
  const path = "src/preparation/shared/editorial/mapping/especial.ts";
  for (const content of [
    "const reference = record.reference; return reference === 'GAM-123' ? 'especial' : null;",
    "const { reference: id } = record; return ['GAM-123'].includes(id) ? 'especial' : null;",
    "const key = record.reference; const reference = key; const refs = new Set(['GAM-123']); return refs.has(reference) ? 'especial' : null;"
  ]) {
    write(path, `export const special = (record: { reference: string }) => { ${content} };\n`);
    assert.ok(rules(inspectEditorialArchitecture(root).findings).has("E-HARDCODED-REFERENCE"), content);
  }
  write(path,
    "export const same = (source: { reference: string }, prepared: { reference: string }) => source.reference === prepared.reference;\n");
  assert.deepEqual(inspectEditorialArchitecture(root).findings, []);
});

test("la publicación inaccesible desde preparación tampoco puede reescribir editoriales", (t) => {
  const { root, write } = fixture(t);
  const path = "src/publication/unreachable.ts";
  write(path,
    "export const publish = (product: { description: string; description_general: string }) => ({ ...product, description: product.description.trim() });\n");
  assert.ok(rules(inspectEditorialArchitecture(root).findings).has("E-PUBLICATION-REWRITE"));
  write(path,
    "export const publish = (product: { description: string }) => { product['description'] = 'Texto cambiado'; return product; };\n");
  assert.ok(rules(inspectEditorialArchitecture(root).findings).has("E-PUBLICATION-MUTATION"));
  write(path,
    "export const publish = (product: { description: string; description_general: string }) => ({ description: product.description, description_general: product.description_general });\n");
  assert.deepEqual(inspectEditorialArchitecture(root).findings, []);
});

test("el guard detecta narradores de proveedores nuevos, pero admite adaptadores de hechos", (t) => {
  const { root, write } = fixture(t);
  const adaptor = "src/preparation/nuevo/editorial/source/domain-source.ts";
  write(adaptor,
    "export const readSource = (record: { height: string }) => ({ workingHeight: record.height });\n");
  write("src/preparation/prepare-product.ts",
    "import { resolvePreparedEditorial } from './shared/editorial/mapping/prepared-editorial.js'; import { readSource } from './nuevo/editorial/source/domain-source.js'; export const prepare = () => [resolvePreparedEditorial(), readSource];\n");
  assert.deepEqual(inspectEditorialArchitecture(root).findings, []);
  write("src/preparation/nuevo/editorial/general/new-general.ts",
    "export const generalForNuevo = () => 'Un texto exclusivo del proveedor nuevo';\n");
  write("src/preparation/prepare-product.ts",
    "import { resolvePreparedEditorial } from './shared/editorial/mapping/prepared-editorial.js'; import { generalForNuevo } from './nuevo/editorial/general/new-general.js'; export const prepare = () => [resolvePreparedEditorial(), generalForNuevo()];\n");
  assert.ok(rules(inspectEditorialArchitecture(root).findings).has("E-ACTIVE-PROVIDER-NARRATOR"));
  write("src/preparation/prepare-product.ts",
    "import { resolvePreparedEditorial } from './shared/editorial/mapping/prepared-editorial.js'; import { readSource } from './nuevo/editorial/source/domain-source.js'; export const prepare = () => [resolvePreparedEditorial(), readSource()];\n");
  write(adaptor,
    "export const readSource = () => ({ description: 'Descripción inventada para el proveedor nuevo' });\n");
  assert.ok(rules(inspectEditorialArchitecture(root).findings).has("E-PROVIDER-COMPOSITION"));
});

test("identifica un narrador histórico no conectado sin confundirlo con el compositor operativo", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/gomariz/editorial/mapping/legacy.ts", "export const resolveIndividualGeneral = () => 'legado';\n");
  assert.ok(rules(inspectEditorialArchitecture(root).findings).has("E-LEGACY-NARRATOR"));
});

test("detecta carga directa del JSON productivo en un test de dominio", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/shared/editorial/tests/contract.test.ts",
    "import { readFileSync } from 'node:fs'; const catalog = JSON.parse(readFileSync('catalogs/providers/gam/original/scrape-gam-catalog.json', 'utf8'));\n");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-PRODUCT-CATALOG"));
});

test("detecta la lectura transitiva a través de un builder con join de segmentos", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/builders/source-fixture.ts",
    "import { join } from 'node:path'; export const load = () => join('catalogs', 'providers', 'mercaeleva', 'original');\n");
  write("src/preparation/shared/editorial/tests/contract.test.ts",
    "import { load } from '../../../../testing/builders/source-fixture.js'; export const location = load();\n");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-TRANSITIVE-CATALOG"));
});

test("los recuentos de fixtures controladas no se confunden con fotografías de catálogo", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/shared/editorial/tests/contract.test.ts",
    "import assert from 'node:assert/strict'; const catalog = { products: [1, 2] }; assert.equal(catalog.products.length, 2);\n");
  assert.deepEqual(inspectTestArchitecture(root).findings, []);
});

test("detecta la cantidad fija cuando una suite depende del catálogo productivo", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/shared/editorial/tests/contract.test.ts",
    "import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs'; const catalog = JSON.parse(readFileSync('catalogs/providers/gam/original/scrape-gam-catalog.json', 'utf8')); assert.equal(catalog.products.length, 1234);\n");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-FIXED-COHORT"));
});

test("dos nuevas lecturas idénticas dentro de la misma suite se cuentan por separado", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/shared/editorial/tests/contract.test.ts",
    "import { readFileSync } from 'node:fs'; const a = readFileSync('catalogs/providers/gam/original/scrape-gam-catalog.json', 'utf8'); const b = readFileSync('catalogs/providers/gam/original/scrape-gam-catalog.json', 'utf8');\n");
  const matches = inspectTestArchitecture(root).findings.filter((finding) => finding.rule === "T-PRODUCT-CATALOG");
  assert.equal(matches.length, 2);
  assert.notEqual(matches[0]?.id, matches[1]?.id);
});

test("adaptadores que interpretan datos y curadores de imágenes no son narradores", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/gam/editorial/source/domain-source.ts",
    "export const readSource = (record: { providerId: string; height: string }) => record.providerId === 'gam' ? { workingHeight: record.height } : null;\n");
  write("src/catalog/editorial/providers/gam/verified-gallery.ts",
    "export const curate = (product: { image: string }) => ({ ...product, image: product.image.trim() });\n");
  assert.deepEqual(inspectEditorialArchitecture(root).findings, []);
});

test("sin baseline: una infracción existente sigue fallando aunque se use --audit", async (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/gam/editorial/general/legacy.ts", "export const resolveGamGeneralDescription = () => 'narrador antiguo';\n");
  const { optionsFrom, present } = await import("./guards-architecture-core.mjs");
  const findings = inspectEditorialArchitecture(root).findings;
  assert.ok(findings.length > 0);
  const output = [];
  t.mock.method(console, "log", (message) => output.push(message));
  assert.equal(present("PRUEBA", findings, optionsFrom(["--root", root, "--audit"])).exitCode, 1);
  assert.equal(present("PRUEBA", findings, optionsFrom(["--root", root, "--strict"])).exitCode, 1);
  assert.equal(present("PRUEBA", [], optionsFrom(["--root", root])).exitCode, 0);
  const statuses = output.map((message) => message.replace(/\u001b\[[0-9;]*m/gu, ""));
  assert.equal(statuses.filter((message) => message.startsWith("FAIL | PRUEBA")).length, 2);
  assert.ok(output.some((message) => message.includes("E-LEGACY-NARRATOR")));
  assert.ok(statuses.some((message) => message.startsWith("PASS | PRUEBA")));
});

test("la identidad comercial no se clasifica como recomposición editorial", (t) => {
  const { root, write } = fixture(t);
  write("src/commercial/projection/presentation-projection.ts",
    "const commercialToken = (v: string) => v.toLowerCase(); export const project = (published: { title: string; description: string; description_general: string }) => ({ description: published.description, description_general: published.description_general, keywords: [commercialToken(published.title)] });\n");
  assert.deepEqual(inspectEditorialArchitecture(root).findings, []);
});

test("también cubre pruebas técnicas de dominio fuera del árbol editorial", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/gam/technical/models/tests/technical-rules.test.ts",
    "import { readFileSync } from 'node:fs'; const original = readFileSync('catalogs/providers/gam/original/scrape-gam-catalog.json', 'utf8');\n");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-PRODUCT-CATALOG"));
});

test("las pruebas de integridad de publicaciones pueden utilizar históricos para verificar su contrato", (t) => {
  const { root, write } = fixture(t);
  write("src/infrastructure/filesystem/catalog/tests/accredited-publication-original.test.ts",
    "import { readFileSync } from 'node:fs'; const historical = readFileSync('catalogs/providers/gomariz/publications/active.json', 'utf8');\n");
  assert.deepEqual(inspectTestArchitecture(root).findings, []);
});

test("una suite de dominio con fixture histórica importada no pasa por usar un alias", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/shared/editorial/tests/contract.test.ts",
    "import { readFileSync } from 'node:fs'; const old = readFileSync('src/testing/fixtures/gomariz/regression-143/scrape-gomariz-catalog.json', 'utf8');\n");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-PRODUCT-CATALOG"));
});

test("identifica hashes literales de salidas editoriales atadas a catálogo, pero no hashes de integridad aislados", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/shared/editorial/tests/contract.test.ts",
    "import assert from 'node:assert/strict'; import { createHash } from 'node:crypto'; import { readFileSync } from 'node:fs'; const catalog = JSON.parse(readFileSync('catalogs/providers/gam/original/scrape-gam-catalog.json', 'utf8')); const hash = createHash('sha256').update(catalog.products[0].description_general).digest('hex'); assert.equal(hash, 'abc');\n");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-FROZEN-EDITORIAL-HASH"));
});

test("ningún recuento del catálogo vivo conserva una excepción por nombre de prueba", (t) => {
  const { root, write } = fixture(t);
  const path = "src/catalog/normalization/gam/tests/gallery.test.ts";
  write(path,
    "import assert from 'node:assert/strict'; import test from 'node:test'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const source = readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json'); test('GAM: conserva las vistas del baño unitario y excluye la portada del módulo doble', () => { const original = { length: 7 }; assert.equal(original.length, 7); });");
  const result = inspectTestArchitecture(root);
  assert.ok(rules(result.findings).has("T-FIXED-COHORT"));
  assert.equal(result.exceptions.filter((item) => item.rule === "T-FIXED-COHORT").length, 0);
});

test("las suites GAM desacopladas no pueden volver a un catálogo operativo mediante su helper", (t) => {
  const { root, write } = fixture(t);
  const helper = "src/testing/domain-cases/accredited-source-samples.ts";
  const path = "src/preparation/gam/quality/tests/gam-verified-operational-safety.test.ts";
  write(helper,
    "import { readFileSync } from 'node:fs'; export const accreditedGamRegressionSource = () => JSON.parse(readFileSync('src/testing/domain-cases/data/gam-original.json', 'utf8')); ");
  write(path,
    "import { accreditedGamRegressionSource } from '../../../../testing/domain-cases/accredited-source-samples.js'; const records = accreditedGamRegressionSource(); export const total = records.length;");
  assert.deepEqual(inspectTestArchitecture(root).findings, []);
  write(helper,
    "import { readCanonicalCatalog } from '../../infrastructure/filesystem/catalog/canonical-catalog.js'; export const accreditedGamRegressionSource = () => readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json');");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-TRANSITIVE-CATALOG"));
});

test("la excepción de fixture transitiva no cubre fuentes o consumidores nuevos", (t) => {
  const { root, write } = fixture(t);
  const path = "src/preparation/gam/classification/tests/gam-verified-category-equivalences.test.ts";
  const fixturePath = "src/preparation/gam/technical/tests/support/gam-source-category-fixture.ts";
  const accreditedFixture = readFileSync(new URL("../src/preparation/gam/technical/tests/support/gam-source-category-fixture.ts", import.meta.url), "utf8");
  write(fixturePath, accreditedFixture);
  write(path,
    "import { load } from '../../technical/tests/support/gam-source-category-fixture.js'; export const source = load; ");
  const accredited = inspectTestArchitecture(root);
  assert.equal(accredited.findings.filter((finding) => finding.rule === "T-TRANSITIVE-CATALOG").length, 0);
  assert.equal(accredited.exceptions.filter((item) => item.rule === "T-TRANSITIVE-CATALOG").length, 1);
  write(fixturePath, accreditedFixture + "\nexport const extra = 1;");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-TRANSITIVE-CATALOG"));
  write(fixturePath, accreditedFixture + " export const extra = readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json');");
  assert.equal(inspectTestArchitecture(root).findings.filter((finding) => finding.rule === "T-TRANSITIVE-CATALOG").length, 1);
  write(fixturePath, accreditedFixture);
  write("src/testing/builders/alternative-catalog-fixture.ts",
    "export const source = 'catalogs/providers/gam/original/scrape-gam-catalog.json';");
  write(path,
    "import { load } from '../../technical/tests/support/gam-source-category-fixture.js'; import { source } from '../../../../testing/builders/alternative-catalog-fixture.js'; export const both = [load, source];");
  assert.equal(inspectTestArchitecture(root).findings.filter((finding) => finding.rule === "T-TRANSITIVE-CATALOG").length, 1);
});

test("el builder histórico Mercaeleva no puede volver a consumir originales vivos", (t) => {
  const { root, write } = fixture(t);
  const helper = "src/testing/builders/mercaeleva-source-fixture.ts";
  const path = "src/preparation/mercaeleva/technical/tests/specifications/mercaeleva-documented-platform-technical-specs.test.ts";
  const source = readFileSync(new URL("../src/testing/builders/mercaeleva-source-fixture.ts", import.meta.url), "utf8");
  write(helper, source);
  write(path, "import { readMercaelevaSource } from '../../../../../testing/builders/mercaeleva-source-fixture.js'; export const load = readMercaelevaSource;");
  const accredited = inspectTestArchitecture(root);
  assert.equal(accredited.exceptions.filter((item) => item.rule === "T-TRANSITIVE-CATALOG").length, 1);
  assert.ok(!rules(accredited.findings).has("T-TRANSITIVE-CATALOG"));
  write(helper, source + "\nexport const extra = 1;");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-TRANSITIVE-CATALOG"));
  write(helper, source.replace("src/testing/fixtures/mercaeleva/regression-221/mercaeleva-completa-20261029-234332-catalog.json", "catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json"));
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-TRANSITIVE-CATALOG"));
  write(helper, source + " export const extra = readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json');");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-TRANSITIVE-CATALOG"));
});

test("el hash de procedencia se conserva aunque la suite inspeccione descripciones", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/tests/catalog-publication-consistency.test.ts",
    "import assert from 'node:assert/strict'; import { createHash } from 'node:crypto'; import { readFileSync } from 'node:fs'; const original = readFileSync('catalogs/providers/gam/original/scrape-gam-catalog.json'); const description_general = 'verificación editorial'; const source = { catalogSha256: 'hash registrado' }; assert.equal(createHash('sha256').update(original).digest('hex'), source.catalogSha256);");
  const result = inspectTestArchitecture(root);
  assert.ok(rules(result.findings).has("T-PRODUCT-CATALOG"));
  assert.ok(!rules(result.findings).has("T-FROZEN-EDITORIAL-HASH"));
});

test("detecta reescritura editorial en una asignación posterior a preparación", (t) => {
  const { root, write } = fixture(t);
  write("src/catalog/editorial/providers/gam/rewrite.ts",
    "export const rewrite = (product: { description: string }) => { product.description = 'descripción concreta'; return product; };\n");
  assert.ok(rules(inspectEditorialArchitecture(root).findings).has("E-POST-PREP-EDITORIAL-ASSIGNMENT"));
});

test("un baseline antiguo no autoriza ninguna infracción aunque siga en la raíz", async (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/gomariz/editorial/mapping/legacy.ts", "export const resolveIndividualGeneral = () => 'legado';\n");
  const findings = inspectEditorialArchitecture(root).findings;
  assert.equal(findings.length, 1);
  write("guards-architecture-baseline-legacy.json", JSON.stringify({ version: 1, editorial: [{ id: findings[0].id }], tests: [] }));
  const { optionsFrom, present } = await import("./guards-architecture-core.mjs");
  const output = [];
  t.mock.method(console, "log", (message) => output.push(message));
  assert.equal(present("PRUEBA", findings, optionsFrom(["--root", root])).exitCode, 1);
  assert.ok(output.some((message) => message.includes("E-LEGACY-NARRATOR")));
});

test("un test de integración de publicación no se penaliza por usar manifiestos inmutables", (t) => {
  const { root, write } = fixture(t);
  write("src/infrastructure/filesystem/catalog/tests/publication-verify.test.ts",
    "import { readFileSync } from 'node:fs'; const data = readFileSync('catalogs/providers/gam/publications/active.json', 'utf8');\n");
  write("src/preparation/shared/editorial/tests/contract.test.ts",
    "import assert from 'node:assert/strict'; const controlled = { reference: 'prueba', height: 12 }; assert.equal(controlled.height, 12);\n");
  assert.deepEqual(inspectTestArchitecture(root).findings, []);
});

const guardedRepositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const accreditedCatalogIntegrationPaths = [
  "src/catalog/normalization/gam/tests/gallery.test.ts",
  "src/preparation/gam/identity/tests/gam-identity-variants.test.ts",
  "src/preparation/shared/quality/tests/source-semantic-quality.test.ts",
  "src/preparation/tests/catalog-publication-consistency.test.ts"
];

test("las lecturas protegidas son contratos de integración exactos y no infracciones", (t) => {
  const { root, write } = fixture(t);
  for (const path of accreditedCatalogIntegrationPaths) {
    write(path, readFileSync(join(guardedRepositoryRoot, path), "utf8"));
  }
  const result = inspectTestArchitecture(root);
  assert.deepEqual(result.findings, []);
  assert.equal(result.integrations.length, 6);
  assert.equal(new Set(result.integrations.map((item) => item.path)).size, 4);
});

test("la acreditación exacta se revoca ante cualquier cambio y no acepta nuevas lecturas", (t) => {
  const { root, write } = fixture(t);
  const path = "src/catalog/normalization/gam/tests/gallery.test.ts";
  const original = readFileSync(join(guardedRepositoryRoot, path), "utf8");
  write(path, original);
  assert.equal(inspectTestArchitecture(root).integrations.length, 1);
  write(path, original + "\nconst regression = 42;\n");
  assert.equal(inspectTestArchitecture(root).findings.filter((item) => item.rule === "T-PRODUCT-CATALOG").length, 1);
  write(path, original + "\nconst extra = 'catalogs/providers/gomariz/original/other.json';\n");
  assert.ok(inspectTestArchitecture(root).findings.filter((item) => item.rule === "T-PRODUCT-CATALOG").length >= 2);
  write(path, original);
  write("src/preparation/shared/editorial/tests/new-catalog.test.ts", original);
  assert.equal(inspectTestArchitecture(root).integrations.length, 1);
  assert.ok(inspectTestArchitecture(root).findings.some((item) => item.path === "src/preparation/shared/editorial/tests/new-catalog.test.ts"));
});

const linkModules = (write, from, to) => {
  const location = posix.relative(posix.dirname(from), to).replace(/\.ts$/u, ".js");
  const specifier = location.startsWith(".") ? location : `./${location}`;
  write(to, "export const value = 1;\n");
  write(from, `import { value } from '${specifier}'; export const result = value;\n`);
};

test("el guard productivo respeta dependencias normales e imports desde tests", (t) => {
  const { root, write } = fixture(t);
  linkModules(write, "src/cli/commands/catalog/entry.ts", "src/commercial/projection/read-model.ts");
  linkModules(write, "src/preparation/gam/technical/source.ts", "src/preparation/shared/technical/domain/measurements.ts");
  linkModules(write, "src/preparation/gam/technical/tests/support/fixture.ts", "src/testing/builders/shared-fixture.ts");
  assert.deepEqual(inspectModuleIntegrity(root).missing, []);
  assert.deepEqual(inspectModuleIntegrity(root).boundaries, []);
});

test("la presentación operativa no importa orquestadores, pero conserva contratos de lectura", (t) => {
  const { root, write } = fixture(t);
  linkModules(write, "src/cli/reporting/operation-progress.ts", "src/cli/reporting/live-status.ts");
  linkModules(write, "src/cli/reporting/commercial-report.ts", "src/commercial/diagnostics/report-summary.ts");
  assert.deepEqual(inspectModuleIntegrity(root).boundaries, []);
  linkModules(write, "src/cli/reporting/operation-progress.ts", "src/cli/commands/catalog/publish-individual.ts");
  const { boundaries } = inspectModuleIntegrity(root);
  assert.equal(boundaries.length, 1);
  assert.match(boundaries[0] ?? "", /presentación de terminal no debe depender de orquestadores CLI/u);
});

test("prohíbe que el dominio dependa de CLI, herramientas o fixtures de tests", (t) => {
  const { root, write } = fixture(t);
  linkModules(write, "src/catalog/diagnostics/gaps.ts", "src/cli/reporting/output.ts");
  linkModules(write, "src/publication/finish.ts", "src/tools/catalog/report.ts");
  linkModules(write, "src/preparation/shared/editorial/domain/title.ts", "src/testing/builders/fixture.ts");
  const { boundaries } = inspectModuleIntegrity(root);
  assert.equal(boundaries.length, 3);
  assert.ok(boundaries.every((entry) => entry.includes("no debe depender de CLI")));
});

test("detecta importaciones de módulos de pruebas desde producción", (t) => {
  const { root, write } = fixture(t);
  linkModules(write, "src/catalog/diagnostics/gaps.ts", "src/catalog/diagnostics/tests/helper.ts");
  assert.match(inspectModuleIntegrity(root).boundaries[0] ?? "", /módulos de pruebas/u);
});

test("los proveedores de preparación y scraping no pueden depender de otro proveedor", (t) => {
  const { root, write } = fixture(t);
  linkModules(write, "src/preparation/gam/technical/read.ts", "src/preparation/gomariz/technical/rules.ts");
  linkModules(write, "src/scraping/providers/manain/adapter.ts", "src/scraping/providers/mercaeleva/adapter.ts");
  const { boundaries } = inspectModuleIntegrity(root);
  assert.equal(boundaries.length, 2);
  assert.ok(boundaries.some((entry) => entry.includes("proveedores de preparación")));
  assert.ok(boundaries.some((entry) => entry.includes("adaptadores de extracción")));
});

test("bloquea lógica comercial dentro del motor técnico compartido y de extracción", (t) => {
  const { root, write } = fixture(t);
  linkModules(write, "src/preparation/shared/technical/domain/source.ts", "src/commercial/validation/commercial-check.ts");
  linkModules(write, "src/commercial/projection/prepare.ts", "src/scraping/registry.ts");
  linkModules(write, "src/scraping/workflow/run.ts", "src/commercial/export/exporter.ts");
  const { boundaries } = inspectModuleIntegrity(root);
  assert.equal(boundaries.length, 3);
  assert.ok(boundaries.some((entry) => entry.includes("motor técnico compartido")));
  assert.ok(boundaries.some((entry) => entry.includes("proyección comercial")));
  assert.ok(boundaries.some((entry) => entry.includes("La extracción")));
});

test("rechaza carpetas de arquitectura retirada y conserva la detección de imports ausentes", (t) => {
  const { root, write } = fixture(t);
  write("src/pipeline/run.ts", "export const run = true;\n");
  write("src/catalog/preparation/old.ts", "export const old = true;\n");
  write("src/catalog/normalization/broken.ts", "import { missing } from './missing.js';\n");
  const { missing, boundaries } = inspectModuleIntegrity(root);
  assert.equal(boundaries.length, 2);
  assert.match(boundaries.join("\n"), /src\/pipeline/u);
  assert.match(boundaries.join("\n"), /src\/catalog\/preparation/u);
  assert.equal(missing.length, 1);
  assert.match(missing[0], /missing\.js/u);
});

test("inspecciona imports dinámicos, require y archivos MTS sin confundir texto literal", (t) => {
  const { root, write } = fixture(t);
  write("src/cli/reporting/colour.mts", "export const value = 1;\n");
  write("src/preparation/shared/technical/loader.mts",
    "export const load = () => import('../../../cli/reporting/colour.mjs');\n");
  write("src/testing/builders/samples.ts", "export const value = 1;\n");
  write("src/catalog/normalization/clean.ts",
    "const fixture = require('../../testing/builders/samples.js'); const text = \"import '../../cli/missing.js'\"; export { fixture, text };\n");
  const { missing, boundaries } = inspectModuleIntegrity(root);
  assert.deepEqual(missing, []);
  assert.equal(boundaries.length, 2);
  assert.ok(boundaries.some((entry) => entry.includes("loader.mts")));
  assert.ok(boundaries.some((entry) => entry.includes("clean.ts")));
});

test("admite suites locales, integraciones acreditadas y builders sin infraestructura adicional", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/builders/source-fixture.ts", "export const source = { reference: 'fixture' };\n");
  write("src/testing/builders/tests/source-fixture.test.ts", "import { source } from '../source-fixture.js'; export const value = source.reference;\n");
  write("src/testing/integration/preparation/tests/source-integration.test.ts", "import { source } from '../../../builders/source-fixture.js'; export const value = source.reference;\n");
  write("src/preparation/gam/technical/energy/gam-source.test.ts", "export const valid = true;\n");
  write("src/preparation/testing/mapping-fixtures.ts", "export const original = 1;\n");
  assert.deepEqual(inspectTestArchitecture(root).findings, []);
});

test("rechaza suites fuera de tests y de las ubicaciones de integración autorizadas", (t) => {
  const { root, write } = fixture(t);
  write("src/catalog/diagnostics/unlocated.test.ts", "export const result = true;\n");
  write("src/testing/builders/misplaced.test.ts", "export const result = true;\n");
  write("src/testing/fixtures/fixture.test.ts", "export const result = true;\n");
  assert.equal(inspectTestArchitecture(root).findings.filter((item) => item.rule === "T-TEST-LOCATION").length, 3);
});

test("protege las cuatro áreas compartidas de testing incluso frente a carpetas de datos", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/temporary/results.json", "{}\n");
  const findings = inspectTestArchitecture(root).findings;
  assert.ok(findings.some((item) => item.rule === "T-TESTING-ROOT" && item.path === "src/testing/temporary"));
});

test("impide helpers dentro de integration y áreas de integración ajenas a la arquitectura", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/integration/preparation/gam/helpers.ts", "export const fixture = true;\n");
  write("src/testing/integration/temporary/tests/adhoc.test.ts", "export const valid = true;\n");
  write("src/testing/integration/preparation/data/sample.json", "{}\n");
  const findings = inspectTestArchitecture(root).findings;
  assert.equal(findings.filter((item) => item.rule === "T-INTEGRATION-SUPPORT").length, 2);
  const found = rules(findings);
  assert.ok(found.has("T-INTEGRATION-AREA"));
});

test("no permite nuevos árboles testing paralelos ni ampliar los helpers históricos de preparación", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/testing/new-fixture.ts", "export const fixture = 1;\n");
  write("src/catalog/testing/parallel-fixture.ts", "export const fixture = 2;\n");
  const findings = inspectTestArchitecture(root).findings.filter((item) => item.rule === "T-PARALLEL-TEST-SUPPORT");
  assert.equal(findings.length, 2);
});

test("impide reutilizar suites como helpers aunque los imports se resuelvan con extensiones JS", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/shared/editorial/tests/other.test.ts", "export const sample = 1;\n");
  write("src/preparation/shared/editorial/tests/contract.test.ts",
    "import { sample } from './other.test.js'; export const other = sample;\n");
  write("src/testing/builders/reused.ts",
    "export { sample } from '../../preparation/shared/editorial/tests/other.test.js';\n");
  const findings = inspectTestArchitecture(root).findings.filter((item) => item.rule === "T-TEST-AS-HELPER");
  assert.equal(findings.length, 2);
});

test("bloquea un runner duplicado y la orquestación de procesos desde builders", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/builders/test-runner.ts", "export const start = () => true;\n");
  write("src/testing/builders/process-fixture.ts",
    "import { spawn } from 'node:child_process'; export const start = spawn;\n");
  const findings = inspectTestArchitecture(root).findings.filter((item) => item.rule === "T-PARALLEL-TEST-RUNNER");
  assert.equal(findings.length, 2);
});

test("rechaza nombres de suites que el runner no descubre en src", (t) => {
  const { root, write } = fixture(t);
  write("src/catalog/diagnostics/tests/not-discovered.spec.ts", "export const valid = true;\n");
  write("src/preparation/shared/editorial/tests/not-discovered.test.mts", "export const valid = true;\n");
  assert.equal(inspectTestArchitecture(root).findings.filter((item) => item.rule === "T-TEST-DISCOVERY").length, 2);
});

test("detecta recuentos fijos del catálogo operativo desde integración y scripts", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/integration/preparation/tests/live-count.test.ts",
    "import assert from 'node:assert/strict'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const gam = await readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json'); assert.equal(gam.products.length, 976);\n");
  write("scripts/inspection/tests/live-count.test.mjs",
    "import assert from 'node:assert/strict'; import { readCanonicalCatalog } from '../../../src/infrastructure/filesystem/catalog/canonical-catalog.js'; const gam = await readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json'); assert.equal(gam.products.length, 976);\n");
  const result = inspectTestArchitecture(root);
  assert.equal(result.findings.filter((item) => item.rule === "T-FIXED-COHORT").length, 2);
});

test("impide leer la fuente viva de Manain en un test de dominio", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/manain/editorial/tests/live-record.test.ts",
    "import assert from 'node:assert/strict'; import { readVerifiedManainRecordSource } from '../../../../infrastructure/filesystem/catalog/manain-record-source.js'; const records = (await readVerifiedManainRecordSource(process.cwd())).originalProducts; assert.equal(records.length, 384);\n");
  const found = rules(inspectTestArchitecture(root).findings);
  assert.ok(found.has("T-PRODUCT-CATALOG"));
  assert.ok(found.has("T-FIXED-COHORT"));
});

test("impide que un helper de catálogo vivo esconda recuentos a consumidores nuevos", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/builders/live-catalog-fixture.ts",
    "import { readCanonicalCatalog } from '../../infrastructure/filesystem/catalog/canonical-catalog.js'; export const load = () => readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json');\n");
  write("src/testing/integration/catalog/tests/live-helper.test.ts",
    "import assert from 'node:assert/strict'; import { load } from '../../../builders/live-catalog-fixture.js'; const gam = await load(); assert.equal(gam.products.length, 983);\n");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-FIXED-COHORT"));
});

test("prohíbe congelar indicadores de procedencia y categorías en un corte vivo", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/workflow/tests/live-source.test.ts",
    "import assert from 'node:assert/strict'; import { readVerifiedManainRecordSource } from '../../../infrastructure/filesystem/catalog/manain-record-source.js'; const records = await readVerifiedManainRecordSource(process.cwd()); assert.equal(records.snapshot.source.discoveredProductUrls, 387); assert.equal(records.snapshot.totals.pendingCategory, 1);\n");
  assert.equal(inspectTestArchitecture(root).findings.filter((item) => item.rule === "T-FIXED-STOCK-FIELD").length, 2);
});

test("no confunde poblaciones sintéticas o históricas con inventario vivo", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/shared/editorial/tests/stable-cases.test.ts",
    "import assert from 'node:assert/strict'; const products = [{reference:'A'}, {reference:'B'}]; assert.equal(products.length, 2);\n");
  write("src/testing/integration/catalog/tests/fixed-history.test.ts",
    "import assert from 'node:assert/strict'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const snapshot = await readCanonicalCatalog('src/testing/fixtures/gam/regression-2026/catalog.json'); assert.equal(snapshot.products.length, 143);\n");
  write("src/testing/integration/preparation/tests/dynamic-live.test.ts",
    "import assert from 'node:assert/strict'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const catalog = await readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json'); const prepared = catalog.products.map(item => item.reference); assert.equal(prepared.length, catalog.products.length);\n");
  assert.deepEqual(inspectTestArchitecture(root).findings, []);
});

test("prohíbe exigir referencias concretas desde el inventario vivo", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/integration/preparation/tests/pinned-live.test.ts",
    "import assert from 'node:assert/strict'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const records = (await readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json')).products; assert.ok(records.find(record => record.reference === 'MAN1188'));\n");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-FIXED-REFERENCE"));
});

test("prohíbe listas de referencias obligatorias en la exportación de stock vivo", (t) => {
  const { root, write } = fixture(t);
  write("src/commercial/legacy-export/tests/pinned-catalog.test.ts",
    "import assert from 'node:assert/strict'; import { readCanonicalCatalog } from '../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const catalog = await readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json'); assert.deepEqual(catalog.products.map(item => item.reference), ['MAN169', 'MAN671']);\n");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-FIXED-REFERENCE"));
});


test("impide recuentos de catálogo vivo ocultos en constantes", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/integration/catalog/tests/constant-count.test.ts",
    "import assert from 'node:assert/strict'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const original = await readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json'); const total = 976; assert.equal(original.products.length, total);\n");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-FIXED-COHORT"));
});

test("impide congelar indicadores de stock vivo mediante constantes", (t) => {
  const { root, write } = fixture(t);
  write("src/preparation/workflow/tests/fixed-fields.test.ts",
    "import assert from 'node:assert/strict'; import { readVerifiedManainRecordSource } from '../../../infrastructure/filesystem/catalog/manain-record-source.js'; const source = await readVerifiedManainRecordSource(process.cwd()); const fixed = 387; assert.equal(source.snapshot.source.discoveredProductUrls, fixed);\n");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-FIXED-STOCK-FIELD"));
});

test("impide referencias obligatorias escondidas tras variables de selección", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/integration/catalog/tests/live-reference.test.ts",
    "import assert from 'node:assert/strict'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const source = await readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json'); const required = source.products.find((item) => item.reference === '1234'); assert.ok(required);\n");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-FIXED-REFERENCE"));
});

test("no confunde variables locales de otros tests con referencias del catálogo vivo", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/integration/catalog/tests/independent-synthetic.test.ts",
    "import assert from 'node:assert/strict'; import test from 'node:test'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; test('catálogo vivo', async () => { const source = await readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json'); assert.ok(source.products.length > 0); }); test('fixture sintética', () => { const source = [{ reference: '1234' }]; const required = source.find((item) => item.reference === '1234'); assert.ok(required); });\n");
  assert.ok(!rules(inspectTestArchitecture(root).findings).has("T-FIXED-REFERENCE"));
});

test("detecta lectura viva detrás de helpers locales, sin prohibir fuentes históricas", (t) => {
  const { root, write } = fixture(t);
  const helper = "src/catalog/coverage/tests/source-helper.ts";
  const consumer = "src/catalog/coverage/tests/coverage.test.ts";
  write(helper,
    "import { readCanonicalCatalog } from '../../../infrastructure/filesystem/catalog/canonical-catalog.js'; export const read = () => readCanonicalCatalog('src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json');\n");
  write(consumer, "import { read } from './source-helper.js'; export const source = read;\n");
  assert.ok(!rules(inspectTestArchitecture(root).findings).has("T-TRANSITIVE-CATALOG"));
  write(helper,
    "import { readCanonicalCatalog } from '../../../infrastructure/filesystem/catalog/canonical-catalog.js'; export const read = () => readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json');\n");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-TRANSITIVE-CATALOG"));
});

test("el comando del guard falla de verdad si se introduce un test acoplado", (t) => {
  const { root, write } = fixture(t);
  const command = fileURLToPath(new URL("./tests-domain-tests-guard.mjs", import.meta.url));
  write("src/testing/integration/catalog/tests/live-count.test.ts",
    "import assert from 'node:assert/strict'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const source = await readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json'); assert.equal(source.products.length, 384);\n");
  const failed = spawnSync(process.execPath, [command, "--root", root], { encoding: "utf8" });
  assert.equal(failed.status, 1, failed.stderr);
  assert.match(failed.stdout, /T-FIXED-COHORT/u);
  write("src/testing/integration/catalog/tests/live-count.test.ts",
    "import assert from 'node:assert/strict'; const fixture = { products: [1, 2] }; assert.equal(fixture.products.length, 2);\n");
  const passed = spawnSync(process.execPath, [command, "--root", root], { encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr + passed.stdout);
});

test("no confunde una constante de otro test con el censo operativo", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/integration/catalog/tests/independent-amounts.test.ts",
    "import assert from 'node:assert/strict'; import test from 'node:test'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; test('sintético', () => { const total = 384; assert.equal([1, 2].length, 2); }); test('censal', async () => { const source = await readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json'); const total = source.products.length; assert.equal(source.products.length, total); });\n");
  assert.ok(!rules(inspectTestArchitecture(root).findings).has("T-FIXED-COHORT"));
});

test("no considera inmutable una variable reasignable de un censo dinámico", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/integration/catalog/tests/mutable-count.test.ts",
    "import assert from 'node:assert/strict'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const source = await readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json'); let count = 1; count = source.products.length; assert.equal(source.products.length, count);\n");
  assert.ok(!rules(inspectTestArchitecture(root).findings).has("T-FIXED-COHORT"));
});

test("detecta rutas de originales vivos declaradas mediante aliases o segmentos relativos", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/integration/catalog/tests/live-alias.test.ts",
    "import assert from 'node:assert/strict'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const path = 'catalogs/providers/gam/original/scrape-gam-catalog.json'; const inventory = await readCanonicalCatalog(path); assert.equal(inventory.products.length, 983);\n");
  write("src/testing/integration/preparation/tests/live-join.test.ts",
    "import assert from 'node:assert/strict'; import { join } from 'node:path'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const path = join('catalogs','providers','gam','original','scrape-gam-catalog.json'); const inventory = await readCanonicalCatalog(path); assert.equal(inventory.products.length, 976);\n");
  const findings = inspectTestArchitecture(root).findings.filter((entry) => entry.rule === "T-FIXED-COHORT");
  assert.equal(findings.length, 2);
});

test("detecta recuentos de aliases de inventario y aserciones de igualdad", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/integration/catalog/tests/live-records.test.ts",
    "import assert from 'node:assert/strict'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const dataset = (await readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json')).products; assert.equal(dataset.length, 983); assert.ok(dataset.length === 983);\n");
  const findings = inspectTestArchitecture(root).findings.filter((entry) => entry.rule === "T-FIXED-COHORT");
  assert.equal(findings.length, 2);
});

test("detecta helpers vivos con rutas segmentadas consumidos desde integración", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/builders/operational-source.ts",
    "import { join } from 'node:path'; import { readCanonicalCatalog } from '../../infrastructure/filesystem/catalog/canonical-catalog.js'; const source = join('catalogs','providers','gam','original','scrape-gam-catalog.json'); export const load = () => readCanonicalCatalog(source);\n");
  write("src/testing/integration/catalog/tests/live-helper.test.ts",
    "import assert from 'node:assert/strict'; import { load } from '../../../builders/operational-source.js'; const inventory = await load(); assert.equal(inventory.products.length, 983);\n");
  const findings = inspectTestArchitecture(root).findings;
  assert.ok(findings.some((item) => item.rule === "T-TRANSITIVE-CATALOG"));
  assert.ok(findings.some((item) => item.rule === "T-FIXED-COHORT"));
});

test("detecta raíces operativas heredadas de process.cwd sin bloquear raíces temporales", (t) => {
  const { root, write } = fixture(t);
  const suite = "src/testing/integration/preparation/tests/catalog-root.test.ts";
  write(suite,
    "import assert from 'node:assert/strict'; import { join } from 'node:path'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const root = process.cwd(); const source = join(root, 'catalogs', 'providers', 'gam', 'original', 'scrape-gam-catalog.json'); const records = (await readCanonicalCatalog(source)).products; assert.equal(records.length, 976);\n");
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-FIXED-COHORT"));
  write(suite,
    "import assert from 'node:assert/strict'; import { join } from 'node:path'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; const verify = async (root: string) => { const source = join(root, 'catalogs', 'providers', 'gam', 'original', 'scrape-gam-catalog.json'); const records = (await readCanonicalCatalog(source)).products; assert.equal(records.length, 2); }; export { verify };\n");
  assert.deepEqual(inspectTestArchitecture(root).findings, []);
});

test("permite contar datos sintéticos aunque otra prueba lea un original vivo", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/integration/catalog/tests/isolated-dataset.test.ts",
    "import assert from 'node:assert/strict'; import test from 'node:test'; import { readCanonicalCatalog } from '../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; test('censo', async () => { const source = await readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json'); assert.ok(source.products.every(item => !!item.reference)); }); test('sintético', () => { const dataset = [{reference:'A'}]; assert.equal(dataset.length, 1); });\n");
  assert.deepEqual(inspectTestArchitecture(root).findings, []);
});

test("detecta una ruta viva compuesta en dos pasos y propagada por un builder", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/builders/source-composed.ts",
    "import { join } from 'node:path'; import { readCanonicalCatalog } from '../../infrastructure/filesystem/catalog/canonical-catalog.js'; const base = join('catalogs', 'providers'); const source = join(base, 'gam', 'original', 'scrape-gam-catalog.json'); export const load = () => readCanonicalCatalog(source);\n");
  write("src/testing/integration/catalog/tests/source-composed.test.ts",
    "import assert from 'node:assert/strict'; import { load } from '../../../builders/source-composed.js'; const inventory = await load(); assert.equal(inventory.products.length, 976);\n");
  const findings = inspectTestArchitecture(root).findings;
  assert.ok(findings.some((item) => item.rule === "T-TRANSITIVE-CATALOG"));
});

test("acepta la raíz temporal de un builder de publicaciones sin acreditación del stock vivo", (t) => {
  const { root, write } = fixture(t);
  write("src/testing/builders/temporary-publications.ts",
    "import { readFileSync } from 'node:fs'; import { join } from 'node:path'; export const read = (root: string) => readFileSync(join(root, 'catalogs', 'providers', 'gam', 'publications', 'active.json'), 'utf8');\n");
  write("src/testing/integration/catalog/tests/temporary-publications.test.ts",
    "import assert from 'node:assert/strict'; import { read } from '../../../builders/temporary-publications.js'; const verify = (workspace: string) => { const data = read(workspace); assert.ok(data.length >= 0); }; export { verify };\n");
  assert.deepEqual(inspectTestArchitecture(root).findings, []);
});
