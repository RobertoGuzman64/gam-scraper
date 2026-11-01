import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamPhysicalMeasures } from "../evidence/providers/gam/physical-measures-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const recordOf = (reference: string) => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

const expected = [
  ["6574", { "Longitud (mm)": 2516 }],
  ["4025", { "Longitud (mm)": 1400 }],
  ["4026", { "Longitud (mm)": 1615, "Altura (mm)": 1210, "Peso (kg)": 258 }],
  ["4027", { "Longitud (mm)": 1615, "Altura (mm)": 1210 }],
  ["3999", { "Longitud (mm)": 1327, "Anchura (mm)": 563, "Altura (mm)": 1033 }],
  ["4000", { "Longitud (mm)": 1279, "Altura (mm)": 1033 }],
  ["4005", { "Anchura (mm)": 675 }],
  ["4001", { "Longitud (mm)": 1552, "Altura (mm)": 1100 }],
  ["4002", { "Altura (mm)": 1100 }],
  ["4008", { "Longitud (mm)": 1504 }],
  ["4012", { "Longitud (mm)": 2006, "Anchura (mm)": 1180, "Altura (mm)": 1508 }],
  ["4030", { "Peso (kg)": 880 }],
  ["4039", { "Peso (kg)": 18.5 }],
  ["4040", { "Peso (kg)": 23.4 }]
] as const;

test("las medidas propias explícitas se preparan sin sobrescribir las especificaciones originales", () => {
  for (const [reference, measurements] of expected) {
    const record = recordOf(reference);
    const snapshot = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    const normalized = normalizeSpecsObject(prepared.product.spec);
    for (const [key, value] of Object.entries(measurements)) {
      assert.equal(normalized.normalized[key], value, `${reference}: ${key}`);
      assert.ok(!normalized.unknownKeys.includes(key), `${reference}: ${key}`);
    }
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, snapshot, reference);
  }
  assert.equal(expected.length, 14);
});

test("rechaza variantes ambiguas, identidades cruzadas y medidas existentes", () => {
  for (const reference of ["4029", "4009", "6364", "6802"]) {
    const record = recordOf(reference);
    assert.deepEqual(recoverGamPhysicalMeasures(record), record.specs ?? {}, reference);
  }
  const record = recordOf("4026");
  for (const variant of [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" as const },
    { ...record, brand: "Otra" },
    { ...record, model: "BCS S880" },
    { ...record, title: "Barredora BCS S880" },
    { ...record, url: record.url.replace("4026-", "4027-") },
    { ...record, specs: { ...record.specs, Marca: "Otra" } },
    { ...record, specs: { ...record.specs, Longitud: "1600 mm", Anchura: "900 mm", Altura: "1200 mm", Peso: "270 kg" } },
    { ...record, longDescription: `${record.longDescription} Longitud de 1.900 mm.` },
    { ...record, longDescription: `${record.longDescription} Anchura de 905 mm a 1.200 mm.` }
  ]) {
    const result = recoverGamPhysicalMeasures(variant);
    if (variant.specs?.["Longitud"]) {
      assert.equal(result["Longitud"], variant.specs["Longitud"]);
      assert.equal(result["Peso"], variant.specs["Peso"]);
    } else if (variant.longDescription?.includes("Longitud de 1.900 mm")) {
      assert.equal(result["Longitud"], undefined);
    } else if (variant.longDescription?.includes("Anchura de 905 mm a")) {
      assert.equal(result["Anchura"], undefined);
    } else {
      assert.deepEqual(result, variant.specs ?? {});
    }
  }
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamPhysicalMeasures(record), record.specs ?? {});
  }
});

test("no duplica anchuras ya recuperadas y conserva rangos dependientes de variante", () => {
  for (const reference of ["6963", "2109", "6368", "4025", "4026", "4027"]) {
    const record = recordOf(reference);
    const result = prepareSourceProduct(record).product.spec;
    assert.ok(Object.hasOwn(result, "Anchura (mm)"), reference);
    assert.ok(!Object.hasOwn(result, "Anchura"), reference);
  }
  const variable = recordOf("4008");
  assert.equal(recoverGamPhysicalMeasures(variable)["Anchura"], undefined);
  assert.equal(recoverGamPhysicalMeasures(recordOf("4009"))["Longitud"], undefined);
});
