import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { reconcileGamVerifiedXga43kEditorial } from "../evidence/providers/gam/xga43k-editorial.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const original = source.products.find((record) => record.reference === "5902");
assert.ok(original);

test("XGA43K distingue capacidades limitadas y reconcilia las cifras técnicas editoriales", () => {
  const corrected = reconcileGamVerifiedXga43kEditorial(original);
  assert.notStrictEqual(corrected, original);
  assert.deepEqual(corrected.specs, original.specs);
  assert.equal(corrected.reference, original.reference);
  assert.equal(corrected.url, original.url);
  assert.equal(corrected.model, original.model);
  assert.equal(corrected.title, original.title);
  assert.match(corrected.shortDescription ?? "", /XGA43K Nueva/);
  assert.match(corrected.shortDescription ?? "", /300 kg sin limitación \/ 460 kg con limitación/);
  for (const fragment of ["41,2 m", "12.928 mm", "3.100 mm", "24.500 kg", "40 %", "2.440 × 900 mm", "Kubota V3307"]) {
    assert.ok(corrected.longDescription?.includes(fragment), fragment);
  }
  for (const fragment of ["230 kg", "Perkins", "20.500 kg", "45 %", "7,8 m", "910 mm"]) {
    assert.ok(!corrected.longDescription?.includes(fragment), fragment);
  }
  assert.equal(original.shortDescription?.includes("XGA36K"), true);
  assert.equal(original.longDescription?.includes("Perkins"), true);
  const prepared = prepareProduct(original, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.deepEqual(prepared.product.spec, original.specs);
  assert.equal(prepared.product.description, corrected.shortDescription);
  assert.equal(prepared.product.description_general, corrected.longDescription);
  assert.equal(prepared.product.attributes.some((value) => value.attributeID === 116 && value.value === "XGA43K"), true);
});

test("cambios de identidad, ficha técnica y textos no se autocorrigen", () => {
  const variants: readonly ProductRecord[] = [
    { ...original, providerId: "gomariz" },
    { ...original, reference: "6542" },
    { ...original, categoryKey: "elevacion" },
    { ...original, condition: "Segunda mano" },
    { ...original, url: original.url.replace("xga36k", "xga43k") },
    { ...original, title: original.title?.replace("XGA43K", "XGA36K") ?? null },
    { ...original, shortDescription: original.shortDescription?.replace("230 kg", "300 kg") ?? null },
    { ...original, brand: "JLG" },
    { ...original, model: "XGA36K" },
    { ...original, externalReference: "XGA36K" },
    { ...original, specs: { ...original.specs, Modelo: "XGA36K" } },
    { ...original, specs: { ...original.specs, Marca: "JLG" } },
    { ...original, specs: { ...original.specs, "Capacidad de carga (kg)": "230 KG" } },
    { ...original, specs: { ...original.specs, "Pendiente superable": "45%" } },
    { ...original, specs: { ...original.specs, Peso: "20500 KG" } },
    { ...original, specs: { ...original.specs, "Dimensiones Cesta": "2,44X0,91 metros" } },
    { ...original, longDescription: `${original.longDescription ?? ""} Se admite también 600 kg.` },
    { ...original, longDescription: original.longDescription?.replace("Perkins", "Kubota") ?? null },
    { ...original, longDescription: null }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedXga43kEditorial(variant), variant, String(index));
  }
});

test("el corrector XGA43K no modifica otras referencias", () => {
  for (const item of source.products) {
    if (item.reference !== "5902") assert.strictEqual(reconcileGamVerifiedXga43kEditorial(item), item, item.reference ?? "");
  }
});
