import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../catalog/normalization/normalize-specs.js";
import { recoverGamVerifiedTyreDimensions } from "../../evidence/mobility/verified-tyre-dimensions-evidence.js";
import { recoverGamVerifiedConditionalAcoustics } from "../../evidence/operations-and-safety/verified-conditional-acoustics-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const tyreReferences = [
  "2093", "2095", "2058", "2060", "2064",
  "5988", "5989", "5990", "5993", "5994", "5995", "5996", "5997"
] as const;
const soundReferences = ["6423", "4030", "4033", "3996", "4003", "4004", "4012"] as const;

const recordOf = (reference: string): ProductRecord => {
  const record = gam.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("las medidas de neumáticos y niveles sonoros acreditados sobreviven a la preparación y normalización", () => {
  for (const [references, key] of [[tyreReferences, "Neumáticos"], [soundReferences, "Nivel sonoro"]] as const) {
    for (const reference of references) {
      const original = recordOf(reference);
      const snapshot = structuredClone(original);
      const prepared = prepareSourceProduct(original).product.spec;
      const normalized = normalizeSpecsObject(prepared);
      assert.ok(typeof prepared[key] === "string" && prepared[key].length > 0, reference);
      assert.equal(normalized.normalized[key], prepared[key], reference);
      assert.ok(!normalized.unknownKeys.includes(key), reference);
      for (const [sourceKey, value] of Object.entries(original.specs ?? {})) {
        assert.deepEqual(prepared[sourceKey], value, `${reference}: ${sourceKey}`);
      }
      assert.deepEqual(original, snapshot, reference);
    }
  }
  assert.equal(prepareSourceProduct(recordOf("4033")).product.spec["Nivel sonoro"],
    "GLP: 80 dBA; diésel: 83 dBA");
  assert.equal(prepareSourceProduct(recordOf("4012")).product.spec["Nivel sonoro"],
    "Disco: 77 dBA; cilíndrica: 79 dBA");
  assert.equal(prepareSourceProduct(recordOf("4003")).product.spec["Nivel sonoro"],
    "62,2 dBA (modo Quiet-Mode)");
});

test("rechaza variantes ajenas, conflictos, especificaciones previas y datos con medidas duplicadas", () => {
  const cases = [
    [recordOf("5988"), recoverGamVerifiedTyreDimensions, "Neumáticos"],
    [recordOf("2093"), recoverGamVerifiedTyreDimensions, "Neumáticos"],
    [recordOf("4033"), recoverGamVerifiedConditionalAcoustics, "Nivel sonoro"],
    [recordOf("4030"), recoverGamVerifiedConditionalAcoustics, "Nivel sonoro"],
    [recordOf("6423"), recoverGamVerifiedConditionalAcoustics, "Nivel sonoro"]
  ] as const;
  for (const [original, recover, key] of cases) {
    const invalid: readonly ProductRecord[] = [
      { ...original, providerId: "gomariz" },
      { ...original, reference: "9999" },
      { ...original, model: "OTRO" },
      { ...original, title: "Otra máquina" },
      { ...original, url: `${original.url}?variante=otra` },
      { ...original, specs: { ...original.specs, [key]: "dato previo" } },
      { ...original, longDescription: `${original.longDescription ?? ""} ${original.longDescription ?? ""}` }
    ];
    for (const variant of invalid) {
      assert.deepEqual(recover(variant), variant.specs ?? {}, `${original.reference}: ${key}`);
    }
    if (key === "Nivel sonoro") {
      const contradictory = { ...original, longDescription: `${original.longDescription ?? ""} Se indicó también un nivel sonoro de 95 dBA.` };
      assert.deepEqual(recover(contradictory), contradictory.specs ?? {}, original.reference ?? "");
    }
  }
  for (const reference of ["5992", "2096", "4029", "6148"]) {
    const record = recordOf(reference);
    assert.deepEqual(recoverGamVerifiedTyreDimensions(record), record.specs ?? {}, reference);
    assert.deepEqual(recoverGamVerifiedConditionalAcoustics(record), record.specs ?? {}, reference);
  }
});

test("la recuperación se limita a veinte identidades únicas de GAM", () => {
  const changed = gam.products.flatMap((record) => {
    const tyres = recoverGamVerifiedTyreDimensions(record);
    const sound = recoverGamVerifiedConditionalAcoustics({ ...record, specs: tyres });
    return Object.keys(sound).some((key) => !Object.hasOwn(record.specs ?? {}, key)) ? [record.reference] : [];
  });
  assert.deepEqual(new Set(changed), new Set([...tyreReferences, ...soundReferences]));
  assert.equal(changed.length, 20);
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamVerifiedTyreDimensions(record), record.specs ?? {});
    assert.deepEqual(recoverGamVerifiedConditionalAcoustics(record), record.specs ?? {});
  }
});
