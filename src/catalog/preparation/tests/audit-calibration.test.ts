import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { SOURCE_CATEGORY_ISSUE, sourceCategoryQualityIssue } from "../source/category-quality.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
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

test("la barredora-fregadora documentada se clasifica como máquina multifunción", () => {
  for (const reference of ["4019", "4020", "4021"]) assertCalibrated(reference);
});

test("la máquina mixta no se confirma por palabras sueltas, variantes o rutas ajenas", () => {
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

test("vehículo con identidad técnica y descripción explícita no exige matrícula", () => {
  const record = machine("5254");
  assert.equal(record.specs?.["Matrícula"], undefined);
  assert.equal(record.specs?.["Kilómetros"], undefined);
  assertCalibrated("5254");
});

test("la clasificación del vehículo sigue exigiendo evidencias independientes", () => {
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
});

test("una identidad alterada de Snorkel permanece en revisión", () => {
  const snorkel = machine("6236");
  assert.equal(prepareProduct(snorkel, catalog).status, "ready");
  assert.equal(prepareProduct({ ...snorkel, longDescription: "Identidad sin confirmar" }, catalog).status, "review");
});
