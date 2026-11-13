import { accreditedSourceSamples } from "../../../../testing/domain-cases/accredited-source-samples.js";
import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../catalog/normalization/normalize-specs.js";
import { recoverGamVerifiedEngineTorqueSpecs } from "./motor-configuration-evidence.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const gam = { products: accreditedSourceSamples("gam-original") };
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const original = (reference: string) => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const expected: ReadonlyArray<readonly [string, number]> = [
  ["6542", 289], ["2096", 373], ["2057", 750], ["2058", 750],
  ["2061", 750], ["2060", 750], ["2063", 750], ["2062", 750],
  ["2064", 750], ["2068", 750], ["2065", 750], ["2069", 750],
  ["2067", 750], ["2066", 750], ["2070", 750], ["6182", 225]
];

test("recupera el par motor numérico respaldado por la identidad y la motorización", () => {
  assert.equal(expected.length, 16);
  for (const [reference, value] of expected) {
    const record = original(reference);
    const copy = structuredClone(record);
    const prepared = prepareSourceProduct(record).product;
    const normalized = normalizeSpecsObject(prepared.spec);
    assert.equal(prepared.spec["Par motor (Nm)"], `${value} Nm`, reference);
    assert.equal(normalized.normalized["Par motor (Nm)"], value, reference);
    assert.ok(!normalized.unknownKeys.includes("Par motor (Nm)"), reference);
    for (const [key, existing] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.spec[key], existing, `${reference}: ${key}`);
    }
    assert.deepEqual(record, copy, reference);
  }
});

test("bloquea cambios de identidad, variantes de motor, duplicados y pares contradictorios", () => {
  for (const reference of ["2058", "2069", "2096", "6542", "6182"]) {
    const record = original(reference);
    const invalid = [
      { ...record, providerId: "gomariz" },
      { ...record, condition: "Segunda mano" as const },
      { ...record, reference: "999999" },
      { ...record, model: "MODELO AJENO" },
      { ...record, brand: "OTRA" },
      { ...record, url: record.url.replace(`${reference}-`, "999999-") },
      { ...record, shortDescription: "Ficha de otro equipo" },
      { ...record, specs: { ...record.specs, "Tipo motor": "MTU 7.7L Diesel" } },
      { ...record, specs: { ...record.specs, "Par motor (Nm)": "999 Nm" } },
      { ...record, longDescription: `${record.longDescription} Otro par motor de 500 Nm.` }
    ];
    for (const candidate of invalid) {
      assert.deepEqual(recoverGamVerifiedEngineTorqueSpecs(candidate), candidate.specs ?? {}, `${reference}: rechazo`);
    }
  }
  for (const reference of ["2042", "2043", "2049", "2071", "2073", "2079", "2082", "6274"]) {
    const record = original(reference);
    assert.deepEqual(recoverGamVerifiedEngineTorqueSpecs(record), record.specs ?? {}, reference);
  }
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamVerifiedEngineTorqueSpecs(record), record.specs ?? {});
  }
});
