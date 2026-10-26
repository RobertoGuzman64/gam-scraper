import assert from "node:assert/strict";
import test from "node:test";
import { requireProductReference } from "./require-product-reference.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { gamBasketDimensionsFromRepeatedFragments } from "../mapping/providers/gam/basket.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const dimension = catalog.attributes.find((entry) => entry.name === "Dimensiones de la cesta");
assert.ok(dimension);
const reference = (code: string): ProductRecord => requireProductReference(source.products, code);
const resolve = (record: ProductRecord) => resolveAttribute(record, dimension);

const cases = [
  ["5855", "1,8 x 0,8 m"],
  ["6139", "1,83 x 0,76 m"],
  ["6206", "1,2 x 0,92 m"],
  ["6158", "1,63 x 0,81 m"],
  ["6196", "1,87 x 0,76 m"],
  ["6195", "1,87 x 0,76 m"],
  ["6486", "1,87 x 0,76 m"]
] as const;

test("recupera únicamente pares completos cuyo ruido repite exactamente las cifras originales", () => {
  for (const [code, expected] of cases) {
    const record = reference(code);
    assert.deepEqual(resolve(record), { status: "resolved", value: expected }, code);
    assert.equal(prepareProduct(record, catalog).status, "ready", code);
  }
});

test("ninguna cifra se reconstruye con trozos sueltos, unidades supuestas o ruido contradictorio", () => {
  for (const raw of [
    "1 76 83X0 metros",
    "1 8 8 x 0 metros",
    "1 2x0 96 metros",
    "18 3 81X2 metros",
    "4 83 88x1 metros",
    "1 1,83 x 0,76 76 82 x 0 metros",
    "1 1,83 x 0,76 76 83 x 0 mm",
    "1 1,83 x 0,76 76 83 x 0",
    "1 1,83 x 0,76 76 83 x 0 metros 2 x 1 metros",
    "2 1,83 x 0,76 76 83 x 0 metros",
    "1 1,83 x 0,76 76 83 x 0 centimetros",
    "1 1,83 x 0,76 76 83 x 0 metros 190º"
  ]) {
    assert.equal(gamBasketDimensionsFromRepeatedFragments(raw), null, raw);
  }
});

test("conserva las contradicciones y los fragmentos irrecuperables sin normalizar", () => {
  for (const code of ["6607", "6630", "6632", "6631", "6614", "6616", "6615", "6642", "6625", "6669", "6617", "6626", "6169", "6171"]) {
    const record = reference(code);
    assert.deepEqual(resolve(record), { status: "not_observed", value: null }, code);
    assert.equal(prepareProduct(record, catalog).status, "ready", code);
  }
  const base = reference("6139");
  assert.deepEqual(resolve({ ...base, specs: { ...base.specs, "Dimensiones de la cesta": "2 x 1 m" } }),
    { status: "contradiction", value: null });
  assert.deepEqual(resolve({ ...base, specs: { ...base.specs, "Dimensiones Cesta": "1 1,83 x 0,76 76 82 x 0 metros" } }),
    { status: "invalid", value: null });
  assert.deepEqual(resolve({ ...base, providerId: "gomariz" }), { status: "not_observed", value: null });
  assert.equal(resolve(reference("6622")).status, "rejected");
});
