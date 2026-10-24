import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { reconcileGamOutdatedSourceTitle } from "../mapping/providers/gam/editorial-titles.js";
import { sourceCategoryQualityIssue } from "../mapping/source-category-quality.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const machine = (reference: string): ProductRecord => {
  const record = source.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Fase 9: corrige encabezados de otra familia solo si ficha, URL y texto identifican el mismo equipo", () => {
  for (const reference of ["8", "171"]) {
    const original = machine(reference);
    const normalized = reconcileGamOutdatedSourceTitle(original);
    assert.notStrictEqual(normalized, original, reference);
    assert.equal(normalized.reference, original.reference);
    assert.equal(normalized.url, original.url);
    assert.equal(normalized.brand, original.brand);
    assert.equal(normalized.model, original.model);
    assert.deepEqual(normalized.specs, original.specs);
    assert.equal(sourceCategoryQualityIssue(normalized), null, reference);
    const prepared = prepareProduct(original, catalog);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.issues, [], reference);
    assert.equal(prepared.product.title, normalized.title, reference);
    assert.equal(prepared.product.condition, "Nuevo", reference);
    assert.equal(prepared.product.sourceUrl, original.url);
    assert.deepEqual(prepared.product.spec, original.specs);
  }
  assert.equal(reconcileGamOutdatedSourceTitle(machine("8")).title, "Carretilla elevadora HYSTER H3.5FT");
  assert.equal(reconcileGamOutdatedSourceTitle(machine("171")).title, "Fregadora conductor sentado Tennant T16");
});

test("Fase 9: no recategoriza si faltan modelo, clasificación, corroboración o estado", () => {
  const forklift = machine("8");
  const scrubber = machine("171");
  const mutated: readonly ProductRecord[] = [
    { ...forklift, model: "H4.0FT" },
    { ...forklift, specs: { ...forklift.specs, Modelo: "H4.0FT" } },
    { ...forklift, specs: { ...forklift.specs, "Tipo motor": "Diésel" } },
    { ...forklift, specs: { ...forklift.specs, "Motorización": "Eléctrico" } },
    { ...forklift, shortDescription: "Carretilla desconocida" },
    { ...forklift, longDescription: "Máquina de otra familia" },
    { ...forklift, condition: "Segunda mano" },
    { ...forklift, url: forklift.url.replace("carretillas-elevadoras-diesel-hyster", "fregadoras-industriales-nuevas") },
    { ...forklift, title: "Carretilla elevadora de segunda mano HYSTER H3.5FT" },
    { ...scrubber, model: "T17" },
    { ...scrubber, specs: { ...scrubber.specs, Modelo: "T17" } },
    { ...scrubber, shortDescription: "Tennant T16" },
    { ...scrubber, longDescription: "Máquina elevadora" },
    { ...scrubber, url: scrubber.url.replace("-tennant-t16", "-tennant-t17") },
    { ...scrubber, condition: "Segunda mano" },
    { ...scrubber, title: "Fregadora de segunda mano Tennant T16" }
  ];
  for (const [index, item] of mutated.entries()) {
    assert.strictEqual(reconcileGamOutdatedSourceTitle(item), item, `${index}`);
  }
});

test("Fase 9: recuperaciones por lote sin tocar el resto ni permitir conflictos de identidad", () => {
  const batch = prepareImportBatch(source.products, catalog);
  assert.deepEqual(batch.totals, { ready: 1006, review: 2 });
  assert.equal(new Set(batch.products.map((item) => item.product.reference)).size, 1008);
  for (const reference of ["6682", "6703"]) {
    const result = batch.products.find((item) => item.product.reference === reference);
    assert.ok(result, reference);
    assert.equal(result.status, "review", reference);
  }
  for (const record of source.products) {
    if (record.reference === "8" || record.reference === "171") continue;
    assert.strictEqual(reconcileGamOutdatedSourceTitle(record), record, record.reference ?? undefined);
  }
});
