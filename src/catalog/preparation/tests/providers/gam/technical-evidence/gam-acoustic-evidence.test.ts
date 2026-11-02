import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../normalization/normalize-specs.js";
import { recoverGamAcousticSpec } from "../../../../evidence/providers/gam/operations-and-safety/acoustic-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");

const cases = [
  ["4019", "75 dBA"], ["4020", "75 dBA"], ["4022", "84 dBA"],
  ["4023", "70 dBA"], ["3993", "68 dB"], ["3994", "79,6 dB"],
  ["3997", "69 dB"], ["3999", "56 dBA"], ["4000", "56 dBA"],
  ["4005", "65 dBA"], ["4001", "66,9 dBA"], ["4002", "66,9 dBA"],
  ["4008", "75 dBA"], ["4006", "67 dBA"], ["4007", "67 dBA"],
  ["4009", "72 dBA"],
  ["4035", "68 dBA"], ["4036", "63 dBA"], ["4037", "63 dBA"],
  ["4038", "70 dBA"], ["4039", "74 dBA"], ["4040", "76 dBA"]
] as const;

const byReference = (reference: string) => {
  const record = gam.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera las 22 medidas acústicas sin perder unidades ni especificaciones originales", () => {
  for (const [reference, expected] of cases) {
    const record = byReference(reference);
    const snapshot = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Nivel sonoro"], expected, reference);
    assert.equal(normalizeSpecsObject(prepared.product.spec).normalized["Nivel sonoro"], expected, reference);
    assert.ok(!normalizeSpecsObject(prepared.product.spec).unknownKeys.includes("Nivel sonoro"), reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, snapshot, reference);
  }
});

test("no extrapola valores de modos, otras versiones ni fichas con identidad dudosa", () => {
  for (const reference of ["3996", "4003", "4004", "4012", "4033", "4034", "4021", "4024", "4029", "4030", "6148"]) {
    const record = byReference(reference);
    assert.deepEqual(recoverGamAcousticSpec(record), record.specs ?? {}, reference);
  }
});

test("rechaza identidades alteradas, lecturas contradictorias y claves acústicas ya presentes", () => {
  const record = byReference("4019");
  for (const changed of [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" as const },
    { ...record, categoryKey: "manutencion" },
    { ...record, reference: "4020" },
    { ...record, model: "BF M17 C" },
    { ...record, brand: "XCMG" },
    { ...record, title: "Equipo de limpieza BF M17 D" },
    { ...record, url: "https://online.gamrentals.com/es/tennant/4019-bf-m17-c" },
    { ...record, specs: { ...record.specs, "Nivel de ruido": "70 dBA" } },
    { ...record, longDescription: `${record.longDescription ?? ""} Nivel de ruido de 80 dBA.` },
    { ...record, longDescription: (record.longDescription ?? "").replace("75 dBA", "110 dBA") },
    { ...record, longDescription: (record.longDescription ?? "").replace("75 dBA", "75 dBA en modo Eco") }
  ]) {
    assert.deepEqual(recoverGamAcousticSpec(changed), changed.specs ?? {});
  }
});

test("las 22 fichas únicas pertenecen a GAM y Gomariz queda intacto", () => {
  const changed = gam.products.flatMap((record) => {
    const next = recoverGamAcousticSpec(record);
    const added = Object.keys(next).filter((key) => !Object.hasOwn(record.specs ?? {}, key));
    return added.length ? [{ reference: record.reference, added }] : [];
  });
  assert.deepEqual(new Set(changed.map(({ reference }) => reference)), new Set(cases.map(([reference]) => reference)));
  assert.equal(changed.length, 22);
  assert.ok(changed.every(({ added }) => added.length === 1 && added[0] === "Nivel sonoro"));
  assert.ok(gomariz.products.every((record) =>
    JSON.stringify(recoverGamAcousticSpec(record)) === JSON.stringify(record.specs ?? {})));
});
