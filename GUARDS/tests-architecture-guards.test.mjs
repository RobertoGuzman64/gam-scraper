import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { inspectEditorialArchitecture } from "./tests-editorial-architecture-guard.mjs";
import { inspectTestArchitecture } from "./tests-domain-tests-guard.mjs";

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
  assert.equal(present("PRUEBA", findings, optionsFrom(["--root", root, "--audit"])).exitCode, 1);
  assert.equal(present("PRUEBA", findings, optionsFrom(["--root", root, "--strict"])).exitCode, 1);
  assert.equal(present("PRUEBA", [], optionsFrom(["--root", root])).exitCode, 0);
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
  const fixturePath = "src/preparation/gam/technical/tests/support/gam-historical-category-fixture.ts";
  const accreditedFixture = "import { readCanonicalCatalog } from '../../../../../infrastructure/filesystem/catalog/canonical-catalog.js'; export const load = () => readCanonicalCatalog('src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json');";
  write(fixturePath, accreditedFixture);
  write(path,
    "import { load } from '../../technical/tests/support/gam-historical-category-fixture.js'; export const source = load; ");
  const accredited = inspectTestArchitecture(root);
  assert.equal(accredited.findings.filter((finding) => finding.rule === "T-TRANSITIVE-CATALOG").length, 0);
  assert.equal(accredited.exceptions.filter((item) => item.rule === "T-TRANSITIVE-CATALOG").length, 1);
  write(fixturePath, accreditedFixture + " export const extra = readCanonicalCatalog('catalogs/providers/gam/original/scrape-gam-catalog.json');");
  assert.equal(inspectTestArchitecture(root).findings.filter((finding) => finding.rule === "T-TRANSITIVE-CATALOG").length, 1);
  write(fixturePath, accreditedFixture);
  write("src/testing/builders/alternative-catalog-fixture.ts",
    "export const source = 'catalogs/providers/gam/original/scrape-gam-catalog.json';");
  write(path,
    "import { load } from '../../technical/tests/support/gam-historical-category-fixture.js'; import { source } from '../../../../testing/builders/alternative-catalog-fixture.js'; export const both = [load, source];");
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
  write("guards-architecture-baseline-f7.json", JSON.stringify({ version: 1, editorial: [{ id: findings[0].id }], tests: [] }));
  const { optionsFrom, present } = await import("./guards-architecture-core.mjs");
  assert.equal(present("PRUEBA", findings, optionsFrom(["--root", root])).exitCode, 1);
});

test("un test de integración de publicación no se penaliza por usar manifiestos inmutables", (t) => {
  const { root, write } = fixture(t);
  write("src/infrastructure/filesystem/catalog/tests/publication-verify.test.ts",
    "import { readFileSync } from 'node:fs'; const data = readFileSync('catalogs/providers/gam/publications/active.json', 'utf8');\n");
  write("src/preparation/shared/editorial/tests/contract.test.ts",
    "import assert from 'node:assert/strict'; const controlled = { reference: 'prueba', height: 12 }; assert.equal(controlled.height, 12);\n");
  assert.deepEqual(inspectTestArchitecture(root).findings, []);
});
