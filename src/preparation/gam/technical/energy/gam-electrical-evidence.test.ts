import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../catalog/normalization/normalize-specs.js";
import { recoverGamElectricalBatterySpecs } from "./battery-electrical-evidence.js";
import { recoverGamMotorConfigurationSpecs, recoverGamVerifiedTwinMotorSpecs } from "./motor-configuration-evidence.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const recordOf = (reference: string) => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

const expected = [
  ["2096", { "Potencia (kW)": [82] }],
  ["5888", { "Potencia de tracción (kW)": [24] }],
  ["5889", { "Potencia de tracción (kW)": [24] }],
  ["5890", { "Potencia de tracción (kW)": [24] }],
  ["5998", { "Energía de batería (kWh)": 46.7 }],
  ["5993", { "Energía de batería (kWh)": 46.7 }],
  ["5999", { "Energía de batería (kWh)": 46.7 }],
  ["6000", { "Energía de batería (kWh)": 46.7 }],
  ["5994", { "Energía de batería (kWh)": 46.7 }],
  ["6001", { "Energía de batería (kWh)": 80.8 }],
  ["5995", { "Energía de batería (kWh)": 80.8 }],
  ["5996", { "Energía de batería (kWh)": 80.8 }],
  ["5997", { "Energía de batería (kWh)": 80.8 }],
  ["3801", { "Potencia de elevación (kW)": [60] }],
  ["3803", { "Potencia de elevación (kW)": [60] }],
  ["1884", { "Voltaje batería (V)": 80, "Capacidad de la batería (Ah)": [1085] }],
  ["1885", { "Voltaje batería (V)": 96, "Capacidad de la batería (Ah)": [1240] }],
  ["1886", { "Voltaje batería (V)": 96, "Capacidad de la batería (Ah)": [1395] }],
  ["1887", { "Voltaje batería (V)": 96, "Capacidad de la batería (Ah)": [1395] }],
  ["4024", { "Capacidad de la batería (Ah)": [110] }],
  ["6990", { "Potencia de tracción (kW)": [1], "Potencia de elevación (kW)": [0.8] }],
  ["5903", { "Capacidad de la batería (Ah)": [48] }]
] as const;

test("recupera medidas eléctricas GAM solo de las fichas acreditables", () => {
  for (const [reference, measures] of expected) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    const normalized = normalizeSpecsObject(prepared.product.spec);
    for (const [key, value] of Object.entries(measures)) {
      assert.deepEqual(normalized.normalized[key], value, `${reference}: ${key}`);
      assert.ok(!normalized.unknownKeys.includes(key), reference);
    }
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], value, `${reference}: no sobrescribir ${key}`);
    }
    assert.deepEqual(record, original, reference);
  }
});

test("protege el enlace entre modelo, fabricante, URL y ficha de origen", () => {
  for (const reference of ["1884", "5998", "5888", "5903"] as const) {
    const record = recordOf(reference);
    for (const invalid of [
      { ...record, condition: "Segunda mano" as const },
      { ...record, providerId: "gomariz" },
      { ...record, brand: "OTRA" },
      { ...record, model: "OTRO MODELO" },
      { ...record, title: "Otro equipo sin identidad" },
      { ...record, reference: "999999" },
      { ...record, url: `https://online.gamrentals.com/es/otro/${record.reference}-equipo` },
      { ...record, specs: { ...record.specs, Marca: "OTRA" } }
    ]) {
      assert.deepEqual(recoverGamElectricalBatterySpecs(invalid), invalid.specs ?? {}, reference);
      assert.deepEqual(recoverGamMotorConfigurationSpecs(invalid), invalid.specs ?? {}, reference);
    }
  }
});

test("no elige entre capacidades, energías o potencias contradictorias", () => {
  const energy = recordOf("5998");
  const conflictingEnergy = { ...energy, longDescription: `${energy.longDescription} Otra batería de 80,8 kWh.` };
  assert.deepEqual(recoverGamElectricalBatterySpecs(conflictingEnergy), energy.specs);

  const crane = recordOf("1884");
  const conflictingCrane = { ...crane, longDescription: `${crane.longDescription} Alimentación: 96 Voltios 1395 Ah.` };
  assert.deepEqual(recoverGamElectricalBatterySpecs(conflictingCrane), crane.specs);

  const motor = recordOf("5888");
  const conflictingMotor = { ...motor, longDescription: `${motor.longDescription} Tracción eléctrica de doble motor de 10 kW y 2 x 10 kW.` };
  assert.deepEqual(recoverGamMotorConfigurationSpecs(conflictingMotor), motor.specs);

  for (const reference of ["5988", "5989", "5990", "5991", "5992", "6002", "6003", "6004", "6422", "6745"]) {
    const record = recordOf(reference);
    assert.deepEqual(recoverGamElectricalBatterySpecs(record), record.specs ?? {}, reference);
    assert.deepEqual(recoverGamMotorConfigurationSpecs(record), record.specs ?? {}, reference);
  }
});

test("no modifica las fichas Gomariz", () => {
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamElectricalBatterySpecs(record), record.specs ?? {});
    assert.deepEqual(recoverGamMotorConfigurationSpecs(record), record.specs ?? {});
  }
});

test("distingue los dos motores de tracción de los circuitos auxiliares y no mezcla variantes", () => {
  const cases = [
    ["1884", 12], ["1885", 30], ["1886", 40], ["1887", 50],
    ["4772", 6.6], ["5891", 24]
  ] as const;
  for (const [reference, power] of cases) {
    const record = recordOf(reference);
    const snapshot = structuredClone(record);
    const prepared = prepareSourceProduct(record).product.spec;
    assert.deepEqual(normalizeSpecsObject(prepared).normalized["Potencia de tracción (kW)"], [power], reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, snapshot, reference);
    for (const invalid of [
      { ...record, providerId: "gomariz" },
      { ...record, condition: "Segunda mano" as const },
      { ...record, model: "MODELO AJENO" },
      { ...record, reference: "999999" },
      { ...record, url: record.url.replace(`${reference}-`, "999999-") },
      { ...record, specs: { ...record.specs, "Potencia de tracción (kW)": "99 kW" } }
    ]) {
      assert.deepEqual(recoverGamVerifiedTwinMotorSpecs(invalid), invalid.specs ?? {}, `${reference}: variante`);
    }
  }
  const crane = recordOf("1884");
  assert.deepEqual(recoverGamVerifiedTwinMotorSpecs({
    ...crane, longDescription: `${crane.longDescription} Motor eléctrico: 9+9 kW.`
  }), crane.specs);
  const hyster = recordOf("5891");
  assert.deepEqual(recoverGamVerifiedTwinMotorSpecs({
    ...hyster, longDescription: `${hyster.longDescription} Motor: eléctrico doble 2 × 10 kW.`
  }), hyster.specs);
  assert.ok(gomariz.products.every((record) =>
    JSON.stringify(recoverGamVerifiedTwinMotorSpecs(record)) === JSON.stringify(record.specs ?? {})));
});
