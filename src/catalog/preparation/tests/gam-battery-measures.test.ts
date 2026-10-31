import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamBatteryMeasures } from "../evidence/providers/gam/battery-measures-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
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
    { ...record, specs: { ...record.specs, "Capacidad de la batería": "75 Ah" } },
    { ...record, longDescription: `${record.longDescription} También hay una batería de 48 V / 150 Ah.` },
    { ...record, longDescription: `${record.longDescription} Existe una opción de batería de 24 V / 90 Ah.` },
    { ...record, longDescription: `${record.longDescription} La batería auxiliar de 12 V admite el sistema.` }
  ]) {
    assert.deepEqual(recoverGamBatteryMeasures(variant), variant.specs);
  }
  for (const reference of ["5988", "5992", "3799", "3800", "6368", "6002"]) {
    const incompatible = recordOf(reference);
    assert.deepEqual(recoverGamBatteryMeasures(incompatible), incompatible.specs ?? {}, reference);
  }
});

test("Gomariz permanece fuera del enriquecimiento de baterías GAM", () => {
  assert.ok(gomariz.products.every((record) =>
    JSON.stringify(recoverGamBatteryMeasures(record)) === JSON.stringify(record.specs ?? {})));
});
