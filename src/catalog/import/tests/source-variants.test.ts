import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { SOURCE_CATEGORY_ISSUE, sourceCategoryQualityIssue } from "../mapping/source-category-quality.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const [gam, gomariz, mercaeleva] = await Promise.all([
  readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json"),
  readCanonicalCatalog("src/testing/fixtures/gomariz/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json")
]);
const source = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};
const radius = catalog.attributes.find((attribute) => attribute.name === "Radio de giro" && attribute.unit_option === "mm");
assert.ok(radius);

const confirmed = ["6688", "6689", "6690", "5918", "5", "6", "2163", "2164", "2165", "2169", "4022", "2373", "299"] as const;
const optionalRadius = ["2285", "2286", "2289", "2290"] as const;

test("tipo de origen corroborado por identidad y descripción sin inventar subtipos", () => {
  for (const reference of confirmed) {
    const record = source(reference);
    const prepared = prepareProduct(record, catalog);
    assert.equal(sourceCategoryQualityIssue(record), null, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.issues, [], reference);
    assert.deepEqual(prepared.product.spec, record.specs ?? {}, reference);
    assert.equal(prepared.product.categorySellID, null, reference);
    assert.equal(prepared.product.category, null, reference);
  }
});

test("las variantes de motor no acreditan una configuración particular ni admiten fichas contradictorias", () => {
  for (const reference of ["5", "6", "2163", "2164", "2165", "2169"]) {
    const record = source(reference);
    assert.equal(sourceCategoryQualityIssue({ ...record, specs: { ...record.specs, Modelo: "H99.0ZZ" } }), SOURCE_CATEGORY_ISSUE, reference);
    assert.equal(sourceCategoryQualityIssue({ ...record, specs: { ...record.specs, "Tipo motor": "GLP" } }), SOURCE_CATEGORY_ISSUE, reference);
    assert.equal(sourceCategoryQualityIssue({ ...record, longDescription: "Equipo industrial sin identidad acreditada" }), SOURCE_CATEGORY_ISSUE, reference);
    assert.equal(sourceCategoryQualityIssue({ ...record, url: record.url.replace("/carretillas-elevadoras-diesel-hyster/", "/carretillas-elevadoras-electricas-hyster/") }), SOURCE_CATEGORY_ISSUE, reference);
  }
  assert.equal(prepareProduct(source("2071"), catalog).status, "ready");
  assert.equal(prepareProduct(source("2314"), catalog).status, "ready");
  assert.equal(prepareProduct(source("2313"), catalog).status, "ready");
  assert.equal(prepareProduct(source("2312"), catalog).status, "ready");
});

test("vehículos, cuatriciclo, accesorio y equipo combinado requieren evidencia independiente", () => {
  for (const reference of ["6688", "6689", "6690"]) {
    const record = source(reference);
    assert.equal(sourceCategoryQualityIssue({ ...record, specs: { ...record.specs, "Matrícula": "" } }), SOURCE_CATEGORY_ISSUE, reference);
    assert.equal(sourceCategoryQualityIssue({ ...record, longDescription: "Equipo sin identificación de automóvil" }), SOURCE_CATEGORY_ISSUE, reference);
    assert.equal(sourceCategoryQualityIssue({ ...record, url: record.url.replace("/vehiculos-segunda-mano/", "/lotes/") }), SOURCE_CATEGORY_ISSUE, reference);
  }
  const quadricycle = source("5918");
  assert.equal(sourceCategoryQualityIssue({ ...quadricycle, shortDescription: "Paxster Gen 2.2 eléctrico" }), SOURCE_CATEGORY_ISSUE);
  assert.equal(sourceCategoryQualityIssue({ ...quadricycle, specs: { ...quadricycle.specs, Modelo: "Gen 3.0" } }), SOURCE_CATEGORY_ISSUE);
  const cleaner = source("4022");
  assert.equal(sourceCategoryQualityIssue({ ...cleaner, longDescription: "TENNANT BF M30 para limpieza industrial" }), SOURCE_CATEGORY_ISSUE);
  const kit = source("2373");
  assert.equal(sourceCategoryQualityIssue({ ...kit, longDescription: "BRAVI SMALL-E equipo de elevación" }), SOURCE_CATEGORY_ISSUE);
  const train = source("299");
  assert.equal(sourceCategoryQualityIssue({ ...train, specs: { ...train.specs, Modelo: "Otro" } }), SOURCE_CATEGORY_ISSUE);
  assert.equal(sourceCategoryQualityIssue({ ...train, longDescription: "Remolque industrial" }), SOURCE_CATEGORY_ISSUE);
  for (const reference of ["2572", "2573"]) {
    assert.equal(sourceCategoryQualityIssue(source(reference)), SOURCE_CATEGORY_ISSUE, reference);
  }
});

test("radio multivariante omite el escalar y retiene el original sin escoger ningún extremo", () => {
  for (const reference of optionalRadius) {
    const record = source(reference);
    const prepared = prepareProduct(record, catalog);
    assert.deepEqual(resolveAttribute(record, radius), { status: "not_observed", value: null }, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.spec["Radio de giro"], record.specs?.["Radio de giro"], reference);
    const other = { ...record, longDescription: "Carretilla YALE de configuración diferente" };
    assert.equal(resolveAttribute(other, radius).status, "invalid", reference);
    const malformed = { ...record, specs: { ...record.specs, "Radio de giro": "389 / 4009" } };
    assert.equal(resolveAttribute(malformed, radius).status, "not_observed", reference);
    const scalar = { ...record, specs: { ...record.specs, "Radio de giro": "3580 mm" } };
    assert.equal(resolveAttribute(scalar, radius).status, "resolved", reference);
  }
  for (const reference of ["2287", "2288", "5996"]) {
    assert.equal(resolveAttribute(source(reference), radius).status, "not_observed", reference);
    assert.equal(prepareProduct(source(reference), catalog).status, "ready", reference);
  }
});

