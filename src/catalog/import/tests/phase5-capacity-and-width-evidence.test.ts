import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { sourceCategoryQualityIssue } from "../mapping/source-category-quality.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const source = (reference: string): ProductRecord => {
  const result = gam.products.find((product) => product.reference === reference);
  assert.ok(result, reference);
  return result;
};
const attribute = (name: string) => {
  const definition = catalog.attributes.find((entry) => entry.name === name && entry.type === "NUMBER");
  assert.ok(definition, name);
  return definition;
};
const capacityCases = [
  ["50", 1400], ["2016", 1800], ["2044", 25000], ["2049", 32000],
  ["2089", 5000], ["2136", 1600], ["2193", 3000], ["2275", 2000],
  ["6421", 2000], ["6932", 1600], ["6965", 2000]
] as const;
const widthCases = [["3997", 455], ["4005", 700], ["4024", 860]] as const;

test("Fase 5: reconciliar capacidades requiere identidad de modelo y evidencias convergentes", () => {
  const definition = attribute("Capacidad de carga");
  for (const [reference, expected] of capacityCases) {
    const record = source(reference);
    assert.deepEqual(resolveAttribute(record, definition), { status: "resolved", value: expected }, reference);
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.product.spec, record.specs ?? {}, reference);
    assert.ok(prepared.product.attributes.some((value) =>
      value.value === expected && catalog.attributes.some((candidate) =>
        candidate.id === value.attributeID && candidate.name === definition.name)), reference);
  }
});

test("Fase 5: anchuras corroboradas distinguen redondeo, configuración y medida de trabajo", () => {
  const definition = attribute("Ancho de trabajo");
  for (const [reference, expected] of widthCases) {
    const record = source(reference);
    assert.deepEqual(resolveAttribute(record, definition), { status: "resolved", value: expected }, reference);
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.product.spec, record.specs ?? {}, reference);
  }
});

test("Fase 5: centro de carga configurable permanece sin escalar y categoría documentada", () => {
  const record = source("12");
  assert.equal(sourceCategoryQualityIssue(record), null);
  assert.deepEqual(resolveAttribute(record, attribute("Centro de carga")), { status: "not_observed", value: null });
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.product.spec, record.specs ?? {});
  assert.equal(prepared.product.attributes.some((value) => value.attributeID === attribute("Centro de carga").id), false);
});

test("Fase 5: las evidencias contradictorias, modelos alterados y configuraciones no acreditadas siguen bloqueados", () => {
  for (const reference of ["2312"]) {
    assert.equal(prepareProduct(source(reference), catalog).status, "review", reference);
  }
  assert.equal(prepareProduct(source("4004"), catalog).status, "ready");
  assert.equal(prepareProduct(source("2240"), catalog).status, "ready");
  const capacity = attribute("Capacidad de carga");
  const huge = source("2044");
  assert.equal(resolveAttribute({ ...huge, longDescription: "La Hyster H25XD-12 tiene capacidad nominal de 28000 kg." }, capacity).status, "contradiction");
  assert.equal(resolveAttribute({ ...huge, model: "H28XD-12" }, capacity).status, "contradiction");
  const altered = source("2193");
  assert.equal(resolveAttribute({ ...altered, longDescription: "La Yale ERP30VLL tiene capacidad de carga de 2500 kg." }, capacity).status, "contradiction");
  const width = attribute("Ancho de trabajo");
  const configurable = source("4005");
  assert.equal(resolveAttribute({ ...configurable, model: "FCS T581 55" }, width).status, "contradiction");
  const hand = source("12");
  const changed = { ...hand, specs: { ...hand.specs, "Centro de carga": "500-600-700 mm" } };
  assert.equal(resolveAttribute(changed, attribute("Centro de carga")).status, "invalid");
  assert.notEqual(sourceCategoryQualityIssue({ ...hand, specs: { ...hand.specs, Modelo: "H3.5FT" } }), null);
});

test("Fase 5: la preparación por lote conserva las referencias y colisiones previas", () => {
  const batch = prepareImportBatch(gam.products, catalog);
  assert.deepEqual(batch.totals, { ready: 999, review: 9 });
  assert.equal(new Set(batch.products.map((result) => result.product.reference)).size, 1008);
  for (const reference of ["6682", "6703", "6806", "6807", "6835", "6858"]) {
    const result = batch.products.find((entry) => entry.product.reference === reference);
    assert.ok(result, reference);
    assert.equal(result.status, "review", reference);
  }
});
