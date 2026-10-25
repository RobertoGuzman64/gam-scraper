import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { findSerialNumberCollisions } from "../../identity-conflicts.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));
const reference = (code: string) => {
  const record = source.products.find((product) => product.reference === code);
  assert.ok(record, `Referencia GAM ${code}`);
  return record;
};
const attribute = (name: string) => {
  const found = catalog.attributes.find((item) => item.name === name);
  assert.ok(found, name);
  return found;
};

test("GAM: variante 70 y especificación coinciden con una de dos anchuras explícitas", () => {
  const selected = reference("4000");
  assert.deepEqual(resolveAttribute(selected, attribute("Ancho de trabajo")), { status: "resolved", value: 700 });
  const result = prepareProduct(selected, catalog);
  assert.ok(!result.issues.includes("Atributo contradictorio: Ancho de trabajo"));
  assert.equal(result.status, "ready");
  assert.equal(resolveAttribute({ ...selected, model: "FCA T391 60" }, attribute("Ancho de trabajo")).status, "contradiction");
  assert.equal(resolveAttribute({ ...selected, shortDescription: "Fregadora TENNANT FCA T391 60" }, attribute("Ancho de trabajo")).status, "contradiction");
  assert.equal(resolveAttribute({ ...selected, specs: { ...selected.specs, "Anchura trabajo": "0,6 metros" } }, attribute("Ancho de trabajo")).status, "contradiction");
});

test("GAM: anchuras acreditadas y versiones no confirmadas se distinguen", () => {
  for (const code of ["4024", "3997", "4005"]) {
    assert.equal(resolveAttribute(reference(code), attribute("Ancho de trabajo")).status, "resolved", code);
  }
  assert.deepEqual(resolveAttribute(reference("4004"), attribute("Ancho de trabajo")), { status: "resolved", value: 800 });
});

test("GAM: las contradicciones de capacidad y alturas mantienen el veto", () => {
  for (const code of ["6723", "2211"]) {
    assert.equal(resolveAttribute(reference(code), attribute("Capacidad de carga")).status, "contradiction", code);
  }
  for (const code of ["6965", "6932", "2275"]) {
    assert.equal(resolveAttribute(reference(code), attribute("Capacidad de carga")).status, "resolved", code);
  }
  for (const code of ["6702", "5275", "6887"]) {
    assert.equal(resolveAttribute(reference(code), attribute("Altura de elevación")).status, "contradiction", code);
  }
});

test("GAM: la potencia comercial documentada se resuelve con su valor publicado", () => {
  assert.deepEqual(resolveAttribute(reference("6834"), attribute("Potencia")), { status: "resolved", value: 32 });
});

test("GAM: los tres números de serie repetidos mantienen las seis referencias independientes", () => {
  const relevant = new Set(["6682", "6703", "6835", "6858", "6807", "6806"]);
  const collisions = findSerialNumberCollisions(source.products).filter(({ products }) =>
    products.some((product) => product.reference !== null && relevant.has(product.reference))
  );
  assert.equal(collisions.length, 3);
  assert.deepEqual(collisions.map(({ products }) => products.map((product) => product.reference).sort()).sort(), [
    ["6682", "6703"], ["6806", "6807"], ["6835", "6858"]
  ].sort());
});
