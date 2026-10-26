import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { reconcileGamVerifiedHandlingEditorial } from "../mapping/providers/gam/handling-verified-editorial.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const source = (reference: string): ProductRecord => {
  const record = gam.products.find((entry) => entry.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("HYSTER 6702 confirma 3600 mm y conserva la ficha de origen", () => {
  const record = source("6702");
  const input = JSON.stringify(record);
  const corrected = reconcileGamVerifiedHandlingEditorial(record);
  assert.notStrictEqual(corrected, record);
  assert.strictEqual(corrected.specs, record.specs);
  assert.equal(corrected.title, record.title);
  assert.equal(corrected.shortDescription, record.shortDescription);
  assert.equal(corrected.longDescription?.includes("altura de elevación de 3,6 metros"), true);
  assert.equal(corrected.longDescription?.includes("altura de elevación de 4,6 metros"), false);
  assert.equal(JSON.stringify(record), input);
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.deepEqual(prepared.product.spec, record.specs);
  assert.equal(prepared.product.description_general, corrected.longDescription);
  assert.ok(prepared.product.attributes.some((item) => item.value === 3600));
});

test("HYSTER 6272 normaliza la capacidad solo si el modelo y la ficha concuerdan", () => {
  const record = source("6272");
  const input = JSON.stringify(record);
  const corrected = reconcileGamVerifiedHandlingEditorial(record);
  assert.notStrictEqual(corrected, record);
  assert.strictEqual(corrected.specs, record.specs);
  assert.equal(corrected.title, record.title);
  assert.equal(corrected.longDescription, record.longDescription);
  assert.equal(corrected.shortDescription?.includes("Capacidad de carga de 12500 kg"), true);
  assert.equal(JSON.stringify(record), input);
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.deepEqual(prepared.product.spec, record.specs);
  assert.equal(prepared.product.description, corrected.shortDescription);
  assert.ok(prepared.product.attributes.some((item) => item.value === 12500));
});

test("variantes incompatibles de 6702 no reciben corrección", () => {
  const record = source("6702");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "mercaeleva" },
    { ...record, condition: "Nuevo" },
    { ...record, categoryKey: "carretillas-nuevas" },
    { ...record, brand: "YALE" },
    { ...record, model: "H2.5FT" },
    { ...record, year: "2018" },
    { ...record, specs: { ...record.specs, Marca: "YALE" } },
    { ...record, specs: { ...record.specs, Modelo: "H2.5FT" } },
    { ...record, specs: { ...record.specs, "Nº de serie": "P177B09052T" } },
    { ...record, specs: { ...record.specs, "Altura de elevación (mm)": "4600 mm" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "3000 KG" } },
    { ...record, specs: { ...record.specs, "Año de fabricación": "2018" } },
    { ...record, url: record.url.replace("2019-", "2018-") },
    { ...record, shortDescription: "Año 2018" },
    { ...record, longDescription: record.longDescription?.replace("fabricada en 2019", "fabricada en 2025") ?? null },
    { ...record, longDescription: `${record.longDescription} Otro mástil con altura de elevación de 6 metros.` }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedHandlingEditorial(variant), variant, String(index));
  }
});

test("variantes incompatibles de 6272 no reciben corrección", () => {
  const record = source("6272");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "mercaeleva" },
    { ...record, condition: "Segunda mano" },
    { ...record, categoryKey: "manutencion" },
    { ...record, brand: "YALE" },
    { ...record, model: "H16XD-12" },
    { ...record, specs: { ...record.specs, Marca: "YALE" } },
    { ...record, specs: { ...record.specs, Modelo: "H16XD-12" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "12000 KG" } },
    { ...record, specs: { ...record.specs, "Tipo motor": "GLP" } },
    { ...record, url: record.url.replace("h12xd-12", "h16xd-12") },
    { ...record, title: "Carretilla elevadora diésel 12000Kg Hyster H12XD-12" },
    { ...record, shortDescription: record.shortDescription?.replace("12000 kg", "11000 kg") ?? null },
    { ...record, longDescription: record.longDescription?.replace("12.500 kg", "12.000 kg") ?? null },
    { ...record, longDescription: `${record.longDescription} Capacidad nominal adicional de 11.000 kg.` }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedHandlingEditorial(variant), variant, String(index));
  }
});

test("los demás anuncios no reciben reconciliación Hyster", () => {
  for (const record of gam.products) {
    if (["6702", "6272"].includes(record.reference ?? "")) continue;
    assert.strictEqual(reconcileGamVerifiedHandlingEditorial(record), record, record.reference ?? "sin ref");
  }
});
