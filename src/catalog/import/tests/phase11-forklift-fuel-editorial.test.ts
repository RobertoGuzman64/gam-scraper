import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { reconcileGamForkliftFuelEditorial } from "../mapping/providers/gam/forklift-fuel-editorial.js";
import { SOURCE_CATEGORY_ISSUE, sourceCategoryQualityIssue } from "../mapping/source-category-quality.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const source = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Fase 11: reconstruye el encabezado H4.0UT solo con motor, ficha y descripción diésel concordantes", () => {
  const record = source("3131");
  const original = JSON.stringify(record);
  assert.equal(sourceCategoryQualityIssue(record), SOURCE_CATEGORY_ISSUE);
  const corrected = reconcileGamForkliftFuelEditorial(record);
  assert.notStrictEqual(corrected, record);
  assert.equal(corrected.title, "Carretilla elevadora diésel Hyster H4.0UT");
  assert.strictEqual(corrected.specs, record.specs);
  assert.equal(corrected.shortDescription, record.shortDescription);
  assert.equal(corrected.longDescription, record.longDescription);
  assert.equal(sourceCategoryQualityIssue(corrected), null);
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.title, corrected.title);
  assert.deepEqual(prepared.product.spec, record.specs);
  assert.equal(JSON.stringify(record), original);
});

test("Fase 11: corrige solo el resumen H2.0AS con evidencia independiente de GLP", () => {
  const record = source("3130");
  const original = JSON.stringify(record);
  assert.equal(sourceCategoryQualityIssue(record), SOURCE_CATEGORY_ISSUE);
  const corrected = reconcileGamForkliftFuelEditorial(record);
  assert.notStrictEqual(corrected, record);
  assert.match(corrected.shortDescription ?? "", /Carretilla Elevadora GLP 3,8 metros/);
  assert.equal(corrected.title, record.title);
  assert.strictEqual(corrected.specs, record.specs);
  assert.equal(corrected.longDescription, record.longDescription);
  assert.equal(sourceCategoryQualityIssue(corrected), null);
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.product.spec, record.specs);
  assert.equal(prepared.product.description, corrected.shortDescription);
  assert.equal(JSON.stringify(record), original);
});

test("Fase 11: rechaza identidades, motorizaciones y textos manipulados", () => {
  const diesel = source("3131");
  const gas = source("3130");
  const variants: readonly ProductRecord[] = [
    { ...diesel, providerId: "gomariz" },
    { ...diesel, categoryKey: "otros" },
    { ...diesel, condition: "Segunda mano" },
    { ...diesel, brand: "YALE" },
    { ...diesel, model: "H5.0UT6" },
    { ...diesel, specs: { ...diesel.specs, "Marca": "YALE" } },
    { ...diesel, specs: { ...diesel.specs, "Modelo": "H5.0UT6" } },
    { ...diesel, specs: { ...diesel.specs, "Tipo motor": "GLP" } },
    { ...diesel, specs: { ...diesel.specs, "Motorización": "Eléctrico" } },
    { ...diesel, shortDescription: "Carretilla industrial sin motorización" },
    { ...diesel, longDescription: "La carretilla H4.0UT consume GLP" },
    { ...diesel, url: diesel.url.replace("diesel-hyster", "electricas-hyster") },
    { ...diesel, title: "Carretilla elevadora GLP Hyster H4.0UT6" },
    { ...gas, specs: { ...gas.specs, "Tipo motor": "Diésel" } },
    { ...gas, specs: { ...gas.specs, "Motorización": "Diésel" } },
    { ...gas, title: "Carretilla elevadora diésel Hyster H2.0AS" },
    { ...gas, longDescription: "La carretilla H2.0AS tiene motor diésel" },
    { ...gas, shortDescription: "Equipo sin identidad de modelo ni motorización" },
    { ...gas, url: gas.url.replace("/carretillas-elevadoras-diesel-hyster/", "/yale/") },
    { ...gas, specs: { ...gas.specs, Modelo: "H4.0UT" } }
  ];
  for (const [index, record] of variants.entries()) {
    assert.strictEqual(reconcileGamForkliftFuelEditorial(record), record, String(index));
  }
  for (const reference of ["2071", "2311", "2312", "2313"]) {
    const record = source(reference);
    assert.strictEqual(reconcileGamForkliftFuelEditorial(record), record, reference);
    assert.equal(prepareProduct(record, catalog).status, "ready", reference);
  }
  for (const reference of ["2072", "2073"]) {
    assert.strictEqual(reconcileGamForkliftFuelEditorial(source(reference)), source(reference), reference);
  }
});

test("Fase 11: la ruta diésel no acredita un motor GLP por sí sola", () => {
  const record = source("3130");
  const normalized = reconcileGamForkliftFuelEditorial(record);
  assert.equal(sourceCategoryQualityIssue(normalized), null);
  for (const altered of [
    { ...normalized, specs: { ...normalized.specs, "Tipo motor": "Diésel" } },
    { ...normalized, specs: { ...normalized.specs, "Motorización": "Eléctrico" } },
    { ...normalized, shortDescription: "Carretilla elevadora GLP sin modelo" },
    { ...normalized, title: "Carretilla elevadora diésel Hyster H2.0AS" },
    { ...normalized, longDescription: "Motor diésel" },
    { ...normalized, url: normalized.url.replace("-h20as", "-h30as") }
  ]) {
    assert.equal(sourceCategoryQualityIssue(altered), SOURCE_CATEGORY_ISSUE);
  }
});

