import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { reconcileGamUsedLiftEditorial } from "../mapping/providers/gam/used-lift-editorial.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const source = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("alturas de unidades HYSTER con serie y especificación concordantes", () => {
  for (const [reference, year, height] of [["5275", "2013", "4,6"], ["5864", "2018", "3,54"]] as const) {
    const record = source(reference);
    const original = JSON.stringify(record);
    const corrected = reconcileGamUsedLiftEditorial(record);
    assert.notStrictEqual(corrected, record, reference);
    assert.ok(corrected.longDescription?.includes(`altura de elevación de ${height} metros`), reference);
    assert.ok(corrected.longDescription?.includes(`en ${year}`), reference);
    assert.strictEqual(corrected.title, record.title);
    assert.strictEqual(corrected.shortDescription, record.shortDescription);
    assert.strictEqual(corrected.specs, record.specs);
    assert.strictEqual(reconcileGamUsedLiftEditorial(corrected), corrected);
    assert.equal(JSON.stringify(record), original);
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.issues, [], reference);
    assert.deepEqual(prepared.product.spec, record.specs, reference);
    assert.equal(prepared.product.description_general, corrected.longDescription, reference);
  }
});

test("no se corrigen unidades alteradas, otras alturas o fuentes ambiguas", () => {
  for (const reference of ["5275", "5864"]) {
    const record = source(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "mercaeleva" },
      { ...record, reference: "9999" },
      { ...record, condition: "Nuevo" },
      { ...record, categoryKey: "carretillas-nuevas" },
      { ...record, brand: "YALE" },
      { ...record, model: "H3.0FT" },
      { ...record, year: "2025" },
      { ...record, specs: { ...record.specs, Marca: "YALE" } },
      { ...record, specs: { ...record.specs, Modelo: "H3.0FT" } },
      { ...record, specs: { ...record.specs, "Nº de serie": "OTRA-SERIE" } },
      { ...record, specs: { ...record.specs, "Altura de elevación (mm)": "9999 mm" } },
      { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "1500 KG" } },
      { ...record, url: record.url.replace("online.gamrentals.com", "example.org") },
      { ...record, title: "Equipo con modelo dudoso" },
      { ...record, shortDescription: "Ficha incompleta" },
      { ...record, longDescription: `${record.longDescription} Con otra altura de elevación de 5,2 metros.` },
      { ...record, longDescription: record.longDescription?.replace("fabricad", "revisad") ?? null },
      { ...record, longDescription: record.longDescription?.replace("altura de elevación de", "altura máxima de") ?? null }
    ];
    for (const [index, candidate] of variants.entries()) {
      assert.strictEqual(reconcileGamUsedLiftEditorial(candidate), candidate, `${reference}/${index}`);
    }
  }
});

test("las Yale de control permanecen sin modificación editorial", () => {
  for (const reference of ["2311", "2312"]) {
    const record = source(reference);
    assert.strictEqual(reconcileGamUsedLiftEditorial(record), record);
    assert.equal(prepareProduct(record, catalog).status, "ready", reference);
  }
});
