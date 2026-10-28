import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { reconcileGamVerifiedYaleGc60vx } from "../evidence/providers/gam/yale-gc60vx-evidence.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const record = source.products.find((item) => item.reference === "2314");
assert.ok(record);

test("Yale GC60VX reconcilia la motorización declarada sin modificar el spec original", () => {
  const original = structuredClone(record);
  const corrected = reconcileGamVerifiedYaleGc60vx(record);
  assert.notStrictEqual(corrected, record);
  assert.equal(corrected.title, record.title);
  assert.equal(corrected.specs?.["Motorización"], "Diésel");
  assert.equal(record.specs?.["Motorización"], "Eléctrico");
  assert.equal(corrected.specs?.["Tipo motor"], "Kubota 3.8L Diesel / PSI 4.3L LPG");
  assert.ok(corrected.shortDescription?.includes("5,6 metros"));
  assert.ok(!corrected.longDescription?.includes("Diésel a Pie"));
  assert.ok(corrected.longDescription?.includes("Diésel Yale GC60VX"));
  assert.strictEqual(reconcileGamVerifiedYaleGc60vx(corrected), corrected);
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.category, "Carretillas Elevadoras Diésel");
  assert.equal(prepared.product.title, record.title);
  assert.equal(prepared.product.description, corrected.shortDescription);
  assert.equal(prepared.product.description_general, corrected.longDescription);
  assert.deepEqual(prepared.product.spec, original.specs);
  assert.deepEqual(record, original);
});

test("Yale GC60VX no modifica variantes con identidad o evidencias divergentes", () => {
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "mercaeleva" },
    { ...record, reference: "2313" },
    { ...record, categoryKey: "maquinaria" },
    { ...record, condition: "Segunda mano" },
    { ...record, url: `${record.url}?edition=2027` },
    { ...record, externalReference: "GC55VX" },
    { ...record, brand: "HYSTER" },
    { ...record, model: "GC55VX" },
    { ...record, title: "Carretilla elevadora eléctrica Yale GC60VX" },
    { ...record, shortDescription: `${record.shortDescription ?? ""} otra potencia` },
    { ...record, longDescription: `${record.longDescription ?? ""} otro motor` },
    { ...record, longDescription: null },
    { ...record, specs: { ...record.specs, Modelo: "GC55VX" } },
    { ...record, specs: { ...record.specs, "Motorización": "Diésel" } },
    { ...record, specs: { ...record.specs, "Tipo motor": "Batería" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "5500 KG" } },
    { ...record, specs: { ...record.specs, "Altura de elevación (mm)": "6000 mm" } },
    { ...record, specs: { ...record.specs, Peso: "9500 KG" } }
  ];
  for (const [index, item] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedYaleGc60vx(item), item, String(index));
  }
  for (const item of source.products) {
    if (item.reference !== "2314") assert.strictEqual(reconcileGamVerifiedYaleGc60vx(item), item, item.reference ?? "");
  }
});

