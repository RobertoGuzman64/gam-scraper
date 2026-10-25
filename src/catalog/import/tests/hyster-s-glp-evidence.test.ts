import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { isGamVerifiedHysterSGlp, reconcileGamVerifiedHysterSGlp } from "../mapping/providers/gam/hyster-s-glp-evidence.js";
import { sourceCategoryQualityIssue } from "../mapping/source-category-quality.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));
const first = source.products.find((product) => product.reference === "2072");
const second = source.products.find((product) => product.reference === "2073");
assert.ok(first);
assert.ok(second);

for (const [record, model, capacity] of [
  [first, "S4.0FT", "4000"],
  [second, "S4.5FT", "4500"]
] as const) {
  test(`Fase 30: ${model} GLP se reconcilia preservando el spec original`, () => {
    const originalSpec = structuredClone(record.specs);
    const preparedRecord = reconcileGamVerifiedHysterSGlp(record);
    assert.notStrictEqual(preparedRecord, record);
    assert.equal(isGamVerifiedHysterSGlp(preparedRecord), true);
    assert.equal(sourceCategoryQualityIssue(preparedRecord), null);
    assert.equal(preparedRecord.title, `Carretilla elevadora GLP ${capacity}Kg Hyster ${model}`);
    assert.match(preparedRecord.shortDescription ?? "", /Carretilla Elevadora GLP/);
    assert.equal(preparedRecord.specs?.["Motorización"], "GLP");
    assert.equal(preparedRecord.specs?.["Tipo motor"], "Kubota 3.8L LPG");
    assert.deepEqual(record.specs, originalSpec);
    assert.equal(record.specs?.["Motorización"], "Diésel");
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.status, "ready");
    assert.deepEqual(prepared.issues, []);
    assert.deepEqual(prepared.product.spec, originalSpec);
    assert.equal(prepared.product.title, preparedRecord.title);
    assert.equal(prepared.product.description, preparedRecord.shortDescription);
    assert.equal(prepared.product.description_general, preparedRecord.longDescription);
    assert.equal(reconcileGamVerifiedHysterSGlp(preparedRecord), preparedRecord);
  });
}

test("retira solo las afirmaciones diésel incompatibles de S4.0FT", () => {
  const corrected = reconcileGamVerifiedHysterSGlp(first);
  assert.equal(/di[eé]sel/i.test(corrected.longDescription ?? ""), false);
  assert.equal(corrected.longDescription?.includes("motor Kubota 3.8L de 54,9 kW"), true);
  assert.equal(first.longDescription?.includes("impulsada por GLP o diésel"), true);
  assert.equal(reconcileGamVerifiedHysterSGlp(second).longDescription, second.longDescription);
});

test("las variantes de origen no se corrigen por aproximación", () => {
  for (const record of [first, second]) {
    const variants: ProductRecord[] = [
      { ...record, providerId: "mercaeleva" },
      { ...record, reference: "9999" },
      { ...record, categoryKey: "otros" },
      { ...record, condition: "Segunda mano" },
      { ...record, brand: "YALE" },
      { ...record, model: "S5.0FT" },
      { ...record, url: `${record.url}?modified=1` },
      { ...record, title: record.title?.replace("diésel", "GLP") ?? null },
      { ...record, shortDescription: record.shortDescription?.replace("Diésel", "GLP") ?? null },
      { ...record, specs: { ...record.specs, "Motorización": "GLP" } },
      { ...record, specs: { ...record.specs, "Tipo motor": "Kubota 3.8L Diesel" } },
      { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "5000 KG" } },
      { ...record, longDescription: record.longDescription?.replace("Kubota", "otro motor") ?? null },
      { ...record, longDescription: null }
    ];
    for (const [index, variant] of variants.entries()) {
      assert.strictEqual(reconcileGamVerifiedHysterSGlp(variant), variant, `${record.reference}:${index}`);
    }
    const prepared = reconcileGamVerifiedHysterSGlp(record);
    assert.equal(isGamVerifiedHysterSGlp({ ...prepared, title: "Otra máquina" }), false);
    assert.equal(isGamVerifiedHysterSGlp({ ...prepared, specs: { ...prepared.specs, "Motorización": "Diésel" } }), false);
    assert.equal(isGamVerifiedHysterSGlp({ ...prepared, longDescription: "Descripción diferente" }), false);
  }
});

test("otras unidades no reciben la reconciliación Hyster GLP", () => {
  for (const product of source.products) {
    if (product.reference === "2072" || product.reference === "2073") continue;
    assert.strictEqual(reconcileGamVerifiedHysterSGlp(product), product, product.reference ?? "");
  }

});
