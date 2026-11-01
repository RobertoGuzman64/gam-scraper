import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamYaleSuperelasticTyresSpec } from "../evidence/providers/gam/non-marking-tyres-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const references = [
  "2273", "2274", "2254", "2192", "2193", "2255", "2256", "2281", "2282", "2283", "2284",
  "6322", "6323", "6325", "6326", "6327"
] as const;

const recordOf = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera neumáticos superelásticos en dieciséis carretillas Yale identificadas", () => {
  for (const reference of references) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const recovered = recoverGamYaleSuperelasticTyresSpec(record);
    const product = prepareSourceProduct(record).product;
    assert.equal(recovered["Neumáticos"], "Superelásticos", reference);
    assert.equal(product.spec["Neumáticos"], "Superelásticos", reference);
    const normalized = normalizeSpecsObject(product.spec);
    assert.equal(normalized.normalized["Neumáticos"], "Superelásticos", reference);
    assert.ok(!normalized.unknownKeys.includes("Neumáticos"), reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(recovered[key], value, `${reference}: ${key}`);
      assert.deepEqual(product.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original, reference);
  }
});

test("no atribuye neumáticos a variantes, identidades o configuraciones contradictorias", () => {
  const record = recordOf("2273");
  const source = record.specs ?? {};
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" },
    { ...record, categoryKey: "otros-nuevos" },
    { ...record, brand: "HYSTER" },
    { ...record, model: "ERC18VA" },
    { ...record, title: "Carretilla elevadora eléctrica Yale ERC18VA" },
    { ...record, shortDescription: "Carretilla elevadora eléctrica Yale ERC18VA" },
    { ...record, reference: "2274" },
    { ...record, url: `${record.url}?variante=otro` },
    { ...record, url: `${record.url}#variante` },
    { ...record, url: record.url.replace("2273-", "2274-") },
    { ...record, specs: { ...source, Marca: "HYSTER" } },
    { ...record, specs: { ...source, Neumáticos: "Macizos" } },
    { ...record, longDescription: `${record.longDescription} Ofrece alternativas de ruedas superelásticas y radiales.` },
    { ...record, longDescription: `${record.longDescription} También equipa neumáticos radiales.` },
    { ...record, longDescription: `${record.longDescription} No monta neumáticos superelásticos.` },
    { ...record, longDescription: `${record.longDescription} Neumáticos superelásticos opcionales.` }
  ];
  for (const variant of variants) {
    assert.deepEqual(recoverGamYaleSuperelasticTyresSpec(variant), variant.specs ?? {});
  }
});

test("mantiene fuera modelos de identidad incompleta y alternativas de ruedas", () => {
  for (const reference of ["2276", "2277", "2278", "2279", "2280", "2294", "5988", "5989", "5990", "5991", "5992", "5993", "5994", "5995", "5996", "5997", "6324", "6002", "6003", "6004"]) {
    const record = recordOf(reference);
    assert.deepEqual(recoverGamYaleSuperelasticTyresSpec(record), record.specs ?? {}, reference);
  }
});

test("la recuperación afecta solo a la cohorte Yale y no toca Gomariz", () => {
  const improved = gam.products.filter((record) =>
    Object.keys(recoverGamYaleSuperelasticTyresSpec(record)).length > Object.keys(record.specs ?? {}).length
  ).map((record) => record.reference);
  assert.deepEqual(new Set(improved), new Set(references));
  assert.equal(improved.length, references.length);
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamYaleSuperelasticTyresSpec(record), record.specs ?? {});
  }
});
