import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { sourceCategoryQualityIssue, SOURCE_CATEGORY_ISSUE } from "../mapping/source-category-quality.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const [gam, gomariz, mercaeleva] = await Promise.all([
  readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json"),
  readCanonicalCatalog("storage/scraped/gomariz/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json")
]);
const musoshi = gam.products.find((product) => product.reference === "6806");
assert.ok(musoshi);

test("Fase 40: Musoshi 6806 documenta un cuatriciclo y no se clasifica como furgoneta", () => {
  const original = structuredClone(musoshi);
  assert.equal(sourceCategoryQualityIssue(musoshi), null);
  const prepared = prepareProduct(musoshi, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.categorySellID, null);
  assert.equal(prepared.product.category, null);
  assert.deepEqual(prepared.product.spec, musoshi.specs);
  assert.deepEqual(prepared.product.attributes, []);
  assert.ok(prepared.importIssues?.createMany.some((issue) => issue.startsWith("Categoría no ")));
  assert.deepEqual(musoshi, original);
});

test("Fase 40: variantes de identidad, modelo, documentación y origen quedan sin confirmar", () => {
  const variants: readonly ProductRecord[] = [
    { ...musoshi, providerId: "mercaeleva" },
    { ...musoshi, reference: "6808" },
    { ...musoshi, url: `${musoshi.url}?revision=1` },
    { ...musoshi, externalReference: "INQ-04324" },
    { ...musoshi, title: "Musoshi PoP Up" },
    { ...musoshi, categoryKey: "otros" },
    { ...musoshi, condition: "Nuevo" },
    { ...musoshi, brand: "ZERO" },
    { ...musoshi, model: "P1.7" },
    { ...musoshi, year: "2023" },
    { ...musoshi, location: "VALENCIA" },
    { ...musoshi, serialNumber: "NRXL3AALS10000102" },
    { ...musoshi, shortDescription: "Vehículo eléctrico urbano" },
    { ...musoshi, longDescription: "Cuatriciclo sin identificación acreditada" },
    { ...musoshi, specs: { ...musoshi.specs, Modelo: "P1.7" } },
    { ...musoshi, specs: { ...musoshi.specs, "Matrícula": "2722MHH" } },
    { ...musoshi, specs: { ...musoshi.specs, "Nº de serie": "NRXL3AALS10000102" } },
    { ...musoshi, specs: { ...musoshi.specs, "Tipo motor": "Diésel" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(sourceCategoryQualityIssue(variant), SOURCE_CATEGORY_ISSUE, String(index));
    assert.equal(prepareProduct(variant, catalog).status, "review", String(index));
  }
});

test("Fase 40: el origen conserva ambas referencias y M827-8304 sigue bloqueada", () => {
  const batches = [gam, gomariz, mercaeleva].map((source) => prepareImportBatch(source.products, catalog));
  assert.deepEqual(batches.map((batch) => batch.totals), [
    { ready: 1006, review: 2 },
    { ready: 143, review: 0 },
    { ready: 217, review: 1 }
  ]);
  const products = batches.flatMap((batch) => batch.products);
  assert.equal(products.length, 1369);
  assert.equal(new Set(products.map((entry) => `${entry.product.providerId}:${entry.product.reference}`)).size, 1369);
  const target = products.find((entry) => entry.product.reference === "6806" && entry.product.providerId === "gam");
  assert.ok(target);
  assert.equal(target.status, "ready");
  assert.deepEqual(target.issues, []);
  for (const reference of ["6682", "6703"]) {
    const entry = batches[0]?.products.find((item) => item.product.reference === reference);
    assert.equal(entry?.status, "review", reference);
    assert.ok(entry.issues.some((issue) => issue.includes("Número de serie")), reference);
  }
  const linde = batches[2]?.products.find((item) => item.product.reference === "M827-8304");
  assert.equal(linde?.status, "review");
  assert.deepEqual([...(linde?.issues ?? [])].sort(), [
    "Atributo contradictorio: Capacidad de carga",
    "Atributo contradictorio: Tipo de mástil",
    "MER0798: el anuncio del vendedor publica 4.800 kg y mástil dúplex en el texto, pero 3.000 kg y mástil tríplex en los campos técnicos; la republicación en Machineryline conserva ambas discrepancias. Confirmar capacidad efectiva y mástil instalado con el vendedor o la placa antes de validar la ficha"
  ].sort());
});
