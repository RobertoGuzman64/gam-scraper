import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { reconcileGamHandlingCapacityEditorial } from "../mapping/providers/gam/handling-capacity-editorial.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("storage/scraped/gomariz/scrape-gomariz-catalog.json");
const mercaeleva = await readCanonicalCatalog("storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json");
const source = (reference: string): ProductRecord => {
  const found = gam.products.find((item) => item.reference === reference);
  assert.ok(found, reference);
  return found;
};

test("Fase 14: TOYOTA LWE180 utiliza capacidad técnica de 1800 kg sin alterar specs", () => {
  const original = source("6723");
  const input = JSON.stringify(original);
  const normalized = reconcileGamHandlingCapacityEditorial(original);
  assert.notStrictEqual(normalized, original);
  assert.equal(normalized.title, original.title);
  assert.ok(normalized.shortDescription?.includes("Capacidad de carga de 1800 kg"));
  assert.ok(normalized.longDescription?.includes("capacidad de carga de 1800 kg"));
  assert.strictEqual(normalized.specs, original.specs);
  assert.equal(normalized.url, original.url);
  assert.equal(JSON.stringify(original), input);
  const prepared = prepareProduct(original, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.deepEqual(prepared.product.spec, original.specs);
  assert.equal(prepared.product.description, normalized.shortDescription);
  assert.equal(prepared.product.description_general, normalized.longDescription);
  assert.ok(prepared.product.attributes.some((item) => item.value === 1800));
});

test("Fase 14: YALE GDP160EF12 conserva los 16000 kg corroborados en ficha y descripción", () => {
  const original = source("2211");
  const input = JSON.stringify(original);
  const normalized = reconcileGamHandlingCapacityEditorial(original);
  assert.notStrictEqual(normalized, original);
  assert.equal(normalized.title, "Carretilla elevadora diésel 16000Kg Yale GDP160EF12");
  assert.ok(normalized.shortDescription?.includes("Capacidad de carga de 16000 kg"));
  assert.equal(normalized.longDescription, original.longDescription);
  assert.strictEqual(normalized.specs, original.specs);
  assert.equal(normalized.url, original.url);
  assert.equal(JSON.stringify(original), input);
  const prepared = prepareProduct(original, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.deepEqual(prepared.product.spec, original.specs);
  assert.equal(prepared.product.title, normalized.title);
  assert.equal(prepared.product.description, normalized.shortDescription);
  assert.ok(prepared.product.attributes.some((item) => item.value === 16000));
});

test("Fase 14: identidad, categoría, especificaciones y evidencia editorial son indispensables", () => {
  const toyota = source("6723");
  const wrongToyota: readonly ProductRecord[] = [
    { ...toyota, providerId: "mercaeleva" },
    { ...toyota, condition: "Nuevo" },
    { ...toyota, categoryKey: "carretillas-nuevas" },
    { ...toyota, brand: "YALE" },
    { ...toyota, model: "LWE200" },
    { ...toyota, specs: { ...toyota.specs, Marca: "YALE" } },
    { ...toyota, specs: { ...toyota.specs, Modelo: "LWE200" } },
    { ...toyota, specs: { ...toyota.specs, "Capacidad de carga (kg)": "1900 KG" } },
    { ...toyota, url: toyota.url.replace("lwe180", "lwe200") },
    { ...toyota, shortDescription: toyota.shortDescription?.replace("1900 kg", "2000 kg") ?? null },
    { ...toyota, longDescription: toyota.longDescription?.replace("1900 kg", "2000 kg") ?? null },
    { ...toyota, longDescription: `${toyota.longDescription} Otra capacidad de carga de 2000 kg.` }
  ];
  for (const [index, record] of wrongToyota.entries()) {
    assert.strictEqual(reconcileGamHandlingCapacityEditorial(record), record, `TOYOTA ${index}`);
  }
  const yale = source("2211");
  const wrongYale: readonly ProductRecord[] = [
    { ...yale, providerId: "mercaeleva" },
    { ...yale, condition: "Segunda mano" },
    { ...yale, categoryKey: "manutencion" },
    { ...yale, brand: "HYSTER" },
    { ...yale, model: "GDP180EF12" },
    { ...yale, specs: { ...yale.specs, Modelo: "GDP180EF12" } },
    { ...yale, specs: { ...yale.specs, "Capacidad de carga (kg)": "16400 KG" } },
    { ...yale, specs: { ...yale.specs, "Tipo motor": "GLP" } },
    { ...yale, specs: { ...yale.specs, "Motorización": "Eléctrico" } },
    { ...yale, url: yale.url.replace("gdp160ef12", "gdp180ef12") },
    { ...yale, shortDescription: yale.shortDescription?.replace("16400 kg", "15000 kg") ?? null },
    { ...yale, longDescription: yale.longDescription?.replace("16000 kg", "16400 kg") ?? null },
    { ...yale, longDescription: `${yale.longDescription} Capacidad de carga de 17000 kg.` }
  ];
  for (const [index, record] of wrongYale.entries()) {
    assert.strictEqual(reconcileGamHandlingCapacityEditorial(record), record, `YALE ${index}`);
  }
});

test("Fase 14: no altera las restantes 1006 fichas ni desbloquea conflictos técnicos reales", () => {
  const corrected = new Set(["6723", "2211"]);
  for (const item of gam.products) {
    if (!corrected.has(item.reference ?? "")) {
      assert.strictEqual(reconcileGamHandlingCapacityEditorial(item), item, item.reference ?? "sin referencia");
    }
  }
  for (const reference of ["2237", "2072", "2073", "2071", "6236", "4737", "4004"]) {
    assert.equal(prepareProduct(source(reference), catalog).status, "review", reference);
  }
  const results = [gam, gomariz, mercaeleva].map((batch) => prepareImportBatch(batch.products, catalog));
  assert.deepEqual(results.map((item) => item.totals), [
    { ready: 979, review: 29 },
    { ready: 143, review: 0 },
    { ready: 213, review: 5 }
  ]);
  assert.equal(results.reduce((total, item) => total + item.products.length, 0), 1369);
  assert.equal(new Set(results.flatMap((item) => item.products.map((prepared) => `${prepared.product.providerId}:${prepared.product.reference}`))).size, 1369);
});
