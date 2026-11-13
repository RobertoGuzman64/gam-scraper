import { accreditedSourceSamples } from "../../../../../domain-cases/accredited-source-samples.js";
import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../../catalog/normalization/normalize-specs.js";
import { recoverGamBatteryMeasures } from "../../../../../../preparation/gam/technical/energy/battery-measures-evidence.js";
import { prepareSourceProduct } from "../../../../../../preparation/prepare-product.js";

const gam = { products: accreditedSourceSamples("gam-original") };
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const recordOf = (reference: string) => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM recupera voltaje y capacidad de una batería inequívoca sin alterar el original", () => {
  for (const [reference, voltage, capacity] of [
    ["6963", 24, 75], ["4780", 51.2, 346], ["4798", 80.5, 604],
    ["2011", 48, 500], ["5888", 80, 560], ["5993", 154.5, 302],
    ["5995", 354.2, 228], ["6743", 24, 375], ["4388", 24, 54],
    ["5079", 96, 1395], ["4023", 12, 105], ["4622", 24, 150]
  ] as const) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const result = prepareSourceProduct(record);
    const normalized = normalizeSpecsObject(result.product.spec);
    assert.equal(normalized.normalized["Voltaje batería (V)"], voltage, reference);
    assert.deepEqual(normalized.normalized["Capacidad de la batería (Ah)"], [capacity], reference);
    assert.ok(!normalized.unknownKeys.includes("Voltaje batería (V)"));
    assert.ok(!normalized.unknownKeys.includes("Capacidad de la batería (Ah)"));
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(result.product.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original);
  }
});

test("GAM rechaza variantes, configuraciones alternativas y medidas contradictorias", () => {
  const record = recordOf("6963");
  for (const variant of [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" as const },
    { ...record, model: "XG0807AC" },
    { ...record, brand: "HYSTER" },
    { ...record, reference: "6964" },
    { ...record, specs: { ...record.specs, Marca: "HYSTER" } },
    { ...record, specs: { ...record.specs, "Voltaje batería (V)": "24 V" } },
    { ...record, longDescription: `${record.longDescription} También hay una batería de 48 V / 150 Ah.` },
    { ...record, longDescription: `${record.longDescription} Existe una opción de batería de 24 V / 90 Ah.` },
    { ...record, longDescription: `${record.longDescription} La batería auxiliar de 12 V admite el sistema.` }
  ]) {
    assert.deepEqual(recoverGamBatteryMeasures(variant), variant.specs);
  }
  const knownCapacity = { ...record, specs: { ...record.specs, "Capacidad de la batería": "75 Ah" } };
  const withVoltage = recoverGamBatteryMeasures(knownCapacity);
  assert.equal(withVoltage["Capacidad de la batería"], "75 Ah");
  assert.equal(withVoltage["Voltaje batería (V)"], "24 V");
  for (const reference of ["5988", "5992", "3799", "3800", "6368", "6002"]) {
    const incompatible = recordOf(reference);
    assert.deepEqual(recoverGamBatteryMeasures(incompatible), incompatible.specs ?? {}, reference);
  }
});

test("Gomariz permanece fuera del enriquecimiento de baterías GAM", () => {
  assert.ok(gomariz.products.every((record) =>
    JSON.stringify(recoverGamBatteryMeasures(record)) === JSON.stringify(record.specs ?? {})));
});

test("recupera únicamente tensiones de batería coincidentes en plataformas, apiladores y limpieza", () => {
  for (const [reference, voltage] of [["4731", 24], ["2103", 24], ["5771", 36]] as const) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    const normalized = normalizeSpecsObject(prepared.product.spec);
    assert.equal(normalized.normalized["Voltaje batería (V)"], voltage, reference);
    assert.ok(!normalized.unknownKeys.includes("Voltaje batería (V)"));
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], ["6421"].includes(reference) && key === "Capacidad de carga (kg)" ? "2000 KG" : value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original);
  }
  const record = recordOf("4731");
  for (const invalid of [
    { ...record, brand: "Otra" },
    { ...record, model: "XG0607AC" },
    { ...record, reference: "4732" },
    { ...record, specs: { ...record.specs, "Voltaje batería (V)": "24 V" } },
    { ...record, longDescription: `${record.longDescription} Batería opcional de 48 V.` },
    { ...record, longDescription: `${record.longDescription} Batería de 24 o 48 V.` },
    { ...record, longDescription: `${record.longDescription} El cargador auxiliar utiliza 12 V.` }
  ]) {
    assert.deepEqual(recoverGamBatteryMeasures(invalid), invalid.specs ?? {});
  }
});

test("GAM recupera tensiones no representadas en quince carretillas eléctricas identificadas", () => {
  for (const [reference, voltage] of [
    ["2221", 48], ["2222", 48], ["2223", 48],
    ["2254", 80], ["2255", 80], ["2256", 80],
    ["6419", 51.2], ["2012", 48], ["4625", 48],
    ["6420", 51.2], ["4626", 48], ["6325", 48],
    ["6421", 51.2], ["6425", 77.6], ["6424", 77.6]
  ] as const) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    const normalized = normalizeSpecsObject(prepared.product.spec);
    assert.equal(normalized.normalized["Voltaje batería (V)"], voltage, reference);
    assert.ok(!normalized.unknownKeys.includes("Voltaje batería (V)"), reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], ["6421"].includes(reference) && key === "Capacidad de carga (kg)" ? "2000 KG" : value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original, reference);
  }
});

test("no duplica voltajes ya incluidos en otro spec ni acepta referencias o tensiones cruzadas", () => {
  const original = recordOf("6420");
  for (const record of [
    { ...original, brand: "YALE" },
    { ...original, model: "J2.0UTL" },
    { ...original, reference: "6421" },
    { ...original, url: original.url.replace("6420-", "6421-") },
    { ...original, specs: { ...original.specs, "Capacidad de la batería": "51,2 V / 460 Ah" } },
    { ...original, longDescription: `${original.longDescription} Cargador auxiliar de 24 V.` },
    { ...original, longDescription: `${original.longDescription} Batería alternativa de 48 V.` }
  ]) {
    assert.deepEqual(recoverGamBatteryMeasures(record), record.specs ?? {});
  }
  for (const reference of ["2015", "2037", "2289"]) {
    const record = recordOf(reference);
    assert.deepEqual(recoverGamBatteryMeasures(record), record.specs ?? {}, reference);
  }
});
