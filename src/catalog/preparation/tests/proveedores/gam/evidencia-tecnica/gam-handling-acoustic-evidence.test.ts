import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../normalization/normalize-specs.js";
import { recoverGamHandlingAcousticSpec } from "../../../../evidence/providers/gam/operacion-seguridad/acoustic-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");

const expected = [
  ["2087", "79 dB(A)"], ["2030", "70,4 dB"], ["2037", "67 dB(A)"],
  ["2034", "70 dB(A)"], ["6419", "70,4 dB(A)"], ["2012", "69 dB(A)"],
  ["6420", "67,9 dB(A)"], ["6421", "67,9 dB(A)"],
  ["6425", "70,0 dB(A)"], ["6424", "70,0 dB(A)"],
  ["3801", "67 dB(A)"], ["6480", "< 75 dB(A)"],
  ["6481", "< 75 dB(A)"], ["2177", "65,4 dB(A)"]
] as const;

const byReference = (reference: string) => {
  const record = gam.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera valores y límites acústicos verificables en manutención sin sobrescribir datos", () => {
  for (const [reference, value] of expected) {
    const record = byReference(reference);
    const snapshot = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Nivel sonoro"], value, reference);
    assert.equal(normalizeSpecsObject(prepared.product.spec).normalized["Nivel sonoro"], value, reference);
    assert.ok(!normalizeSpecsObject(prepared.product.spec).unknownKeys.includes("Nivel sonoro"), reference);
    for (const [key, original] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], original, `${reference}: ${key}`);
    }
    assert.deepEqual(record, snapshot, reference);
  }
});

test("protege la identidad, el proveedor y los valores acústicos preexistentes", () => {
  const record = byReference("6419");
  for (const changed of [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "6420" },
    { ...record, brand: "YALE" },
    { ...record, model: "J1.8UTL" },
    { ...record, condition: "Segunda mano" as const },
    { ...record, url: `${record.url}-other` },
    { ...record, shortDescription: "Carretilla Hyster J1.8UTL" },
    { ...record, specs: { ...record.specs, "Nivel sonoro": "69 dB(A)" } },
    { ...record, longDescription: `${record.longDescription} Nivel sonoro de 88 dB(A).` },
    { ...record, longDescription: (record.longDescription ?? "").replace("70,4 dB(A)", "70,4 dB(A) en modo Eco") },
    { ...record, longDescription: (record.longDescription ?? "").replace("70,4 dB(A)", "120 dB(A)") }
  ]) assert.deepEqual(recoverGamHandlingAcousticSpec(changed), changed.specs ?? {});
});

test("no equipara variantes, modos de uso o referencias con identidad cruzada", () => {
  for (const reference of ["6274", "3802", "6423", "6746", "3996", "4003", "4004", "4012", "4033", "4034"]) {
    const record = byReference(reference);
    assert.deepEqual(recoverGamHandlingAcousticSpec(record), record.specs ?? {}, reference);
  }
  const record = byReference("2030");
  const altered = { ...record, longDescription: `${record.longDescription} En modo Eco el nivel sonoro es 61 dB(A).` };
  assert.deepEqual(recoverGamHandlingAcousticSpec(altered), altered.specs ?? {});
});

test("limita la recuperación al conjunto acreditado y no afecta a Gomariz", () => {
  const changed = gam.products.flatMap((record) => {
    const enriched = recoverGamHandlingAcousticSpec(record);
    return Object.hasOwn(enriched, "Nivel sonoro") && !Object.hasOwn(record.specs ?? {}, "Nivel sonoro") ? [record.reference] : [];
  });
  assert.deepEqual(new Set(changed), new Set(expected.map(([reference]) => reference)));
  assert.equal(changed.length, expected.length);
  assert.ok(gomariz.products.every((record) =>
    JSON.stringify(recoverGamHandlingAcousticSpec(record)) === JSON.stringify(record.specs ?? {})));
});
