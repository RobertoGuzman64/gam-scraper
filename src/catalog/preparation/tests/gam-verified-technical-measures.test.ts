import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamVerifiedTechnicalSpecs } from "../evidence/providers/gam/verified-technical-measures.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");

const byReference = (reference: string) => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const rotationCases = [
  ["4755", "360°"], ["4772", "345°"], ["5900", "360°"],
  ["4659", "360°"], ["6547", "190° + 190°"], ["4653", "±300°"],
  ["6767", "700°"], ["6768", "700°"], ["4661", "±320°"], ["4662", "±320°"]
] as const;
const widthCases = [
  ["6963", 810], ["2109", 820], ["6368", 796],
  ["4025", 816], ["4026", 905], ["4027", 905]
] as const;
const fuelCases = [["6542", 210], ["6182", 50]] as const;

test("GAM conserva la dirección y amplitud de los giros de torreta acreditados", () => {
  for (const [reference, rotation] of rotationCases) {
    const record = byReference(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Rotación de torreta"], rotation, reference);
    assert.equal(normalizeSpecsObject(prepared.product.spec).normalized["Rotación de torreta"], rotation, reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original);
  }
});

test("GAM recupera anchuras en milímetros y depósitos de combustible en litros", () => {
  for (const [reference, width] of widthCases) {
    const record = byReference(reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Anchura (mm)"], `${width} mm`, reference);
    assert.equal(normalizeSpecsObject(prepared.product.spec).normalized["Anchura (mm)"], width, reference);
  }
  for (const [reference, capacity] of fuelCases) {
    const record = byReference(reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Depósito de combustible"], capacity, reference);
    assert.equal(normalizeSpecsObject(prepared.product.spec).normalized["Depósito de combustible"], capacity, reference);
  }
});

test("GAM rechaza variantes, atribuciones incorrectas y medidas contradictorias", () => {
  const record = byReference("4772");
  for (const variant of [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" as const },
    { ...record, categoryKey: "otros-nuevos" },
    { ...record, model: "XGA18E" },
    { ...record, brand: "CTE" },
    { ...record, reference: "4755" },
    { ...record, url: "https://online.gamrentals.com/es/xcmg/4772-xga18e" },
    { ...record, specs: { ...record.specs, "Rotación de torreta": "345°" } },
    { ...record, longDescription: `${record.longDescription ?? ""} Rotación de la torreta: 360°.` }
  ]) {
    assert.deepEqual(recoverGamVerifiedTechnicalSpecs(variant), variant.specs);
  }
  const width = byReference("6963");
  assert.deepEqual(recoverGamVerifiedTechnicalSpecs({
    ...width,
    longDescription: `${width.longDescription ?? ""} La anchura total de 820 mm es diferente.`
  }), width.specs);
  const fuel = byReference("6182");
  assert.deepEqual(recoverGamVerifiedTechnicalSpecs({
    ...fuel,
    longDescription: `${fuel.longDescription ?? ""} El depósito de combustible de 75 L es alternativo.`
  }), fuel.specs);
});

test("el lote aporta solo 18 fichas GAM con 18 especificaciones sin trasladarlas a Gomariz", () => {
  const expected = [...rotationCases, ...widthCases, ...fuelCases].map(([reference]) => reference);
  const changes = gam.products.flatMap((record) => {
    const next = recoverGamVerifiedTechnicalSpecs(record);
    const added = Object.keys(next).filter((key) => !Object.hasOwn(record.specs ?? {}, key));
    return added.length ? [{ reference: record.reference, added }] : [];
  });
  assert.deepEqual(new Set(changes.map(({ reference }) => reference)), new Set(expected));
  assert.equal(changes.length, 18);
  assert.ok(changes.every(({ added }) => added.length === 1));
  assert.ok(gomariz.products.every((record) =>
    JSON.stringify(recoverGamVerifiedTechnicalSpecs(record)) === JSON.stringify(record.specs ?? {})));
});
