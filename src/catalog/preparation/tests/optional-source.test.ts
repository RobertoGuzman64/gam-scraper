import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { SOURCE_CATEGORY_ISSUE, sourceCategoryQualityIssue } from "../source/category-quality.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const mercaeleva = await readCanonicalCatalog("src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json");
const source = (provider: "gam" | "mercaeleva", reference: string): ProductRecord => {
  const product = (provider === "gam" ? gam : mercaeleva).products.find((item) => item.reference === reference);
  assert.ok(product, `${provider}:${reference}`);
  return product;
};
const radius = catalog.attributes.find((item) => item.name === "Radio de giro" && item.unit_option === "mm");
assert.ok(radius);

const unknownGam = ["6358", "6367", "6814", "6815", "6969", "6970", "6971", "6987", "6988", "6989"] as const;

test("diez publicaciones GAM sin estado comercial se preservan sin inferir nueva u ocasión", () => {
  for (const reference of unknownGam) {
    const record = source("gam", reference);
    const prepared = prepareProduct(record, catalog);
    assert.equal(record.condition, null, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.condition, null, reference);
    assert.equal(prepared.product.categorySellID, null, reference);
    assert.deepEqual(prepared.product.spec, record.specs ?? {}, reference);
    assert.equal(sourceCategoryQualityIssue(record), null, reference);
  }
});

test("dos publicaciones Mercaeleva sin estado se conservan sin alterar especificaciones", () => {
  for (const reference of ["M294-4678", "M958-0132"]) {
    const record = source("mercaeleva", reference);
    const prepared = prepareProduct(record, catalog);
    assert.equal(record.condition, null, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.condition, null, reference);
    assert.deepEqual(prepared.product.spec, record.specs ?? {}, reference);
  }
});

test("tipificar carros, módulos y lotes exige corroboración independiente", () => {
  const cart = source("gam", "6358");
  assert.equal(sourceCategoryQualityIssue({ ...cart, specs: { ...cart.specs, Modelo: "OTRO" } }), SOURCE_CATEGORY_ISSUE);
  assert.equal(sourceCategoryQualityIssue({ ...cart, shortDescription: "Equipo KNOTT sin tipo confirmado" }), SOURCE_CATEGORY_ISSUE);
  const structure = source("gam", "6814");
  assert.equal(sourceCategoryQualityIssue({ ...structure, specs: { ...structure.specs, Altura: "sin dato" } }), SOURCE_CATEGORY_ISSUE);
  assert.equal(sourceCategoryQualityIssue({ ...structure, title: "Módulo de vivienda" }), SOURCE_CATEGORY_ISSUE);
  const lot = source("gam", "6969");
  assert.equal(sourceCategoryQualityIssue({ ...lot, title: "Carretilla elevadora" }), SOURCE_CATEGORY_ISSUE);
  assert.equal(sourceCategoryQualityIssue({ ...lot, url: lot.url.replace("/lotes/", "/estructuras/") }), SOURCE_CATEGORY_ISSUE);
  assert.equal(sourceCategoryQualityIssue({ ...lot, shortDescription: "Lote sin descripción de contenido" }), SOURCE_CATEGORY_ISSUE);
  assert.equal(sourceCategoryQualityIssue({ ...lot, specs: { "Capacidad de carga": "1000 kg" } }), SOURCE_CATEGORY_ISSUE);
});

test("radios publicados como pares permanecen sin escalar y una medida única sí se normaliza", () => {
  for (const reference of ["2287", "2288", "5996"]) {
    const record = source("gam", reference);
    const prepared = prepareProduct(record, catalog);
    assert.deepEqual(resolveAttribute(record, radius), { status: "not_observed", value: null }, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.spec["Radio de giro"], record.specs?.["Radio de giro"], reference);
    assert.ok(!prepared.product.attributes.some((value) => value.attributeID === radius.id), reference);
    const withoutModel = { ...record, longDescription: "Carretilla eléctrica de otra familia" };
    assert.equal(resolveAttribute(withoutModel, radius).status, "invalid", reference);
    const unambiguous = { ...record, specs: { ...record.specs, "Radio de giro": "3580 mm" } };
    assert.deepEqual(resolveAttribute(unambiguous, radius), { status: "resolved", value: 3580 }, reference);
  }
});

test("la ficha histórica 2312 supera la preparación individual", () => {
  assert.equal(prepareProduct(source("gam", "2312"), catalog).status, "ready");
});
