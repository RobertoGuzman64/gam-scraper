import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { reconcileGamHandlingHeightEditorial } from "../mapping/providers/gam/handling-height-editorial.js";
import { reconcileGamOrderPickerEditorial } from "../mapping/providers/gam/orderpicker-editorial.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const sourceCatalog = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");

const source = (reference: string): ProductRecord => {
  const record = sourceCatalog.products.find((item) => item.reference === reference);
  assert.ok(record);
  return record;
};

test("Fase 13: altura editorial solo con resumen, ficha técnica e identidad concordantes", () => {
  const record = source("3134");
  const original = JSON.stringify(record);
  const corrected = reconcileGamHandlingHeightEditorial(record);
  assert.notStrictEqual(corrected, record);
  assert.ok(corrected.longDescription?.includes("altura de elevación de 4,7 metros"));
  assert.equal(corrected.shortDescription, record.shortDescription);
  assert.equal(corrected.title, record.title);
  assert.strictEqual(corrected.specs, record.specs);
  assert.equal(prepareProduct(record, catalog).status, "ready");
  assert.equal(prepareProduct(record, catalog).product.description_general, corrected.longDescription);
  assert.equal(JSON.stringify(record), original);
});

test("Fase 13: alturas diferentes o identidad alterada no generan corrección", () => {
  const record = source("3134");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, categoryKey: "manutencion" },
    { ...record, condition: "Segunda mano" },
    { ...record, brand: "YALE" },
    { ...record, model: "H4.0UT6" },
    { ...record, specs: { ...record.specs, Marca: "YALE" } },
    { ...record, specs: { ...record.specs, Modelo: "H4.0UT6" } },
    { ...record, specs: { ...record.specs, "Tipo motor": "GLP" } },
    { ...record, specs: { ...record.specs, "Motorización": "Eléctrico" } },
    { ...record, longDescription: `${record.longDescription ?? ""} Motor GLP.` },
    { ...record, specs: { ...record.specs, "Altura de elevación (mm)": "4400 mm" } },
    { ...record, shortDescription: record.shortDescription?.replace("4,7 metros", "5,7 metros") ?? null },
    { ...record, longDescription: record.longDescription?.replace("4.4 metros", "4.4 y 4.7 metros") ?? null },
    { ...record, url: record.url.replace("diesel-hyster", "electricas-hyster") },
    { ...record, title: "Carretilla elevadora diésel Hyster H4.0UT6" },
    { ...record, longDescription: "Modelo H5.0UT6, con altura 4.4 metros" }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamHandlingHeightEditorial(variant), variant, String(index));
  }
  for (const reference of ["5275", "5864", "6887"]) {
    const other = source(reference);
    assert.strictEqual(reconcileGamHandlingHeightEditorial(other), other);
    assert.equal(prepareProduct(other, catalog).status, "review");
  }
});

test("Fase 13: preparapedidos conserva los datos de origen y corrige solo el texto duplicado de otro modelo", () => {
  const record = source("2240");
  const original = JSON.stringify(record);
  const corrected = reconcileGamOrderPickerEditorial(record);
  assert.notStrictEqual(corrected, record);
  assert.ok(corrected.shortDescription?.includes("Capacidad de carga de 2500 kg"));
  assert.ok(corrected.longDescription?.includes("capacidad de carga de 2500 kilogramos"));
  assert.doesNotMatch(corrected.longDescription ?? "", /\bMO10L\b/);
  assert.strictEqual(corrected.specs, record.specs);
  assert.equal(corrected.title, record.title);
  assert.equal(prepareProduct(record, catalog).status, "ready");
  assert.equal(prepareProduct(record, catalog).product.description, corrected.shortDescription);
  assert.equal(prepareProduct(record, catalog).product.description_general, corrected.longDescription);
  assert.equal(JSON.stringify(record), original);
});

test("Fase 13: no corrige preparapedidos con ficha, modelo o fuente discordantes", () => {
  const record = source("2240");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" },
    { ...record, categoryKey: "marcas-nuevas" },
    { ...record, model: "MO10L" },
    { ...record, specs: { ...record.specs, Modelo: "MO10L" } },
    { ...record, specs: { ...record.specs, Marca: "HYSTER" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "2000 KG" } },
    { ...record, title: "Preparapedidos 2000 Kg Yale MO25" },
    { ...record, shortDescription: record.shortDescription?.replace("2000 kg", "2500 kg") ?? null },
    { ...record, longDescription: record.longDescription?.replace("de 2000 kilogramos", "de 1800 kilogramos") ?? null },
    { ...record, longDescription: record.longDescription?.replace("MO10L", "MO20L").replace("MO25", "MO20L") ?? null },
    { ...record, url: record.url.replace("recogepedidos-yale", "recogepedidos-hyster") },
    { ...record, shortDescription: "Ficha sin modelo" }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamOrderPickerEditorial(variant), variant, String(index));
  }
  for (const reference of ["2237", "2311", "2312"]) {
    const other = source(reference);
    assert.strictEqual(reconcileGamOrderPickerEditorial(other), other);
    assert.equal(prepareProduct(other, catalog).status, "review");
  }
});

test("Fase 13: recuperación por lote, sin aprobar conflictos técnicos de origen", () => {
  const batch = prepareImportBatch(sourceCatalog.products, catalog);
  assert.deepEqual(batch.totals, { ready: 979, review: 29 });
  assert.equal(new Set(batch.products.map((item) => item.product.reference)).size, 1008);
  for (const reference of ["3134", "2240"]) {
    assert.equal(batch.products.find((item) => item.product.reference === reference)?.status, "ready", reference);
  }
  for (const reference of ["2237", "2311", "2312", "2313", "2314", "6834", "6236", "6622", "6682", "6703", "4737", "4802", "5275", "6887"]) {
    assert.equal(batch.products.find((item) => item.product.reference === reference)?.status, "review", reference);
  }
});
