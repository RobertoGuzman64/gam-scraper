import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { prepareProduct } from "../../../../../commercial/legacy-export/prepare-product.js";
import { loadImportCatalog } from "../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { accreditedSourceRecord } from "../../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGamVerifiedManufacturerLoad } from "../../models/gam-verified-manufacturer-load.js";

const catalog = await loadImportCatalog();
const source = (reference: string): ProductRecord => accreditedSourceRecord("gam-original", reference);

const capacities = [
  { reference: "50", capacity: "1400 KG", wrong: "2000 kg", corrected: "1400 kg" },
  { reference: "2159", capacity: "280 KG", wrong: "180 kg", corrected: "280 kg" },
  { reference: "2237", capacity: "1000 KG", wrong: "2000", corrected: "1000" },
  { reference: "2240", capacity: "2500 KG", wrong: "2000", corrected: "2500" }
] as const;

test("GAM: cuatro cargas corroboradas por fabricante se concilian sin alterar originales ni ficha técnica", () => {
  for (const { reference, capacity, wrong, corrected } of capacities) {
    const record = source(reference);
    const originalSnapshot = JSON.stringify(record);
    const reconciled = reconcileGamVerifiedManufacturerLoad(record);
    assert.notStrictEqual(reconciled, record, reference);
    assert.equal(reconciled.reference, record.reference, reference);
    assert.equal(reconciled.url, record.url, reference);
    assert.equal(reconciled.brand, record.brand, reference);
    assert.equal(reconciled.model, record.model, reference);
    assert.deepEqual(reconciled.specs, record.specs, reference);
    assert.equal(reconciled.specs?.["Capacidad de carga (kg)"], capacity, reference);
    assert.notDeepEqual([reconciled.title, reconciled.shortDescription, reconciled.longDescription],
      [record.title, record.shortDescription, record.longDescription], reference);
    assert.ok(JSON.stringify([reconciled.title, reconciled.shortDescription, reconciled.longDescription]).includes(corrected), reference);
    assert.equal(JSON.stringify([reconciled.title, reconciled.shortDescription, reconciled.longDescription]).includes(wrong), false, reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.issues, [], reference);
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.equal(prepared.product.spec["Capacidad de carga (kg)"], capacity, reference);
    const commercial = prepareProduct(record, catalog);
    assert.equal(commercial.status, "ready", reference);
    assert.deepEqual(commercial.issues, [], reference);
    assert.equal(JSON.stringify(record), originalSnapshot, reference);
  }
});

test("GAM: los datos técnicos verificados resuelven los textos comerciales cruzados sin inventar características", () => {
  const bravi = reconcileGamVerifiedManufacturerLoad(source("2159"));
  assert.match(bravi.shortDescription ?? "", /capacidad de carga de 280 kg/u);
  assert.match(bravi.longDescription ?? "", /peso de 1\.250 kg/u);
  assert.deepEqual(bravi.specs, source("2159").specs);

  const yaleSmall = reconcileGamVerifiedManufacturerLoad(source("2237"));
  assert.match(yaleSmall.title ?? "", /1000 Kg Yale MO10L/u);
  assert.match(yaleSmall.longDescription ?? "", /capacidad de carga de 1000 kilogramos/u);
  assert.equal(yaleSmall.year, null);
  assert.equal(yaleSmall.yearSource, null);

  const yaleBig = reconcileGamVerifiedManufacturerLoad(source("2240"));
  assert.match(yaleBig.shortDescription ?? "", /Capacidad de carga de 2500 kg/u);
  assert.match(yaleBig.longDescription ?? "", /el MO25 es sinónimo/u);
  assert.doesNotMatch(yaleBig.longDescription ?? "", /el MO10L/u);
  assert.equal(yaleBig.year, null);
  assert.equal(yaleBig.yearSource, null);
});

test("GAM: una evidencia no se reaplica sobre una ficha ya corregida", () => {
  for (const { reference } of capacities) {
    const corrected = reconcileGamVerifiedManufacturerLoad(source(reference));
    assert.strictEqual(reconcileGamVerifiedManufacturerLoad(corrected), corrected, reference);
  }
});

test("GAM: no se extienden correcciones a otras unidades, proveedores, fuentes o especificaciones", () => {
  for (const { reference } of capacities) {
    const record = source(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: `OTRA-${reference}` },
      { ...record, url: `https://online.gamrentals.com/es/otra/${reference}-otra-maquina` },
      { ...record, url: `${record.url}?origen=otro` },
      { ...record, brand: "OTRA" },
      { ...record, model: "OTRO" },
      { ...record, title: `${record.title} otra variante` },
      { ...record, condition: "Segunda mano" },
      { ...record, categoryKey: "otra-categoria" },
      { ...record, shortDescription: `${record.shortDescription} Otro dato no corroborado` },
      { ...record, longDescription: `${record.longDescription} Variante no corroborada.` },
      { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "9999 KG" } },
      { ...record, specs: { ...record.specs, Modelo: "OTRO" } },
      { ...record, specs: { ...record.specs, Peso: "9999 KG" } }
    ];
    for (const candidate of variants) {
      assert.strictEqual(reconcileGamVerifiedManufacturerLoad(candidate), candidate, `${reference}:${candidate.url}`);
    }
  }
});

test("GAM: las capacidades no corroboradas siguen retenidas", () => {
  for (const reference of ["6934", "4739"]) {
    const record = source(reference);
    assert.strictEqual(reconcileGamVerifiedManufacturerLoad(record), record, reference);
    assert.equal(prepareSourceProduct(record).status, "review", reference);
  }
});
