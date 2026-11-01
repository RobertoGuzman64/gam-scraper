import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamVerifiedBatteryPairSpecs } from "../evidence/providers/gam/battery-electrical-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const recordOf = (reference: string) => {
  const record = catalog.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera capacidades acreditadas por el original, con voltaje únicamente si es inequívoco", () => {
  for (const [reference, capacity, voltage] of [
    ["4733", 30, 24], ["4800", 310, 48], ["4765", 420, 48], ["4768", 420, 48],
    ["4772", 420, 48], ["4777", 400, 48], ["3799", 192, null], ["3800", 192, null],
    ["3801", 192, null], ["3803", 192, null], ["2649", 200, null]
  ] as const) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const result = prepareSourceProduct(record);
    const normalized = normalizeSpecsObject(result.product.spec);
    assert.deepEqual(normalized.normalized["Capacidad de la batería (Ah)"], [capacity], reference);
    if (voltage !== null) assert.equal(normalized.normalized["Voltaje batería (V)"], voltage, reference);
    else assert.equal(result.product.spec["Voltaje batería (V)"], undefined, reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(result.product.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original, reference);
  }
});

test("no traspasa capacidades a referencias, variantes ni especificaciones contradictorias", () => {
  const record = recordOf("4777");
  for (const variant of [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "4776" },
    { ...record, model: "XGA22ACK1" },
    { ...record, brand: "HYSTER" },
    { ...record, specs: { ...record.specs, Marca: "HYSTER" } },
    { ...record, url: record.url.replace("4777-", "4776-") },
    { ...record, specs: { ...record.specs, "Capacidad de la batería (Ah)": "400 Ah" } },
    { ...record, specs: { ...record.specs, "Voltaje batería (V)": "24 V" } },
    { ...record, longDescription: `${record.longDescription} Existe otra batería de 48 V / 500 Ah.` },
    { ...record, longDescription: `${record.longDescription} El cargador requiere 220 V.` },
    { ...record, longDescription: `${record.longDescription} Otra capacidad disponible de 500 Ah.` }
  ]) assert.deepEqual(recoverGamVerifiedBatteryPairSpecs(variant), variant.specs ?? {});
  for (const reference of ["4731", "4776", "4659", "5988", "5992", "3802", "6421", "6422"]) {
    const excluded = recordOf(reference);
    assert.deepEqual(recoverGamVerifiedBatteryPairSpecs(excluded), excluded.specs ?? {}, reference);
  }
});

test("recupera depósitos y pendiente solo cuando la ficha original identifica el modelo", () => {
  for (const [reference, key, value] of [
    ["4018", "Depósito de recuperación", 360],
    ["4021", "Depósito de solución", 530],
    ["4021", "Depósito de recuperación", 276],
    ["6542", "Pendiente superable", "40%"]
  ] as const) {
    const prepared = prepareSourceProduct(recordOf(reference));
    assert.equal(prepared.product.spec[key], value, reference);
  }
  for (const reference of ["4018", "4021", "6542"]) {
    const record = recordOf(reference);
    for (const variant of [
      { ...record, reference: "9988" },
      { ...record, url: record.url.replace(`${reference}-`, "9988-") },
      { ...record, model: "OTRO MODELO" }
    ]) {
      const actual = prepareSourceProduct(variant).product.spec;
      for (const key of ["Depósito de recuperación", "Depósito de solución", "Pendiente superable"]) {
        if (!Object.hasOwn(record.specs ?? {}, key)) assert.equal(actual[key], undefined, `${reference}: ${key}`);
      }
    }
  }
});
