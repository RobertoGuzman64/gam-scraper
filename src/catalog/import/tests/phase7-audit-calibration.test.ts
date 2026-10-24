import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { SOURCE_CATEGORY_ISSUE, sourceCategoryQualityIssue } from "../mapping/source-category-quality.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));

const machine = (reference: string): ProductRecord => {
  const record = source.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const assertCalibrated = (reference: string): void => {
  const record = machine(reference);
  assert.equal(sourceCategoryQualityIssue(record), null, reference);
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready", reference);
  assert.deepEqual(prepared.issues, [], reference);
  assert.equal(prepared.product.categorySellID, null, reference);
  assert.deepEqual(prepared.product.spec, record.specs ?? {}, reference);
};

test("F7: la barredora-fregadora documentada se clasifica como máquina multifunción", () => {
  for (const reference of ["4019", "4020", "4021"]) assertCalibrated(reference);
});

test("F7: la máquina mixta no se confirma por palabras sueltas, variantes o rutas ajenas", () => {
  const record = machine("4019");
  for (const altered of [
    { ...record, shortDescription: "Máquina industrial de limpieza TENNANT BF M17 D" },
    { ...record, longDescription: "TENNANT BF M17 D. Equipo de limpieza" },
    { ...record, specs: { ...record.specs, Modelo: "BF M20" } },
    { ...record, url: record.url.replace("/fregadoras-industriales-nuevas/", "/carretillas-elevadoras-diesel-hyster/") },
    { ...record, title: "Barredora TENNANT BF M17 D" },
    { ...record, providerId: "mercaeleva" }
  ]) {
    assert.equal(sourceCategoryQualityIssue(altered), SOURCE_CATEGORY_ISSUE);
  }
  assert.equal(sourceCategoryQualityIssue(machine("4022")), null);
});

test("F7: vehículo con identidad técnica y descripción explícita no exige matrícula", () => {
  const record = machine("5254");
  assert.equal(record.specs?.["Matrícula"], undefined);
  assert.equal(record.specs?.["Kilómetros"], undefined);
  assertCalibrated("5254");
});

test("F7: la clasificación del vehículo sigue exigiendo evidencias independientes", () => {
  const record = machine("5254");
  for (const altered of [
    { ...record, longDescription: "LAND ROVER SANTANA. Vehículo restaurado" },
    { ...record, specs: { ...record.specs, "Nº de serie": "" } },
    { ...record, specs: { ...record.specs, "Nº de serie": "NA" } },
    { ...record, specs: { ...record.specs, Modelo: "" } },
    { ...record, specs: { ...record.specs, Marca: "JEEP" } },
    { ...record, specs: { ...record.specs, Modelo: "DEFENDER" } },
    { ...record, url: record.url.replace("/vehiculos-segunda-mano/", "/carretillas-elevadoras-diesel-hyster/") }
  ]) {
    assert.equal(sourceCategoryQualityIssue(altered), SOURCE_CATEGORY_ISSUE);
  }
  for (const reference of ["6806"]) {
    assert.equal(sourceCategoryQualityIssue(machine(reference)), SOURCE_CATEGORY_ISSUE, reference);
  }
});

test("F7: motores incompatibles e identidades contradictorias siguen en revisión", () => {
  const snorkel = machine("6236");
  assert.equal(prepareProduct(snorkel, catalog).status, "ready");
  assert.equal(prepareProduct({ ...snorkel, longDescription: "Identidad sin confirmar" }, catalog).status, "review");
  const batch = prepareImportBatch(source.products, catalog);
  assert.equal(batch.products.length, 1008);
  assert.equal(new Set(batch.products.map(({ product }) => product.reference)).size, 1008);
  for (const reference of ["6682", "6703"]) {
    const item = batch.products.find(({ product }) => product.reference === reference);
    assert.ok(item, reference);
    assert.equal(item.status, "review", reference);
  }
});
