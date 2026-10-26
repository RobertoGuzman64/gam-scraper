import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { isGamVerifiedYaleGc55vxGlp, reconcileGamVerifiedYaleGc55vxGlp } from "../mapping/providers/gam/yale-gc55vx-glp-evidence.js";
import { newCategorySlug } from "../mapping/providers/gam/categories.js";
import { sourceCategoryQualityIssue } from "../mapping/source-category-quality.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const record = source.products.find((item) => item.reference === "2313");
assert.ok(record);

test("Yale GC55VX confirma GLP sin alterar specs ni JSON canónicos", () => {
  const original = structuredClone(record);
  const corrected = reconcileGamVerifiedYaleGc55vxGlp(record);
  assert.notStrictEqual(corrected, record);
  assert.equal(isGamVerifiedYaleGc55vxGlp(corrected), true);
  assert.equal(corrected.title, "Carretilla elevadora GLP Yale GC55VX");
  assert.equal(corrected.specs?.["Motorización"], "GLP");
  assert.equal(corrected.specs?.["Tipo motor"], "Kubota 3.8L LPG");
  assert.equal(corrected.specs?.["Capacidad de carga (kg)"], "5500 KG");
  assert.doesNotMatch(corrected.longDescription ?? "", /di[eé]sel/i);
  assert.equal(newCategorySlug(corrected), "carretilla-elevadora-glp");
  assert.equal(sourceCategoryQualityIssue(corrected), null);
  assert.strictEqual(reconcileGamVerifiedYaleGc55vxGlp(corrected), corrected);
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.category, "Carretillas Elevadoras GLP");
  assert.equal(prepared.product.title, corrected.title);
  assert.equal(prepared.product.description_general, corrected.longDescription);
  assert.deepEqual(prepared.product.spec, original.specs);
  assert.deepEqual(record, original);
});

test("Yale GC55VX no reconcilia otras identidades o pruebas de origen cambiadas", () => {
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "mercaeleva" },
    { ...record, reference: "2314" },
    { ...record, categoryKey: "otros-nuevos" },
    { ...record, condition: "Segunda mano" },
    { ...record, url: `${record.url}?revised=1` },
    { ...record, externalReference: "GC55SVX" },
    { ...record, brand: "HYSTER" },
    { ...record, model: "GC50VX" },
    { ...record, title: "Carretilla elevadora diésel Yale GC55VX" },
    { ...record, shortDescription: `${record.shortDescription ?? ""} modificado` },
    { ...record, longDescription: `${record.longDescription ?? ""} modificado` },
    { ...record, longDescription: null },
    { ...record, specs: { ...record.specs, Modelo: "GC55SVX" } },
    { ...record, specs: { ...record.specs, "Tipo motor": "Kubota Diesel" } },
    { ...record, specs: { ...record.specs, "Motorización": "GLP" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "5000 KG" } },
    { ...record, specs: { ...record.specs, Peso: "7700 KG" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedYaleGc55vxGlp(variant), variant, String(index));
  }
  const corrected = reconcileGamVerifiedYaleGc55vxGlp(record);
  assert.equal(isGamVerifiedYaleGc55vxGlp({ ...corrected, longDescription: "Descripción ajena" }), false);
  assert.equal(isGamVerifiedYaleGc55vxGlp({ ...corrected, title: "Carretilla diésel" }), false);
  assert.equal(isGamVerifiedYaleGc55vxGlp({ ...corrected, specs: { ...corrected.specs, "Motorización": "Eléctrico" } }), false);
  for (const item of source.products) {
    if (item.reference !== "2313") assert.strictEqual(reconcileGamVerifiedYaleGc55vxGlp(item), item, item.reference ?? "");
  }
});

