import { reconcileGamHorometer } from "../../../reconciliation/gam-horometer.js";
import { reconcileGamSourceTechnicalUnits } from "../../../reconciliation/gam-source-technical-units.js";
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { SOURCE_CATEGORY_ISSUE, sourceCategoryQualityIssue } from "../../../source/category-quality.js";
import { prepareProduct } from "../../../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const sources = await Promise.all([
  readCanonicalCatalog(fileURLToPath(new URL("../../../../../../src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url))),
  readCanonicalCatalog(fileURLToPath(new URL("../../../../../../src/testing/fixtures/gomariz/scrape-gomariz-catalog.json", import.meta.url))),
  readCanonicalCatalog(fileURLToPath(new URL("../../../../../../src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json", import.meta.url)))
]);

const record = (provider: string, code: string): ProductRecord => {
  const product = sources.find((source) => source.providerId === provider)?.products.find((item) => item.reference === code);
  assert.ok(product, `${provider}:${code}`);
  return product;
};

const electricalCranes = new Map<string, Readonly<Record<string, string>>>([
  ["1884", { "Potencia de tracción (kW)": "12 kW", "Autonomía aproximada (h)": "8 h", "Voltaje batería (V)": "80 V", "Capacidad de la batería (Ah)": "1085 Ah" }],
  ["1885", { "Potencia de tracción (kW)": "30 kW", "Autonomía aproximada (h)": "8 h", "Voltaje batería (V)": "96 V", "Capacidad de la batería (Ah)": "1240 Ah" }],
  ["1886", { "Potencia de tracción (kW)": "40 kW", "Autonomía aproximada (h)": "8 h", "Voltaje batería (V)": "96 V", "Capacidad de la batería (Ah)": "1395 Ah" }],
  ["1887", { "Potencia de tracción (kW)": "50 kW", "Autonomía aproximada (h)": "8 h", "Voltaje batería (V)": "96 V", "Capacidad de la batería (Ah)": "1395 Ah" }]
]);

const approved = (provider: string, codes: readonly string[]): void => {
  for (const code of codes) {
    const product = record(provider, code);
    assert.equal(sourceCategoryQualityIssue(product), null, `${provider}:${code}`);
    const prepared = prepareProduct(product, catalog);
    assert.equal(prepared.status, "ready", `${provider}:${code}: ${prepared.issues.join(", ")}`);
    assert.equal(prepared.product.reference, code);
    const expectedSpecs = { ...reconcileGamHorometer(product).specs,
      ...(provider === "gam" && ["6873", "6874"].includes(code) ? { "Dimensiones Cesta": "1,4 x 0,7 x 1,1 m" } : {}),
      ...(provider === "gam" && ["4019", "4020"].includes(code) ? { "Depósito de solución": 480, "Depósito de recuperación": 346 } : {}),
      ...(provider === "gam" && code === "4021" ? { "Depósito de solución": 530, "Depósito de recuperación": 276 } : {}),
      ...(provider === "gam" && ["4019", "4020"].includes(code) ? { "Capacidad de la tolva": 85 } : {}),
      ...(provider === "gam" && code === "4021" ? { "Capacidad de la tolva": 110, "Nivel sonoro": "84 dBA" } : {}),
      ...(provider === "gam" && code === "6182" ? { "Depósito de combustible": 50, "Potencia (kW)": "51,7 kW", "Par motor (Nm)": "225 Nm" } : {}),
      ...(provider === "gam" && ["6182", "6873", "6953", "6954"].includes(code) ? { "Parada de emergencia": true } : {}),
      ...(provider === "gam" ? electricalCranes.get(code) ?? {} : {}),
      ...(provider === "gam" && code === "5079" ? { "Voltaje batería (V)": "96 V", "Capacidad de la batería (Ah)": "1395 Ah", "Autonomía aproximada (h)": "8 h", "Ruedas": "Delanteras gemelas cushion; traseras superelásticas", "Motorización": "Eléctrico" } : {}),
      ...(provider === "gam" && code === "1888" ? { "Autonomía aproximada (h)": "8 h" } : {}),
      ...(provider === "gam" && code === "2365" ? { "Frenado automático": true } : {}),
      ...(provider === "gam" && ["4019", "4020"].includes(code) ? { "Nivel sonoro": "75 dBA", "Velocidad de desplazamiento (km/h)": "9 km/h", "Anchura del cepillo principal (mm)": 915 } : {}) };
    assert.deepEqual(prepared.product.spec, reconcileGamSourceTechnicalUnits({ ...product, specs: expectedSpecs }).specs);
  }
};

test("familias GAM nuevas confirmadas por tipo y descripción", () => {
  approved("gam", [
    "4019", "4020", "4021", "5254",
    "3425", "3426", "3427", "3428", "3429", "3430", "3431", "3432", "3433", "3434", "3435", "3436",
    "1884", "3309", "1885", "1886", "5079", "1887", "1888",
    "6182", "3311", "3312", "3313", "3314", "3315", "6749",
    "6873", "6874", "6953", "6954", "297", "298", "2365", "6217", "6623"
  ]);
});

test("los cuatro tipos de Gomariz acreditados en su taxonomía", () => {
  approved("gomariz", ["5051BDX", "1011JFB", "RE454", "PV556"]);
});

test("Mercaeleva acredita su camión y las condiciones individuales de ocasión", () => {
  approved("mercaeleva", ["M928-9933"]);
  for (const code of ["M294-4678", "M958-0132"]) {
    const product = record("mercaeleva", code);
    assert.equal(sourceCategoryQualityIssue(product), null);
    const prepared = prepareProduct(product, catalog);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.condition, "Segunda_Mano");
    assert.ok(!prepared.issues.includes(SOURCE_CATEGORY_ISSUE));
  }
});

test("no confirma motores alternativos, lotes, cuatriciclos ni familias mixtas", () => {
  for (const code of ["8", "2312", "2313", "2572", "2573", "2738"]) {
    assert.equal(sourceCategoryQualityIssue(record("gam", code)), SOURCE_CATEGORY_ISSUE, code);
  }
});

test("las evidencias cruzadas detectan mutaciones de tipo, subtipo, origen y modelo", () => {
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

test("mantiene íntegra la cohorte y sus identidades", () => {
  const counts = sources.map((source) => source.products.length);
  assert.ok(counts.every((count) => count > 0));
  const keys = sources.flatMap((source) => source.products.map((product) => `${source.providerId}:${product.reference}`));
  assert.equal(keys.length, counts.reduce((sum, count) => sum + count, 0));
  assert.equal(new Set(keys).size, keys.length);
});
