import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { reconcileGamVerifiedHysterH18xdDiesel } from "../mapping/providers/gam/hyster-h18xd-diesel-evidence.js";
import { sourceCategoryQualityIssue } from "../mapping/source-category-quality.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const catalog = await loadImportCatalog();
const record = source.products.find((item) => item.reference === "2071");
assert.ok(record);

test("Fase 32: H18XD-9 conserva la ficha de origen y reconcilia el motor y el peso nominal documentados", () => {
  const original = structuredClone(record);
  const corrected = reconcileGamVerifiedHysterH18xdDiesel(record);
  assert.notStrictEqual(corrected, record);
  assert.equal(corrected.specs?.["Tipo motor"], "Mercedes-Benz OM934 Diésel");
  assert.equal(corrected.specs?.["Peso"], "22181 KG");
  assert.equal(corrected.specs?.["Motorización"], "Diésel");
  assert.equal(corrected.specs?.["Capacidad de carga (kg)"], "18200 KG");
  assert.equal(corrected.longDescription, record.longDescription);
  assert.equal(corrected.title, record.title);
  assert.strictEqual(reconcileGamVerifiedHysterH18xdDiesel(corrected), corrected);
  assert.equal(sourceCategoryQualityIssue(corrected), null);
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.category, "Carretillas Elevadoras Diésel");
  assert.deepEqual(prepared.product.spec, original.specs);
  assert.deepEqual(record, original);
});

test("Fase 32: no altera otras identidades ni fuentes modificadas", () => {
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "mercaeleva" },
    { ...record, reference: "2072" },
    { ...record, url: `${record.url}?edited=1` },
    { ...record, categoryKey: "otros" },
    { ...record, condition: "Segunda mano" },
    { ...record, brand: "YALE" },
    { ...record, model: "H18XD-6" },
    { ...record, externalReference: "H18XD-6" },
    { ...record, title: "Otra carretilla" },
    { ...record, shortDescription: "Otra descripción" },
    { ...record, longDescription: `${record.longDescription} otra variante` },
    { ...record, longDescription: null },
    { ...record, specs: { ...record.specs, "Tipo motor": "Mercedes-Benz OM934 Diésel" } },
    { ...record, specs: { ...record.specs, Peso: "22181 KG" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "18000 KG" } },
    { ...record, specs: { ...record.specs, "Altura de elevación (mm)": "6000 mm" } },
    { ...record, specs: { ...record.specs, "Motorización": "GLP" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedHysterH18xdDiesel(variant), variant, String(index));
  }
  for (const item of source.products) {
    if (item.reference === "2071") continue;
    assert.strictEqual(reconcileGamVerifiedHysterH18xdDiesel(item), item, item.reference ?? "");
  }
});

