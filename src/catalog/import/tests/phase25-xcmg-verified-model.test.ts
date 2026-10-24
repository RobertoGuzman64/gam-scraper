import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { gamElevationIdentityConflict } from "../mapping/providers/gam/elevation-identity.js";
import { reconcileGamVerifiedXcmg1523Model } from "../mapping/providers/gam/xcmg-1523-model-evidence.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const records = ["4750", "4802"].map((reference) => {
  const record = source.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
});

for (const record of records) {
  const model = record.reference === "4750" ? "XG1523RT" : "XG1523ERT";
  test(`Fase 25: ${record.reference} recupera el modelo XCMG corroborado sin modificar el origen`, () => {
    const snapshot = JSON.stringify(record);
    assert.equal(gamElevationIdentityConflict(record), true);
    const reconciled = reconcileGamVerifiedXcmg1523Model(record);
    assert.notStrictEqual(reconciled, record);
    assert.equal(reconciled.model, model);
    assert.equal(reconciled.specs?.["Modelo"], model);
    assert.equal(gamElevationIdentityConflict(reconciled), false);
    assert.strictEqual(reconcileGamVerifiedXcmg1523Model(reconciled), reconciled);
    assert.equal(JSON.stringify(record), snapshot);
    const output = prepareProduct(record, catalog);
    assert.equal(output.status, "ready");
    assert.deepEqual(output.issues, []);
    assert.deepEqual(output.product.spec, record.specs);
    assert.equal(output.product.spec["Modelo"], record.specs?.["Modelo"]);
    assert.ok(output.product.attributes.some((attribute) => attribute.attributeID === 116 && attribute.value === model));
    assert.equal(output.product.description_general, record.longDescription);
    assert.equal(output.product.description, record.shortDescription);
    assert.equal(output.product.title, record.title);
  });

  test(`Fase 25: ${record.reference} exige coincidencia estricta de identidad y datos técnicos`, () => {
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "mercaeleva" },
      { ...record, reference: "4751" },
      { ...record, categoryKey: "elevacion" },
      { ...record, condition: "Segunda mano" },
      { ...record, url: record.url.replace(record.reference ?? "", "4751") },
      { ...record, title: `${record.title ?? ""} edición nueva` },
      { ...record, shortDescription: `${record.shortDescription ?? ""} edición nueva` },
      { ...record, brand: "JLG" },
      { ...record, model: model },
      { ...record, externalReference: "XG1418ERT" },
      { ...record, specs: { ...record.specs, Marca: "JLG" } },
      { ...record, specs: { ...record.specs, Modelo: model } },
      { ...record, specs: { ...record.specs, Peso: "9999 KG" } },
      { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "100 KG" } },
      { ...record, specs: { ...record.specs, "Tipo motor": "Híbrido" } },
      { ...record, longDescription: `${record.longDescription ?? ""} distinto` },
      { ...record, longDescription: null }
    ];
    for (const [index, variant] of variants.entries()) {
      assert.strictEqual(reconcileGamVerifiedXcmg1523Model(variant), variant, String(index));
    }
  });
}

test("Fase 25: conserva las 1008 fichas y mantiene los conflictos sin evidencia", () => {
  const batch = prepareImportBatch(source.products, catalog);
  assert.deepEqual(batch.totals, { ready: 999, review: 9 });
  assert.equal(new Set(batch.products.map((result) => result.product.reference)).size, 1008);
  for (const reference of ["6682", "6703", "6806", "6807", "6835", "6858"]) {
    const result = batch.products.find((item) => item.product.reference === reference);
    assert.ok(result, reference);
    assert.equal(result.status, "review", reference);
  }
  for (const record of source.products) {
    if (record.reference === "4750" || record.reference === "4802") continue;
    assert.strictEqual(reconcileGamVerifiedXcmg1523Model(record), record, record.reference ?? "");
  }
});
