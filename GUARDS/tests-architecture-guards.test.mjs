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

test("los recuentos acreditados se exceptúan por ruta, prueba y afirmación exacta", (t) => {
  const { root, write } = fixture(t);
  const path = "src/preparation/gam/quality/tests/gam-verified-operational-safety.test.ts";
  const original = "import assert from 'node:assert/strict'; import test from 'node:test'; const source = 'catalogs/providers/gam/original/scrape-gam-catalog.json'; test('recupera veinte prestaciones de seguridad de fuentes individuales conservando las especificaciones anteriores', () => { const changed = { length: 20 }; assert.equal(changed.length, 20); });";
  write(path, original);
  const accredited = inspectTestArchitecture(root);
  assert.equal(accredited.findings.filter((finding) => finding.rule === "T-FIXED-COHORT").length, 0);
  assert.equal(accredited.exceptions.filter((item) => item.rule === "T-FIXED-COHORT").length, 1);
  assert.ok(rules(accredited.findings).has("T-PRODUCT-CATALOG"));
  write(path, original.replace("assert.equal(changed.length, 20)", "assert.equal(changed.length, 21)"));
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-FIXED-COHORT"));
  write(path, original.replace("recupera veinte prestaciones de seguridad de fuentes individuales conservando las especificaciones anteriores",
    "otro caso con el mismo recuento"));
  assert.ok(rules(inspectTestArchitecture(root).findings).has("T-FIXED-COHORT"));
});

test("la excepción de fixture transitiva no cubre fuentes o consumidores nuevos", (t) => {
  const { root, write } = fixture(t);
  const path = "src/preparation/gam/classification/tests/gam-verified-category-equivalences.test.ts";
  const fixturePath = "src/preparation/gam/technical/tests/support/gam-source-category-fixture.ts";
  const accreditedFixture = "import { readCanonicalCatalog } from '../../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; export const load = () => readCanonicalCatalog('src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json');";
  write(fixturePath, accreditedFixture);
  write(path,
    "import { load } from '../../technical/tests/support/gam-source-category-fixture.js'; export const source = load; ");
  const accredited = inspectTestArchitecture(root);
  assert.equal(accredited.findings.filter((finding) => finding.rule === "T-TRANSITIVE-CATALOG").length, 0);
  assert.equal(accredited.exceptions.filter((item) => item.rule === "T-TRANSITIVE-CATALOG").length, 1);
  write(fixturePath, accreditedFixture + " export const extra = readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json');");
  assert.equal(inspectTestArchitecture(root).findings.filter((finding) => finding.rule === "T-TRANSITIVE-CATALOG").length, 1);
  write(fixturePath, accreditedFixture);
  write("src/testing/builders/alternative-catalog-fixture.ts",
    "export const source = 'catalogs/providers/gam/original/scrape-gam-catalog.json';");
  write(path,
    "import { load } from '../../technical/tests/support/gam-source-category-fixture.js'; import { source } from '../../../../testing/builders/alternative-catalog-fixture.js'; export const both = [load, source];");
  assert.equal(inspectTestArchitecture(root).findings.filter((finding) => finding.rule === "T-TRANSITIVE-CATALOG").length, 1);
});

test("la excepción transitiva Mercaeleva se revoca si el builder incorpora otra fuente", (t) => {
  const { root, write } = fixture(t);
  const helper = "src/testing/builders/mercaeleva-source-fixture.ts";
  const path = "src/preparation/mercaeleva/technical/tests/specifications/mercaeleva-documented-platform-technical-specs.test.ts";
  const source = 'import { join } from "node:path"; import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js"; export const read = () => { const folder = join("catalogs", "providers", "mercaeleva", "original"); const entries = []; if (entries.length !== 1) throw Error(); return readCanonicalCatalog(join(folder, "catalog.json")); };';
  write(helper, source);
  write(path, "import { read } from '../../../../../testing/builders/mercaeleva-source-fixture.js'; export const load = read;");
  const accredited = inspectTestArchitecture(root);
  assert.equal(accredited.exceptions.filter((item) => item.rule === "T-TRANSITIVE-CATALOG").length, 1);
  assert.ok(!rules(accredited.findings).has("T-TRANSITIVE-CATALOG"));
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
  "src/preparation/gam/quality/tests/gam-verified-operational-safety.test.ts",
  "src/preparation/gam/technical/measurements/gam-clearance-platform.test.ts",
  "src/preparation/gam/technical/measurements/gam-qualified-geometry-evidence.test.ts",
  "src/preparation/gam/technical/mobility/gam-traction-braking-evidence.test.ts",
  "src/preparation/gam/technical/mobility/gam-verified-drivetrain-brakes.test.ts",
  "src/preparation/gam/technical/operations/gam-cleaning-tank-evidence.test.ts",
  "src/preparation/gam/technical/operations/gam-unit-performance-specs.test.ts",
  "src/preparation/gam/technical/safety/gam-acoustic-evidence.test.ts",
  "src/preparation/gam/technical/safety/gam-verified-operator-controls.test.ts",
  "src/preparation/gam/technical/tests/gam-verified-tyre-and-noise-details.test.ts",
  "src/preparation/shared/quality/tests/source-semantic-quality.test.ts",
  "src/preparation/tests/catalog-publication-consistency.test.ts"
];

test("las 21 lecturas protegidas son contratos de integración exactos y no infracciones", (t) => {
  const { root, write } = fixture(t);
  for (const path of accreditedCatalogIntegrationPaths) {
    write(path, readFileSync(join(guardedRepositoryRoot, path), "utf8"));
  }
  const result = inspectTestArchitecture(root);
  assert.deepEqual(result.findings, []);
  assert.equal(result.integrations.length, 21);
  assert.equal(new Set(result.integrations.map((item) => item.path)).size, 14);
});

test("la acreditación exacta se revoca ante cualquier cambio y no acepta nuevas lecturas", (t) => {
  const { root, write } = fixture(t);
  const path = "src/preparation/gam/quality/tests/gam-verified-operational-safety.test.ts";
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
