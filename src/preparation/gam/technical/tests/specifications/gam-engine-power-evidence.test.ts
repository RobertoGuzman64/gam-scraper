import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../catalog/normalization/normalize-specs.js";
import { recoverGamVerifiedEnginePowerSpecs } from "../../evidence/energy-and-powertrain/motor-configuration-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const ofReference = (reference: string) => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

const expected: ReadonlyArray<readonly [string, number]> = [
  ["4748", 18.2], ["4749", 18.2], ["4779", 36.8], ["6542", 54.6],
  ["4782", 36], ["4783", 36.8], ["4790", 55], ["4791", 55.4], ["4793", 95],
  ["2058", 129], ["2060", 129], ["2063", 129], ["2062", 129],
  ["2064", 129], ["2068", 129], ["2065", 129], ["2069", 129],
  ["2067", 129], ["2070", 129], ["6182", 51.7]
];

test("recupera potencias propias verificables y conserva los datos originales", () => {
  for (const [reference, power] of expected) {
    const original = ofReference(reference);
    const snapshot = structuredClone(original);
    const candidate = prepareSourceProduct(original).product;
    const normalized = normalizeSpecsObject(candidate.spec);
    assert.deepEqual(normalized.normalized["Potencia (kW)"], [power], reference);
    assert.ok(!normalized.unknownKeys.includes("Potencia (kW)"), reference);
    for (const [key, value] of Object.entries(original.specs ?? {})) {
      assert.deepEqual(candidate.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(original, snapshot, reference);
  }
  assert.equal(expected.length, 20);
});

test("rechaza errores de identidad, motor y potencias inconsistentes", () => {
  for (const reference of ["2058", "4748", "6182"]) {
    const record = ofReference(reference);
    for (const bad of [
      { ...record, providerId: "gomariz" },
      { ...record, condition: "Segunda mano" as const },
      { ...record, brand: "OTRO" },
      { ...record, model: "OTRO" },
      { ...record, title: "Equipo sin identidad" },
      { ...record, reference: "999999" },
      { ...record, url: record.url.replace(`${reference}-`, "999999-") },
      { ...record, specs: { ...record.specs, Marca: "OTRA" } },
      { ...record, specs: { ...record.specs, "Potencia (kW)": "99 kW" } },
      { ...record, longDescription: `${record.longDescription} Otro motor de 175 kW.` }
    ]) {
      assert.deepEqual(recoverGamVerifiedEnginePowerSpecs(bad), bad.specs ?? {}, `${reference}: rechazo`);
    }
  }
  const hyst = ofReference("2058");
  assert.deepEqual(recoverGamVerifiedEnginePowerSpecs({
    ...hyst, longDescription: `${hyst.longDescription} Motor Kubota de 129 kW.`
  }), hyst.specs);
  const xcmg = ofReference("4748");
  assert.deepEqual(recoverGamVerifiedEnginePowerSpecs({
    ...xcmg, longDescription: `${xcmg.longDescription} Motor: Yuchai de 18,2 kW.`
  }), xcmg.specs);
  for (const reference of ["2041", "2042", "2071", "6274", "1884", "2092", "5992", "6002"]) {
    const record = ofReference(reference);
    assert.deepEqual(recoverGamVerifiedEnginePowerSpecs(record), record.specs ?? {}, reference);
  }
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamVerifiedEnginePowerSpecs(record), record.specs ?? {});
  }
});
