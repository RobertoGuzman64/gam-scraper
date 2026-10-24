import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { SOURCE_CATEGORY_ISSUE, sourceCategoryQualityIssue } from "../mapping/source-category-quality.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const sources = await Promise.all([
  readCanonicalCatalog(fileURLToPath(new URL("../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url))),
  readCanonicalCatalog(fileURLToPath(new URL("../../../../storage/scraped/gomariz/scrape-gomariz-catalog.json", import.meta.url))),
  readCanonicalCatalog(fileURLToPath(new URL("../../../../storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json", import.meta.url)))
]);

const record = (provider: string, code: string): ProductRecord => {
  const product = sources.find((source) => source.providerId === provider)?.products.find((item) => item.reference === code);
  assert.ok(product, `${provider}:${code}`);
  return product;
};

const approved = (provider: string, codes: readonly string[]): void => {
  for (const code of codes) {
    const product = record(provider, code);
    assert.equal(sourceCategoryQualityIssue(product), null, `${provider}:${code}`);
    const prepared = prepareProduct(product, catalog);
    assert.equal(prepared.status, "ready", `${provider}:${code}: ${prepared.issues.join(", ")}`);
    assert.equal(prepared.product.reference, code);
    assert.deepEqual(prepared.product.spec, product.specs ?? {});
  }
};

test("Fase 3: familias GAM nuevas confirmadas por tipo y descripción", () => {
  approved("gam", [
    "4019", "4020", "4021", "5254",
    "3425", "3426", "3427", "3428", "3429", "3430", "3431", "3432", "3433", "3434", "3435", "3436",
    "1884", "3309", "1885", "1886", "5079", "1887", "1888",
    "6182", "3311", "3312", "3313", "3314", "3315", "6749",
    "6873", "6874", "6953", "6954", "297", "298", "2365", "6217", "6623"
  ]);
});

test("Fase 3: los cuatro tipos de Gomariz acreditados en su taxonomía", () => {
  approved("gomariz", ["5051BDX", "1011JFB", "RE454", "PV556"]);
});

test("Fase 3: Mercaeleva acredita su camión sin deducir las condiciones ausentes", () => {
  approved("mercaeleva", ["M928-9933"]);
  for (const code of ["M294-4678", "M958-0132"]) {
    const product = record("mercaeleva", code);
    assert.equal(sourceCategoryQualityIssue(product), null);
    const prepared = prepareProduct(product, catalog);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.condition, null);
    assert.ok(!prepared.issues.includes(SOURCE_CATEGORY_ISSUE));
  }
});

test("Fase 3: no confirma motores alternativos, lotes, cuatriciclos ni familias mixtas", () => {
  for (const code of ["8", "2312", "2313", "2314", "6806", "2572", "2573", "2738", "2364"]) {
    assert.equal(sourceCategoryQualityIssue(record("gam", code)), SOURCE_CATEGORY_ISSUE, code);
  }
});

test("Fase 3: las evidencias cruzadas detectan mutaciones de tipo, subtipo, origen y modelo", () => {
  const modula = record("gam", "3425");
  assert.equal(sourceCategoryQualityIssue({ ...modula, shortDescription: "Almacén de ocasión, sin tipo confirmado" }), SOURCE_CATEGORY_ISSUE);
  assert.equal(sourceCategoryQualityIssue({ ...modula, url: modula.url.replace("/modula/", "/ormig/") }), SOURCE_CATEGORY_ISSUE);
  const packmat = record("gam", "3312");
  assert.equal(sourceCategoryQualityIssue({ ...packmat, shortDescription: "Compactadora móvil PACKMAT PK311" }), SOURCE_CATEGORY_ISSUE);
  assert.equal(sourceCategoryQualityIssue({ ...packmat, specs: { ...packmat.specs, "Tipo motor": "Eléctrico" } }), SOURCE_CATEGORY_ISSUE);
  const cte = record("gam", "6873");
  assert.equal(sourceCategoryQualityIssue({ ...cte, title: "Plataforma articulada CTE VJ15" }), SOURCE_CATEGORY_ISSUE);
  const gomariz = record("gomariz", "5051BDX");
  assert.equal(sourceCategoryQualityIssue({ ...gomariz, model: "P999" }), SOURCE_CATEGORY_ISSUE);
  const mercaeleva = record("mercaeleva", "M928-9933");
  assert.equal(sourceCategoryQualityIssue({ ...mercaeleva, specs: { ...mercaeleva.specs, "Título adicional": "Carretilla eléctrica" } }), SOURCE_CATEGORY_ISSUE);
  assert.equal(sourceCategoryQualityIssue({ ...mercaeleva, url: mercaeleva.url.replace("sales.mercaeleva.com", "example.org") }), SOURCE_CATEGORY_ISSUE);
});

test("Fase 3: mantiene íntegra la cohorte y sus identidades", () => {
  const counts = sources.map((source) => source.products.length);
  assert.deepEqual(counts, [1008, 143, 218]);
  const keys = sources.flatMap((source) => source.products.map((product) => `${source.providerId}:${product.reference}`));
  assert.equal(keys.length, 1369);
  assert.equal(new Set(keys).size, keys.length);
});
