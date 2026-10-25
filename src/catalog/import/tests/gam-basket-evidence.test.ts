import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const dimension = catalog.attributes.find((item) => item.name === "Dimensiones de la cesta");
const rotation = catalog.attributes.find((item) => item.name === "Rotación de torreta");
assert.ok(dimension);
assert.ok(rotation);
const reference = (id: string): ProductRecord => {
  const found = source.products.find((item) => item.reference === id);
  assert.ok(found, id);
  return found;
};
const resolve = (record: ProductRecord) => resolveAttribute(record, dimension);

const recovered = ["6162", "6166", "6185", "6188", "6168", "6163"];

test("recupera seis dimensiones CTE con evidencia explícita equivalente en la descripción", () => {
  for (const id of recovered) {
    const record = reference(id);
    assert.equal(record.specs?.["Dimensiones Cesta"], "1400x700x1100 metros", id);
    assert.deepEqual(resolve(record), { status: "resolved", value: "1,4 x 0,7 x 1,1 m" }, id);
    assert.equal(prepareProduct(record, catalog).status, "ready", id);
    assert.equal(record.specs?.["Dimensiones Cesta"], "1400x700x1100 metros", id);
  }
});

test("no inventa milímetros implícitos en dos fichas CTE sin evidencia secundaria", () => {
  for (const id of ["6169", "6171"]) {
    const record = reference(id);
    assert.deepEqual(resolve(record), { status: "not_observed", value: null }, id);
    assert.deepEqual(resolveAttribute(record, rotation), { status: "not_observed", value: null }, id);
    assert.equal(prepareProduct(record, catalog).status, "ready", id);
  }
});

test("rechaza narrativas ausentes, contradictorias, no equivalentes o ajenas a la cesta", () => {
  const base = reference("6162");
  const variants: readonly ProductRecord[] = [
    { ...base, longDescription: null },
    { ...base, longDescription: "Las dimensiones del equipo son 1,40 x 0,70 x 1,10 m." },
    { ...base, longDescription: "La cesta tiene dimensiones de 1,40 x 0,75 x 1,10 m." },
    { ...base, longDescription: "La cesta tiene dimensiones de 1400 x 700 x 1100 metros." },
    { ...base, longDescription: "La cesta tiene dimensiones de 1,40 x 0,70 x 1,10 m. La cesta tiene dimensiones de 1,40 x 0,75 x 1,10 m." },
    { ...base, specs: { ...base.specs, "Dimensiones Cesta": "1400x700x1100 mm cm" } }
  ];
  for (const [index, variant] of variants.entries()) {
    const status = index <= 1 ? "not_observed" : "invalid";
    assert.deepEqual(resolve(variant), { status, value: null }, variant.longDescription ?? "sin descripción");
  }
});

test("no emplea esta evidencia para salvar conflictos de identidad o candidatos inconsistentes", () => {
  const base = reference("6162");
  const contradictory = { ...base, specs: { ...base.specs, "Dimensiones de la cesta": "2 x 1 m" } };
  assert.deepEqual(resolve(contradictory), { status: "contradiction", value: null });
  const identity = reference("4736");
  assert.equal(resolve(identity).status, "rejected");
  assert.equal(resolve({ ...base, providerId: "gomariz" }).status, "not_observed");
});

test("mantiene sin inventar medidas los doce fragmentos sin pareja recuperable", () => {
  for (const id of ["6607", "6630", "6632", "6631", "6614", "6616", "6615", "6642", "6625", "6669", "6617", "6626"]) {
    assert.deepEqual(resolve(reference(id)), { status: "not_observed", value: null }, id);
  }
  assert.deepEqual(resolve(reference("6622")), { status: "rejected", value: null });
});
