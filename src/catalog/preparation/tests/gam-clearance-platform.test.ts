import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamClearanceAndPlatform } from "../evidence/providers/gam/clearance-platform-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const recordOf = (reference: string) => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const clearanceCases = [
  ["5988", 130], ["5989", 130], ["5990", 155], ["5993", 186],
  ["5999", 186], ["6000", 186], ["5994", 186], ["6001", 230],
  ["5995", 230], ["5996", 230], ["5997", 230]
] as const;
const platformCases = [
  ["4731", 3.9], ["4733", 5.8], ["4803", 13], ["4805", 16.1],
  ["4804", 16.1], ["4799", 20], ["4806", 20], ["4785", 20],
  ["4787", 26.8], ["4788", 30.6], ["4790", 38.2], ["4808", 6.2],
  ["4809", 8.1], ["4810", 10.65]
] as const;

test("las alturas libres al suelo proceden del modelo y conservan las especificaciones previas", () => {
  for (const [reference, value] of clearanceCases) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Altura al suelo (mm)"], `${value} mm`, reference);
    assert.equal(normalizeSpecsObject(prepared.product.spec).normalized["Altura al suelo (mm)"], value, reference);
    for (const [key, existing] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], existing, `${reference}:${key}`);
    }
    assert.deepEqual(record, original);
  }
});

test("las alturas de plataforma acreditadas no se confunden con altura de trabajo", () => {
  for (const [reference, value] of platformCases) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Altura plataforma (m)"], `${String(value).replace(".", ",")} m`, reference);
    assert.equal(normalizeSpecsObject(prepared.product.spec).normalized["Altura plataforma (m)"], value, reference);
    assert.equal(prepared.product.spec["Altura de elevación (m)"], record.specs?.["Altura de elevación (m)"], reference);
    for (const [key, existing] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], existing, `${reference}:${key}`);
    }
    assert.deepEqual(record, original);
  }
});

test("no se recuperan valores si existe una atribución dudosa, alternativa o contradictoria", () => {
  const forklift = recordOf("5988");
  for (const variant of [
    { ...forklift, providerId: "gomariz" },
    { ...forklift, condition: "Segunda mano" as const },
    { ...forklift, model: "ERP3.0MXLG" },
    { ...forklift, brand: "HYSTER" },
    { ...forklift, reference: "5989" },
    { ...forklift, url: "https://online.gamrentals.com/es/yale/5988-erp30mxlg" },
    { ...forklift, specs: { ...forklift.specs, "Altura al suelo (mm)": "130 mm" } },
    { ...forklift, longDescription: `${forklift.longDescription ?? ""} Altura libre al suelo de 140 mm.` }
  ]) {
    assert.deepEqual(recoverGamClearanceAndPlatform(variant), variant.specs ?? {});
  }
  const scissor = recordOf("4803");
  for (const variant of [
    { ...scissor, model: "XG1823ERT-LI" },
    { ...scissor, specs: { ...scissor.specs, "Altura plataforma (m)": "13 m" } },
    { ...scissor, longDescription: `${scissor.longDescription ?? ""} Altura de plataforma de 12 m.` },
    { ...scissor, specs: { ...scissor.specs, "Altura de elevación (m)": "13 metros" } },
    { ...scissor, url: "https://online.gamrentals.com/es/xcmg/4803-xg1823ert-li" }
  ]) {
    assert.deepEqual(recoverGamClearanceAndPlatform(variant), variant.specs ?? {});
  }
  for (const reference of ["5991", "5992", "6002", "6003", "4802", "4737"]) {
    const record = recordOf(reference);
    assert.deepEqual(recoverGamClearanceAndPlatform(record), record.specs ?? {}, reference);
  }
});

test("solo 25 referencias GAM reciben una medida nueva y Gomariz queda intacto", () => {
  const expected = new Set([...clearanceCases, ...platformCases].map(([reference]) => reference));
  const changed = gam.products.flatMap((record) => {
    const next = recoverGamClearanceAndPlatform(record);
    const added = Object.keys(next).filter((key) => !Object.hasOwn(record.specs ?? {}, key));
    return added.length ? [{ reference: record.reference, added }] : [];
  });
  assert.equal(expected.size, 25);
  assert.deepEqual(new Set(changed.map(({ reference }) => reference)), expected);
  assert.equal(changed.length, 25);
  assert.ok(changed.every(({ added }) => added.length === 1));
  assert.ok(gomariz.products.every((record) =>
    JSON.stringify(recoverGamClearanceAndPlatform(record)) === JSON.stringify(record.specs ?? {})));
});
