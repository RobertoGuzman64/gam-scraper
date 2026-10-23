import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { findSerialNumberCollisions } from "../../identity-conflicts.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { gamElevationIdentityConflict } from "../mapping/providers/gam/elevation-identity.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));
const record = (reference: string): ProductRecord => {
  const found = source.products.find((product) => product.reference === reference);
  assert.ok(found, reference);
  return found;
};
const model = catalog.attributes.find((attribute) => attribute.name === "Modelo");
assert.ok(model);
const resolvedModel = (product: ProductRecord) => {
  assert.ok(model);
  return resolveAttribute(product, model);
};

const mismatched = ["6981", "4736", "4737", "4750", "4802", "4751", "4752", "5902", "6308"];

test("GAM: las nueve identidades incompatibles no publican Modelo del origen", () => {
  for (const reference of mismatched) {
    const product = record(reference);
    assert.equal(gamElevationIdentityConflict(product), true, reference);
    assert.deepEqual(resolvedModel(product), { status: "rejected", value: null }, reference);
    const prepared = prepareProduct(product, catalog);
    assert.equal(prepared.status, "review", reference);
    assert.ok(prepared.issues.includes("Atributo rechazado por seguridad: Modelo"), reference);
    assert.ok(model);
    assert.equal(prepared.product.attributes.some((attribute) => attribute.attributeID === model.id), false, reference);
    assert.equal(prepared.product.reference, reference);
  }
});

test("GAM: una variante incompatible explícita en uno de los textos también invalida la identidad", () => {
  const original = record("4730");
  assert.equal(gamElevationIdentityConflict(original), false);
  assert.equal(resolvedModel(original).status, "resolved");
  const incompatible = { ...original, shortDescription: "XCMG XG0608CW Nueva" };
  assert.equal(gamElevationIdentityConflict(incompatible), true);
  assert.equal(resolvedModel(incompatible).status, "rejected");
  assert.equal(prepareProduct(incompatible, catalog).status, "review");
  assert.equal(gamElevationIdentityConflict({ ...original, title: "Plataforma XCMG XG0608CW" }), true);
});

test("GAM: variantes abreviadas compatibles y otras compañías conservan sus atributos", () => {
  const original = record("4730");
  const lithium = {
    ...original,
    model: "XG0608C-LI",
    title: "Plataforma tijera XCMG XG0608C con batería de litio",
    shortDescription: "XCMG XG0608C-LI Nueva",
    specs: { ...original.specs, "Modelo": "XG0608C-LI" }
  };
  assert.equal(gamElevationIdentityConflict(lithium), false);
  assert.equal(resolvedModel(lithium).status, "resolved");
  assert.equal(gamElevationIdentityConflict({ ...original, providerId: "gomariz" }), false);
  assert.equal(resolvedModel({ ...original, providerId: "gomariz" }).status, "resolved");
});

test("GAM: tres series colisionadas mantienen seis fichas independientes bloqueadas", () => {
  const references = ["6682", "6703", "6835", "6858", "6807", "6806"];
  const records = references.map(record);
  assert.deepEqual(findSerialNumberCollisions(records).map(({ products }) =>
    products.map((product) => product.reference).sort()).sort(), [
    ["6682", "6703"], ["6806", "6807"], ["6835", "6858"]
  ].sort());
  const batch = prepareImportBatch(records, catalog);
  assert.equal(batch.products.length, 6);
  assert.equal(batch.totals.ready, 0);
  assert.equal(batch.totals.review, 6);
  assert.deepEqual(batch.products.map(({ product }) => product.reference), references);
  for (const product of batch.products) {
    assert.ok(product.issues.some((issue) => issue.includes("Número de serie") && issue.includes("compartido")));
  }
});
