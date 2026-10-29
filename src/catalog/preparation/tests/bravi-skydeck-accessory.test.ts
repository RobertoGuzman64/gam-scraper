import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { sourceCategoryQualityIssue, SOURCE_CATEGORY_ISSUE } from "../source/category-quality.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const skyDeck = source.products.find((item) => item.reference === "2364");
assert.ok(skyDeck);

test("SKY DECK se identifica como accesorio Bravi sin inventar categoría ni atributos", () => {
  const original = structuredClone(skyDeck);
  assert.equal(sourceCategoryQualityIssue(skyDeck), null);
  const prepared = prepareProduct(skyDeck, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.reference, "2364");
  assert.equal(prepared.product.categorySellID, null);
  assert.equal(prepared.product.category, null);
  assert.deepEqual(prepared.product.spec, original.specs);
  assert.deepEqual(prepared.product.attributes, []);
  assert.ok(prepared.importIssues?.createMany.some((issue) => issue.startsWith("Categoría no ")));
  assert.deepEqual(skyDeck, original);
});

test("otras identidades y cualquier evidencia SKY DECK alterada no reciben categoría", () => {
  const variants: readonly ProductRecord[] = [
    { ...skyDeck, providerId: "mercaeleva" },
    { ...skyDeck, categoryKey: "elevacion" },
    { ...skyDeck, condition: "Segunda mano" },
    { ...skyDeck, reference: "2365" },
    { ...skyDeck, url: `${skyDeck.url}?revision=1` },
    { ...skyDeck, url: skyDeck.url.replace("plataformas-elevadoras-bravi", "bravi") },
    { ...skyDeck, externalReference: "SKY-DECK-2" },
    { ...skyDeck, title: "PLATAFORMA SKY DECK" },
    { ...skyDeck, brand: "OTRA" },
    { ...skyDeck, model: "SKY DECK 2" },
    { ...skyDeck, shortDescription: "Plataforma de elevación eléctrica" },
    { ...skyDeck, longDescription: "Plataforma de elevación eléctrica" },
    { ...skyDeck, specs: { ...skyDeck.specs, Marca: "OTRA" } },
    { ...skyDeck, specs: { ...skyDeck.specs, Modelo: "OTRO" } },
    { ...skyDeck, specs: { ...skyDeck.specs, "Altura de trabajo": "10 m" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(sourceCategoryQualityIssue(variant), SOURCE_CATEGORY_ISSUE, String(index));
    assert.equal(prepareProduct(variant, catalog).product.categorySellID, null, String(index));
  }
});
