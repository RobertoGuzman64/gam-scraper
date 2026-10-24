import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { gamCleaningCorrectedWidth } from "../mapping/providers/gam/cleaning.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const width = catalog.attributes.find((attribute) => attribute.name === "Ancho de trabajo" && attribute.unit_option === "mm");
assert.ok(width);
const original = source.products.find((product) => product.reference === "4004");
assert.ok(original);

const checked = (record: ProductRecord): void => {
  assert.notEqual(gamCleaningCorrectedWidth(record), 800);
  assert.notDeepEqual(resolveAttribute(record, width), { status: "resolved", value: 800 });
};

test("Fase 22: Tennant T600e D80 distingue anchura de fregado y anchura de secado", () => {
  const before = JSON.stringify(original);
  assert.equal(original.specs?.["Anchura trabajo"], "1,1 metros");
  assert.match(original.longDescription ?? "", /ancho de fregado de hasta 900 mm/);
  assert.equal(gamCleaningCorrectedWidth(original), 800);
  assert.deepEqual(resolveAttribute(original, width), { status: "resolved", value: 800 });
  const prepared = prepareProduct(original, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.deepEqual(prepared.product.spec, original.specs);
  assert.equal(prepared.product.description_general?.includes("hasta 900 mm"), true);
  assert.ok(prepared.product.attributes.some((value) => value.attributeID === width.id && value.value === 800));
  assert.equal(JSON.stringify(original), before);
});

test("Fase 22: se rechazan variantes y contradicciones no documentadas", () => {
  const variants: readonly ProductRecord[] = [
    { ...original, providerId: "mercaeleva" },
    { ...original, reference: "4002" },
    { ...original, condition: "Segunda mano" },
    { ...original, categoryKey: "limpieza-barredoras" },
    { ...original, url: original.url.replace("4004-", "4005-") },
    { ...original, title: "Fregadora TENNANT FCA T600e D90" },
    { ...original, shortDescription: "Fregadora TENNANT FCA T600e D80" },
    { ...original, brand: "Kärcher" },
    { ...original, model: "FCA T600e D90" },
    { ...original, specs: { ...original.specs, Marca: "Kärcher" } },
    { ...original, specs: { ...original.specs, Modelo: "FCA T600e D90" } },
    { ...original, specs: { ...original.specs, "Anchura trabajo": "0,9 metros" } },
    { ...original, specs: { ...original.specs, "RPM cepillo": "250" } },
    { ...original, longDescription: null },
    { ...original, longDescription: original.longDescription?.replace("hasta 900 mm", "de 900 mm") ?? null },
    { ...original, longDescription: original.longDescription?.replace("hasta 900 mm", "hasta 700 mm") ?? null },
    { ...original, longDescription: `${original.longDescription} Ancho de fregado de 600 mm.` },
    { ...original, longDescription: `${original.longDescription} La anchura de trabajo es de 900 mm.` }
  ];
  for (const [index, variant] of variants.entries()) {
    checked(variant);
    assert.notDeepEqual(prepareProduct(variant, catalog).product.attributes, prepareProduct(original, catalog).product.attributes, String(index));
  }
});

test("Fase 22: la excepción no afecta a ninguna otra ficha GAM", () => {
  for (const record of source.products) {
    if (record.reference === "4004") continue;
    if (gamCleaningCorrectedWidth(record) === 800) assert.equal(record.reference, "4002");
  }
  const batch = prepareImportBatch(source.products, catalog);
  assert.deepEqual(batch.totals, { ready: 1006, review: 2 });
  assert.equal(new Set(batch.products.map((item) => item.product.reference)).size, 1008);
  assert.equal(batch.products.find((item) => item.product.reference === "4004")?.status, "ready");
  assert.equal(batch.products.find((item) => item.product.reference === "2312")?.status, "ready");
});
