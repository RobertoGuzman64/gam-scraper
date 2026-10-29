import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { sourceCategoryQualityIssue, SOURCE_CATEGORY_ISSUE } from "../source/category-quality.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const musoshi = gam.products.find((product) => product.reference === "6806");
assert.ok(musoshi);

test("Musoshi 6806 documenta un cuatriciclo y no se clasifica como furgoneta", () => {
  const original = structuredClone(musoshi);
  assert.equal(sourceCategoryQualityIssue(musoshi), null);
  const prepared = prepareProduct(musoshi, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.categorySellID, null);
  assert.equal(prepared.product.category, null);
  assert.deepEqual(prepared.product.spec, musoshi.specs);
  assert.deepEqual(prepared.product.attributes, []);
  assert.ok(prepared.importIssues?.createMany.some((issue) => issue.startsWith("Categoría no ")));
  assert.deepEqual(musoshi, original);
});

test("variantes de identidad, modelo, documentación y origen quedan sin confirmar", () => {
  const variants: readonly ProductRecord[] = [
    { ...musoshi, providerId: "mercaeleva" },
    { ...musoshi, reference: "6808" },
    { ...musoshi, url: `${musoshi.url}?revision=1` },
    { ...musoshi, externalReference: "INQ-04324" },
    { ...musoshi, title: "Musoshi PoP Up" },
    { ...musoshi, categoryKey: "otros" },
    { ...musoshi, condition: "Nuevo" },
    { ...musoshi, brand: "ZERO" },
    { ...musoshi, model: "P1.7" },
    { ...musoshi, year: "2023" },
    { ...musoshi, location: "VALENCIA" },
    { ...musoshi, serialNumber: "NRXL3AALS10000102" },
    { ...musoshi, shortDescription: "Vehículo eléctrico urbano" },
    { ...musoshi, longDescription: "Cuatriciclo sin identificación acreditada" },
    { ...musoshi, specs: { ...musoshi.specs, Modelo: "P1.7" } },
    { ...musoshi, specs: { ...musoshi.specs, "Matrícula": "2722MHH" } },
    { ...musoshi, specs: { ...musoshi.specs, "Nº de serie": "NRXL3AALS10000102" } },
    { ...musoshi, specs: { ...musoshi.specs, "Tipo motor": "Diésel" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(sourceCategoryQualityIssue(variant), SOURCE_CATEGORY_ISSUE, String(index));
    assert.equal(prepareProduct(variant, catalog).product.categorySellID, null, String(index));
  }
});
