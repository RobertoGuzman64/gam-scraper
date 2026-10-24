import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { gamElevationIdentityConflict } from "../mapping/providers/gam/elevation-identity.js";
import { reconcileGamVerifiedXcmg1823Model } from "../mapping/providers/gam/xcmg-1823-model-evidence.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const canonical = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const record = canonical.products.find((product) => product.reference === "4751");
assert.ok(record);

test("Fase 26: XCMG 4751 recupera el modelo corroborado conservando todas las evidencias originales", () => {
  const original = JSON.stringify(record);
  assert.equal(gamElevationIdentityConflict(record), true);
  const reconciled = reconcileGamVerifiedXcmg1823Model(record);
  assert.notStrictEqual(reconciled, record);
  assert.equal(reconciled.model, "XG1823RT");
  assert.equal(reconciled.specs?.["Modelo"], "XG1823RT");
  assert.equal(gamElevationIdentityConflict(reconciled), false);
  assert.strictEqual(reconcileGamVerifiedXcmg1823Model(reconciled), reconciled);
  assert.equal(JSON.stringify(record), original);
  const output = prepareProduct(record, catalog);
  assert.equal(output.status, "ready");
  assert.deepEqual(output.issues, []);
  assert.deepEqual(output.product.spec, record.specs);
  assert.equal(output.product.spec["Modelo"], "XG1523RT");
  assert.ok(output.product.attributes.some((attribute) => attribute.attributeID === 116 && attribute.value === "XG1823RT"));
  assert.equal(output.product.description_general, record.longDescription);
  assert.equal(output.product.description, record.shortDescription);
  assert.equal(output.product.title, record.title);
});

test("Fase 26: exige identidad y huellas exactas, sin extender el cambio a modelos parecidos", () => {
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "mercaeleva" },
    { ...record, reference: "4750" },
    { ...record, categoryKey: "elevacion" },
    { ...record, condition: "Segunda mano" },
    { ...record, url: `${record.url}-v2` },
    { ...record, title: `${record.title} v2` },
    { ...record, shortDescription: `${record.shortDescription} v2` },
    { ...record, brand: "JLG" },
    { ...record, externalReference: "XG1523RT" },
    { ...record, model: "XG1823RT" },
    { ...record, specs: { ...record.specs, Marca: "JLG" } },
    { ...record, specs: { ...record.specs, Modelo: "XG1823RT" } },
    { ...record, specs: { ...record.specs, "Altura de elevación (m)": "15 metros" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "700 KG" } },
    { ...record, specs: { ...record.specs, "Tipo motor": "Eléctrico" } },
    { ...record, specs: { ...record.specs, Peso: "9999 KG" } },
    { ...record, longDescription: `${record.longDescription} texto cambiado` },
    { ...record, longDescription: null }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedXcmg1823Model(variant), variant, String(index));
  }
});

test("Fase 26: únicamente 4751 cambia y todas las demás revisiones quedan protegidas", () => {
  const prepared = prepareImportBatch(canonical.products, catalog);
  assert.deepEqual(prepared.totals, { ready: 999, review: 9 });
  assert.equal(new Set(prepared.products.map((item) => item.product.reference)).size, 1008);
  for (const reference of ["6682", "6703", "6806", "6807", "6835", "6858"]) {
    const product = prepared.products.find((item) => item.product.reference === reference);
    assert.ok(product, reference);
    assert.equal(product.status, "review", reference);
  }
  for (const product of canonical.products) {
    if (product.reference === "4751") continue;
    assert.strictEqual(reconcileGamVerifiedXcmg1823Model(product), product, product.reference ?? "");
  }
});
