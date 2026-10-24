import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { reconcileGamUsedLiftEditorial } from "../mapping/providers/gam/used-lift-editorial.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const gam = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const catalog = await loadImportCatalog();
const original = gam.products.find((record) => record.reference === "6887");
assert.ok(original);

test("Fase 20: Toyota 6887 corrige las cuatro discrepancias editoriales con identidad confirmada", () => {
  const raw = JSON.stringify(original);
  const normalized = reconcileGamUsedLiftEditorial(original);
  assert.notStrictEqual(normalized, original);
  assert.equal(original.year, "2000");
  assert.equal(normalized.year, "2017");
  assert.equal(normalized.yearSource, "url");
  assert.ok(normalized.longDescription?.includes("altura de elevación de 5,5 metros"));
  assert.ok(normalized.longDescription?.includes("altura de 5,5 metros"));
  assert.ok(normalized.longDescription?.includes("capacidad de carga indicada de 2000 kg"));
  assert.ok(normalized.longDescription?.includes("Fabricada en el año 2017"));
  assert.doesNotMatch(normalized.longDescription ?? "", /4,7 metros|2500 kg|año 2016/);
  assert.strictEqual(normalized.specs, original.specs);
  assert.strictEqual(normalized.title, original.title);
  assert.strictEqual(normalized.shortDescription, original.shortDescription);
  assert.strictEqual(reconcileGamUsedLiftEditorial(normalized), normalized);
  assert.equal(JSON.stringify(original), raw);
  const prepared = prepareProduct(original, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.deepEqual(prepared.product.spec, original.specs);
  assert.equal(prepared.product.description_general, normalized.longDescription);
});

test("Fase 20: cambios de identidad, serie, fecha, evidencia o texto no reciben corrección", () => {
  const long = original.longDescription ?? "";
  const variants: readonly ProductRecord[] = [
    { ...original, providerId: "mercaeleva" },
    { ...original, categoryKey: "carretillas-nuevas" },
    { ...original, condition: "Nuevo" },
    { ...original, reference: "8887" },
    { ...original, url: original.url.replace("2017-", "2016-") },
    { ...original, title: original.title?.replace("2000", "2500") ?? null },
    { ...original, shortDescription: original.shortDescription?.replace("5,5", "4,7") ?? null },
    { ...original, brand: "HYSTER" },
    { ...original, model: "8FBMT25" },
    { ...original, serialNumber: "OTRA-SERIE" },
    { ...original, year: "2016" },
    { ...original, yearSource: "ficha" },
    { ...original, image: null },
    { ...original, specs: { ...original.specs, Marca: "HYSTER" } },
    { ...original, specs: { ...original.specs, Modelo: "8FBMT25" } },
    { ...original, specs: { ...original.specs, "Nº de serie": "OTRA-SERIE" } },
    { ...original, specs: { ...original.specs, "Altura de elevación (mm)": "4700 mm" } },
    { ...original, specs: { ...original.specs, "Capacidad de carga (kg)": "2500 KG" } },
    { ...original, longDescription: long.replace("4,7 metros", "4,8 metros") },
    { ...original, longDescription: long.replace("2500 kg", "2300 kg") },
    { ...original, longDescription: long.replace("año 2016", "año 2018") },
    { ...original, longDescription: `${long} Otra altura de elevación de 3,3 metros.` },
    { ...original, longDescription: `${long} Capacidad de carga indicada de 3000 kg.` },
    { ...original, longDescription: `${long} Fabricada en el año 2015.` },
    { ...original, longDescription: null }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamUsedLiftEditorial(variant), variant, String(index));
  }
});

test("Fase 20: una única unidad cambia de estado y la cohorte GAM sigue íntegra", () => {
  for (const record of gam.products) {
    if (record.reference === "6887" || record.reference === "5275" || record.reference === "5864") continue;
    assert.strictEqual(reconcileGamUsedLiftEditorial(record), record, record.reference ?? "sin referencia");
  }
  const batch = prepareImportBatch(gam.products, catalog);
  assert.deepEqual(batch.totals, { ready: 1006, review: 2 });
  assert.equal(new Set(batch.products.map((entry) => entry.product.reference)).size, gam.products.length);
  assert.equal(batch.products.find((entry) => entry.product.reference === "6887")?.status, "ready");
  for (const reference of ["6682", "6703"]) {
    assert.equal(batch.products.find((entry) => entry.product.reference === reference)?.status, "review", reference);
  }
});
