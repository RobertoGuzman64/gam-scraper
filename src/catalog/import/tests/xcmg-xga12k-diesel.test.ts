import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { reconcileGamVerifiedXcmg12kDiesel } from "../mapping/providers/gam/xcmg-12k-diesel-evidence.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));
const record = source.products.find((product) => product.reference === "4752");
assert.ok(record);

test("reconcilia XGA12K diésel con valores contrastados y preserva la fuente", () => {
  const preparedRecord = reconcileGamVerifiedXcmg12kDiesel(record);
  assert.notStrictEqual(preparedRecord, record);
  assert.equal(preparedRecord.model, "XGA12K");
  assert.equal(preparedRecord.specs?.["Modelo"], "XGA12K");
  assert.equal(preparedRecord.specs?.["Longitud"], "5900 mm");
  assert.equal(preparedRecord.specs?.["Anchura"], "1800 mm");
  assert.equal(preparedRecord.specs?.["Altura"], "2020 mm");
  assert.equal(preparedRecord.specs?.["Peso"], "5600 KG");
  assert.equal(preparedRecord.specs?.["Altura de elevación (m)"], "12,5 metros");
  assert.equal(preparedRecord.specs?.["Dimensiones Cesta"], "1,4 x 0,7 metros");
  assert.equal(preparedRecord.specs?.["Capacidad de carga (kg)"], "230 KG");
  assert.equal(preparedRecord.specs?.["Tipo motor"], "Diésel");
  assert.equal(record.model, "XGA12ACK");
  assert.equal(record.specs?.["Modelo"], "XGA12ACK");
  assert.equal(record.specs?.["Peso"], "7450 KG");
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.deepEqual(prepared.product.spec, record.specs);
  assert.ok(prepared.product.attributes.some((attribute) => attribute.value === "XGA12K"));
  assert.ok(prepared.product.attributes.some((attribute) => attribute.value === "1,4 x 0,7 m"));
  assert.equal(prepared.product.attributes.some((attribute) => attribute.value === "XGA12ACK"), false);
});

test("rechaza versiones cambiadas sin identificarlas por parecido", () => {
  const variants: ProductRecord[] = [
    { ...record, providerId: "mercaeleva" },
    { ...record, reference: "4751" },
    { ...record, condition: "Segunda mano" },
    { ...record, categoryKey: "elevacion" },
    { ...record, brand: "Otra" },
    { ...record, externalReference: "XGA12ACK" },
    { ...record, model: "XGA12K" },
    { ...record, specs: { ...record.specs, Modelo: "XGA12K" } },
    { ...record, specs: { ...record.specs, Peso: "5600 KG" } },
    { ...record, specs: { ...record.specs, "Tipo motor": "Eléctrico" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "250 KG" } },
    { ...record, url: `${record.url}?variant=1` },
    { ...record, title: record.title?.replace("XGA12K", "XGA12ACK") ?? null },
    { ...record, shortDescription: record.shortDescription?.replace("230 kg", "250 kg") ?? null },
    { ...record, longDescription: record.longDescription?.replace("terrenos irregulares", "superficies planas") ?? null },
    { ...record, longDescription: null }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedXcmg12kDiesel(variant), variant, String(index));
  }
});

test("el corrector diésel solo afecta a la unidad acreditada", () => {
  for (const product of source.products) {
    if (product.reference === "4752") continue;
    assert.strictEqual(reconcileGamVerifiedXcmg12kDiesel(product), product, product.reference ?? "");
  }

});
