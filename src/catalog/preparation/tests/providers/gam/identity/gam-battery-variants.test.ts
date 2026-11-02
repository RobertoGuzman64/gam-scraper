import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../normalization/normalize-specs.js";
import { recoverGamBatteryMeasures } from "../../../../evidence/providers/gam/energy-and-powertrain/battery-measures-evidence.js";
import { recoverGamLithiumBatteryType } from "../../../../evidence/providers/gam/energy-and-powertrain/battery-chemistry-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const recordOf = (reference: string) => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("la tensión común de varias capacidades se recupera sin elegir una capacidad opcional", () => {
  for (const [reference, voltage] of [["6574", 48], ["6480", 24], ["6481", 24], ["6990", 48], ["4028", 36]] as const) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    const normalized = normalizeSpecsObject(prepared.product.spec);
    assert.equal(normalized.normalized["Voltaje batería (V)"], voltage, reference);
    assert.ok(!Object.keys(prepared.product.spec).some((key) => key === "Capacidad de la batería (Ah)"), reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original, reference);
  }
});

test("rechaza cambios de identidad, tensión contradictoria y voltaje ya representado", () => {
  const record = recordOf("6480");
  for (const invalid of [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "6481" },
    { ...record, model: "SC1.5 SL" },
    { ...record, url: `${record.url}?variante=otra` },
    { ...record, specs: { ...record.specs, "Voltaje batería (V)": "24 V" } },
    { ...record, longDescription: `${record.longDescription} Batería auxiliar de 12 V.` },
    { ...record, longDescription: `${record.longDescription} También puede llevar una batería de 48 V.` }
  ]) {
    assert.deepEqual(recoverGamBatteryMeasures(invalid), invalid.specs ?? {});
  }
  const sourceVoltage = recordOf("2175");
  assert.deepEqual(recoverGamBatteryMeasures(sourceVoltage), sourceVoltage.specs ?? {});
});

test("la química de litio requiere modelo identificado y ausencia de alternativas incompatibles", () => {
  for (const reference of ["6322", "6325", "6326", "6327", "2649", "2796", "2797", "3442"]) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Tipo de batería"], "Litio", reference);
    assert.equal(normalizeSpecsObject(prepared.product.spec).normalized["Tipo de batería"], "Litio", reference);
    assert.deepEqual(record, original, reference);
  }
  const record = recordOf("6325");
  for (const invalid of [
    { ...record, model: "ERP20UX L" },
    { ...record, title: "YALE ERP20UX L" },
    { ...record, url: record.url.replace("6325-", "6324-") },
    { ...record, specs: { ...record.specs, "Tipo de batería": "Plomo-ácido" } },
    { ...record, longDescription: `${record.longDescription} Disponible con batería de plomo-ácido.` },
    { ...record, longDescription: `${record.longDescription} Sin batería de ion de litio.` },
    { ...record, longDescription: `${record.longDescription} Opción de batería de ion de litio.` }
  ]) {
    assert.deepEqual(recoverGamLithiumBatteryType(invalid), invalid.specs ?? {});
  }
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamBatteryMeasures(record), record.specs ?? {});
    assert.deepEqual(recoverGamLithiumBatteryType(record), record.specs ?? {});
  }
});
