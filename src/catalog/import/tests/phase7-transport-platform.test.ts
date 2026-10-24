import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { SOURCE_CATEGORY_ISSUE, sourceCategoryQualityIssue } from "../mapping/source-category-quality.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("storage/scraped/gomariz/scrape-gomariz-catalog.json");
const mercaeleva = await readCanonicalCatalog("storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json");
const source = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Fase 7: plataforma de transporte registrada con identidad y documentación concordantes", () => {
  const record = source("5710");
  assert.equal(sourceCategoryQualityIssue(record), null);
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.deepEqual(prepared.product.spec, record.specs);
  assert.equal(prepared.product.reference, record.reference);
  assert.equal(prepared.product.sourceUrl, record.url);
  assert.equal(prepared.product.condition, "Segunda_Mano");
});

test("Fase 7: matrícula, serie, marca, modelo, fuente y evidencia vial son imprescindibles", () => {
  const original = source("5710");
  const altered: readonly ProductRecord[] = [
    { ...original, brand: "OTRA" },
    { ...original, specs: { ...original.specs, Marca: "OTRA" } },
    { ...original, model: "MCO-OTRO" },
    { ...original, specs: { ...original.specs, Modelo: "OTRO" } },
    { ...original, specs: { ...original.specs, Matrícula: "" } },
    { ...original, specs: { ...original.specs, "Nº de serie": "" } },
    { ...original, specs: { ...original.specs, "Año de fabricación": "2000" } },
    { ...original, longDescription: "Equipo transportable sin documentación de circulación" },
    { ...original, shortDescription: "Plataforma de carga industrial" },
    { ...original, title: "Plataforma tijera eléctrica NOOTEBOOM MCO" },
    { ...original, condition: "Nuevo" },
    { ...original, categoryKey: "elevacion" },
    { ...original, url: original.url.replace("resto-maquinaria-segunda-mano", "lotes") }
  ];
  for (const [index, record] of altered.entries()) {
    assert.equal(sourceCategoryQualityIssue(record), SOURCE_CATEGORY_ISSUE, String(index));
    assert.equal(prepareProduct(record, catalog).status, "review", String(index));
  }
});

test("Fase 7: el lote solo recupera la plataforma registrada sin desbloquear contradicciones", () => {
  const batches = [gam, gomariz, mercaeleva].map((batch) => prepareImportBatch(batch.products, catalog));
  assert.deepEqual(batches.map((batch) => batch.totals), [
    { ready: 979, review: 29 },
    { ready: 143, review: 0 },
    { ready: 213, review: 5 }
  ]);
  assert.equal(batches.reduce((sum, batch) => sum + batch.products.length, 0), 1369);
  for (const reference of ["6682", "6703", "6835", "6858", "6806", "6807", "6236", "4737", "2312"]) {
    const item = batches[0]?.products.find((product) => product.product.reference === reference);
    assert.ok(item, reference);
    assert.equal(item.status, "review", reference);
  }
});
