import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { sourceCategoryQualityIssue, SOURCE_CATEGORY_ISSUE } from "../mapping/source-category-quality.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const skyDeck = source.products.find((item) => item.reference === "2364");
assert.ok(skyDeck);

test("Fase 36: SKY DECK se identifica como accesorio Bravi sin inventar categoría ni atributos", () => {
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

test("Fase 36: otras identidades y cualquier evidencia SKY DECK alterada mantienen revisión", () => {
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
    assert.equal(prepareProduct(variant, catalog).status, "review", String(index));
  }
});

test("Fase 36: recupera únicamente SKY DECK y preserva las 1008 referencias GAM", () => {
  const prepared = prepareImportBatch(source.products, catalog);
  assert.deepEqual(prepared.totals, { ready: 1006, review: 2 });
  assert.equal(prepared.products.length, 1008);
  assert.equal(new Set(prepared.products.map((item) => item.product.reference)).size, 1008);
  assert.equal(prepared.products.find((item) => item.product.reference === "2364")?.status, "ready");
  for (const reference of ["6682", "6703"]) {
    assert.equal(prepared.products.find((item) => item.product.reference === reference)?.status, "review", reference);
  }
});

test("Fase 36: conserva las 1369 referencias y reduce reviews globales de 11 a 10", async () => {
  const [gomariz, mercaeleva] = await Promise.all([
    readCanonicalCatalog("storage/scraped/gomariz/scrape-gomariz-catalog.json"),
    readCanonicalCatalog("storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json")
  ]);
  const sources = [source, gomariz, mercaeleva];
  const summaries = sources.map((item) => prepareImportBatch(item.products, catalog).totals);
  assert.deepEqual(summaries, [
    { ready: 1006, review: 2 },
    { ready: 143, review: 0 },
    { ready: 217, review: 1 }
  ]);
  const references = sources.flatMap((item) => item.products.map((product) => `${item.providerId}:${product.reference}`));
  assert.equal(references.length, 1369);
  assert.equal(new Set(references).size, 1369);
});
