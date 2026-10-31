import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamElectricMotorPowerSpecs } from "../evidence/providers/gam/electric-motor-power-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const recordOf = (reference: string) => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM distingue las potencias de tracción y elevación medidas en kW", () => {
  for (const [reference, traction, lifting] of [
    ["2030", 6.5, 8.6], ["2034", 11.5, 15], ["6425", 11.5, 15],
    ["5995", 40, 40], ["4388", 0.35, 2.2], ["2038", 10, null],
    ["2011", null, 12], ["6480", null, 2.5]
  ] as const) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    const normalized = normalizeSpecsObject(prepared.product.spec);
    assert.deepEqual(normalized.normalized["Potencia de tracción (kW)"], traction === null ? undefined : [traction], reference);
    assert.deepEqual(normalized.normalized["Potencia de elevación (kW)"], lifting === null ? undefined : [lifting], reference);
    assert.ok(!normalized.unknownKeys.includes("Potencia de tracción (kW)"));
    assert.ok(!normalized.unknownKeys.includes("Potencia de elevación (kW)"));
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original);
  }
});

test("GAM rechaza identidades, variantes y potencias eléctricas discordantes", () => {
  const record = recordOf("2030");
  for (const variant of [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" as const },
    { ...record, categoryKey: "elevacion-nueva" },
    { ...record, model: "J1.8UT" },
    { ...record, title: "Carretilla elevadora eléctrica Hyster J1.8UT" },
    { ...record, brand: "YALE" },
    { ...record, specs: { ...record.specs, Marca: "YALE" } },
    { ...record, reference: "2031" },
    { ...record, url: "https://online.gamrentals.com/es/hyster/2030-carretilla-j18ut" },
    { ...record, specs: { ...record.specs, "Potencia (kW)": "6,5 kW" } },
    { ...record, specs: { ...record.specs, "Potencia de tracción (kW)": "6,5 kW" } }
  ]) assert.deepEqual(recoverGamElectricMotorPowerSpecs(variant), variant.specs);

  const conflict = {
    ...record,
    longDescription: `${record.longDescription ?? ""} Motor de tracción de 7 kW y motor de elevación de 9 kW.`
  };
  assert.deepEqual(recoverGamElectricMotorPowerSpecs(conflict), record.specs);
});

test("la recuperación no incorpora potencias en proveedores ni fichas ajenas", () => {
  assert.ok(gomariz.products.every((record) =>
    JSON.stringify(recoverGamElectricMotorPowerSpecs(record)) === JSON.stringify(record.specs ?? {})));
  for (const reference of ["6422", "6423", "6745", "6746", "4750", "2087"]) {
    const record = recordOf(reference);
    assert.deepEqual(recoverGamElectricMotorPowerSpecs(record), record.specs ?? {}, reference);
  }
});
