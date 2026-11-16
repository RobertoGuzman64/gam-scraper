import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { prepareProduct } from "../../../../../commercial/legacy-export/prepare-product.js";
import { loadImportCatalog } from "../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { accreditedSourceSamples } from "../../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGamVerifiedSourceClaims } from "../../models/gam-verified-source-claims.js";

const cases = [
  { reference: "4778", field: "longDescription", oldValue: "capacidad de carga de 230 kg", newValue: "capacidad de carga de 320 kg", spec: "320 KG", key: "Capacidad de carga (kg)" },
  { reference: "3189", field: "shortDescription", oldValue: "Capacidad de carga de 6000 kg", newValue: "Capacidad de carga de 41000 kg", spec: "41000 KG", key: "Capacidad de carga (kg)" },
  { reference: "6723", field: "shortDescription", oldValue: "Capacidad de carga de 1900 kg", newValue: "Capacidad de carga de 1800 kg", spec: "1800 KG", key: "Capacidad de carga (kg)" },
  { reference: "6702", field: "longDescription", oldValue: "altura de elevación de 4,6 metros", newValue: "altura de elevación de 3,6 metros", spec: "3600 mm", key: "Altura de elevación (mm)" },
  { reference: "3134", field: "longDescription", oldValue: "altura de elevación de 4.4 metros", newValue: "altura de elevación de 4,7 metros", spec: "4700 mm", key: "Altura de elevación (mm)" }
] as const;

const source = (reference: string): ProductRecord => {
  for (const dataset of ["gam-original", "gam-source-cases", "editorial-load-original"] as const) {
    const record = accreditedSourceSamples(dataset).find((row) => row.reference === reference);
    if (record) return record;
  }
  throw new Error(`Original acreditado ausente: ${reference}`);
};

const catalog = await loadImportCatalog();

test("GAM: cinco incoherencias de capacidad y altura se resuelven con fuente y ficha acreditadas", () => {
  for (const { reference, field, oldValue, newValue, spec, key } of cases) {
    const record = source(reference);
    const snapshot = JSON.stringify(record);
    const corrected = reconcileGamVerifiedSourceClaims(record);
    assert.notStrictEqual(corrected, record, reference);
    assert.ok(record[field]?.includes(oldValue), reference);
    assert.ok(corrected[field]?.includes(newValue), reference);
    assert.ok(!corrected[field]?.includes(oldValue), reference);
    assert.deepEqual(corrected.specs, record.specs, reference);
    assert.equal(corrected.specs?.[key], spec, reference);
    assert.equal(corrected.url, record.url, reference);
    assert.equal(corrected.reference, reference);
    assert.equal(corrected.model, record.model);
    assert.equal(corrected.brand, record.brand);
    assert.equal(JSON.stringify(record), snapshot, reference);
    assert.strictEqual(reconcileGamVerifiedSourceClaims(corrected), corrected, reference);
    for (const prepared of [prepareSourceProduct(record), prepareProduct(record, catalog)]) {
      assert.equal(prepared.status, "ready", `${reference}: ${prepared.issues.join("; ")}`);
      assert.deepEqual(prepared.issues, [], reference);
      assert.equal(prepared.product.sourceUrl, record.url, reference);
      assert.equal(prepared.product.reference, reference);
      assert.equal(prepared.product.spec[key], spec, reference);
    }
  }
});

test("GAM: una evidencia de unidad no se extiende a otros proveedores, fuentes, versiones ni variantes", () => {
  for (const { reference, key } of cases) {
    const record = source(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: `OTRA-${reference}` },
      { ...record, url: `${record.url}?otra-version=true` },
      { ...record, brand: "OTRA" },
      { ...record, model: "OTRO" },
      { ...record, condition: record.condition === "Nuevo" ? "Segunda mano" : "Nuevo" },
      { ...record, categoryKey: "otra-categoria" },
      { ...record, title: `${record.title} distinta` },
      { ...record, shortDescription: `${record.shortDescription} edición posterior` },
      { ...record, longDescription: `${record.longDescription} edición posterior` },
      { ...record, specs: { ...record.specs, [key]: "9999 KG" } },
      { ...record, specs: { ...record.specs, Modelo: "OTRO" } },
      { ...record, specs: { ...record.specs, Peso: "9999 KG" } }
    ];
    for (const variant of variants) {
      assert.strictEqual(reconcileGamVerifiedSourceClaims(variant), variant, `${reference}: ${variant.url}`);
    }
  }
});

test("GAM: no se reconcilian capacidades con fuentes incompatibles", () => {
  for (const reference of ["4739", "6934"]) {
    const record = source(reference);
    assert.strictEqual(reconcileGamVerifiedSourceClaims(record), record, reference);
    assert.equal(prepareSourceProduct(record).status, "review", reference);
  }
});
