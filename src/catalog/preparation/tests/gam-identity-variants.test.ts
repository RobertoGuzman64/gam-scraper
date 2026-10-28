import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gamElevationConflictingIdentityReferences, gamHistoricalSerialCollisionGroups, gamSerialCollisionReferenceOrder } from "./gam-technical-cohorts.js";
import { requireProductReference } from "./require-product-reference.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { findSerialNumberCollisions } from "../../identity-conflicts.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { gamElevationBrandConflict, gamElevationIdentityConflict } from "../evidence/providers/gam/elevation-identity.js";
import { prepareImportBatch } from "../batch-identity.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));
const record = (reference: string): ProductRecord => requireProductReference(source.products, reference);
const model = catalog.attributes.find((attribute) => attribute.name === "Modelo");
assert.ok(model);
const resolvedModel = (product: ProductRecord) => {
  assert.ok(model);
  return resolveAttribute(product, model);
};

const mismatched = gamElevationConflictingIdentityReferences;

test("GAM: las nueve identidades incompatibles no publican Modelo del origen", () => {
  for (const reference of mismatched) {
    const product = record(reference);
    assert.equal(gamElevationIdentityConflict(product), true, reference);
    assert.deepEqual(resolvedModel(product), { status: "rejected", value: null }, reference);
    const prepared = prepareProduct(product, catalog);
    const editorial = reference === "6981" || reference === "6308" || reference === "5902" || reference === "4750" || reference === "4802" || reference === "4751" || reference === "4737" || reference === "4736" || reference === "4752";
    assert.equal(prepared.status, editorial ? "ready" : "review", reference);
    assert.equal(prepared.issues.includes("Atributo rechazado por seguridad: Modelo"), !editorial, reference);
    assert.ok(model);
    assert.equal(prepared.product.attributes.some((attribute) => attribute.attributeID === model.id), editorial, reference);
    assert.deepEqual(prepared.product.spec, product.specs);
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

test("GAM: tres series colisionadas conservan seis fichas y bloquean solo las Hyster", () => {
  const references = gamSerialCollisionReferenceOrder;
  const records = references.map(record);
  assert.deepEqual(findSerialNumberCollisions(records).map(({ products }) =>
    products.map((product) => product.reference).sort()).sort(), gamHistoricalSerialCollisionGroups.map((group) => [...group]).sort());
  const batch = prepareImportBatch(records, catalog);
  assert.equal(batch.products.length, 6);
  assert.equal(batch.totals.ready, 4);
  assert.equal(batch.totals.review, 2);
  assert.deepEqual(batch.products.map(({ product }) => product.reference), references);
  for (const product of batch.products) {
    if (["6806", "6807", "6835", "6858"].includes(product.product.reference ?? "")) assert.deepEqual(product.issues, []);
    else assert.ok(product.issues.some((issue) => issue.includes("Número de serie") && issue.includes("compartido")));
  }
});


test("GAM: bloquea la identidad cruzada de 6622 aunque el modelo de ficha tenga otro prefijo", () => {
  const product = record("6622");
  assert.equal(gamElevationBrandConflict(product), true);
  assert.equal(gamElevationIdentityConflict(product), true);
  assert.deepEqual(resolvedModel(product), { status: "rejected", value: null });
  const prepared = prepareProduct(product, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.ok(model);
  assert.equal(prepared.product.attributes.some((attribute) => attribute.attributeID === model.id), true);
  assert.equal(prepared.product.reference, "6622");
  assert.equal(prepared.product.sourceUrl, product.url);
});

test("GAM: no confunde erratas de marca, textos parciales ni dominios ajenos con una identidad cruzada", () => {
  const typo = record("6947");
  assert.equal(gamElevationBrandConflict(typo), false);
  assert.equal(gamElevationIdentityConflict(typo), false);
  const conflict = record("6622");
  assert.equal(gamElevationBrandConflict({ ...conflict, shortDescription: null }), false);
  assert.equal(gamElevationBrandConflict({ ...conflict, title: "Plataforma Genie GS-5390" }), false);
  assert.equal(gamElevationBrandConflict({ ...conflict, providerId: "gomariz" }), false);
  assert.equal(gamElevationBrandConflict({ ...conflict, url: "https://example.com/es/6622-genie-gs-5390" }), false);
  assert.equal(gamElevationBrandConflict({ ...conflict, specs: { ...conflict.specs, Marca: "JLG" } }), false);
  assert.equal(gamElevationBrandConflict({ ...conflict, specs: { ...conflict.specs, Modelo: "1930ES" } }), false);
});

test("GAM: el detector de marcas no introduce vetos nuevos en el catálogo actual salvo 6622", () => {
  const affected = source.products.filter(gamElevationBrandConflict).map((product) => product.reference);
  assert.deepEqual(affected, ["6622"]);
});
