import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamVerifiedTowingSpecs } from "../evidence/providers/gam/towing-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");

const byReference = (reference: string) => {
  const record = gam.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

const expected = [
  ["6966", "Capacidad de arrastre (kg)", 25000],
  ["6368", "Tiro a la barra nominal (N)", 1336]
] as const;

test("recupera la capacidad de arrastre y el tiro nominal sin alterar originales ni atributos ajenos", () => {
  for (const [reference, key, amount] of expected) {
    const original = byReference(reference);
    const snapshot = structuredClone(original);
    const product = prepareSourceProduct(original).product;
    assert.equal(product.spec[key], `${amount} ${key === "Capacidad de arrastre (kg)" ? "KG" : "N"}`, reference);
    assert.equal(normalizeSpecsObject(product.spec).normalized[key], amount, reference);
    for (const [originalKey, value] of Object.entries(original.specs ?? {})) {
      assert.deepEqual(product.spec[originalKey], value, `${reference}: ${originalKey}`);
    }
    assert.deepEqual(original, snapshot, reference);
  }
});

test("rechaza modelos cruzados, mediciones incompatibles y valores ya presentes", () => {
  for (const reference of ["6966", "6368"]) {
    const record = byReference(reference);
    const key = reference === "6966" ? "Capacidad de arrastre (kg)" : "Tiro a la barra nominal (N)";
    for (const variant of [
      { ...record, providerId: "gomariz" },
      { ...record, reference: "0000" },
      { ...record, model: "OTRO" },
      { ...record, url: `${record.url}?variante=otra` },
      { ...record, title: "Otro equipo de trabajo" },
      { ...record, specs: { ...record.specs, [key]: "9999" } },
      { ...record, longDescription: `${record.longDescription ?? ""} ${reference === "6966" ?
        "Capacidad de arrastre de 20.000 kg y capacidad de arrastre de 20 toneladas." :
        "Esfuerzo en barra de tracción nominal de 1.500 N."}` }
    ]) {
      assert.deepEqual(recoverGamVerifiedTowingSpecs(variant), variant.specs ?? {}, reference);
    }
  }
  const ambiguous = byReference("6364");
  assert.deepEqual(recoverGamVerifiedTowingSpecs(ambiguous), ambiguous.specs ?? {});
});

test("la recuperación se limita a las dos referencias acreditadas sin contaminar Gomariz", () => {
  const changed = gam.products.flatMap((record) => {
    const next = recoverGamVerifiedTowingSpecs(record);
    const additions = Object.keys(next).filter((key) => !Object.hasOwn(record.specs ?? {}, key));
    return additions.length ? [{ reference: record.reference, additions }] : [];
  });
  assert.deepEqual(new Set(changed.map(({ reference }) => reference)), new Set(expected.map(([reference]) => reference)));
  assert.equal(changed.length, expected.length);
  assert.ok(changed.every(({ additions }) => additions.length === 1));
  assert.ok(gomariz.products.every((record) =>
    JSON.stringify(recoverGamVerifiedTowingSpecs(record)) === JSON.stringify(record.specs ?? {})));
});
