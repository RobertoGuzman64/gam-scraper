import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const original = source.products.find((product) => product.reference === "6834");
assert.ok(original);
const power = catalog.attributes.find((attribute) => attribute.name === "Potencia");
assert.ok(power);

const resolution = (record: ProductRecord) => resolveAttribute(record, power);

test("Fase 19: potencia comercial y bloque técnico mantienen sus unidades y evidencia originales", () => {
  const input = JSON.stringify(original);
  const result = prepareProduct(original, catalog);
  assert.deepEqual(resolution(original), { status: "resolved", value: 32 });
  assert.equal(result.status, "ready");
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.product.spec, original.specs);
  assert.equal(result.product.description, original.shortDescription);
  assert.equal(result.product.description_general, original.longDescription);
  assert.ok(result.product.attributes.some((item) => item.attributeID === power.id && item.value === 32));
  assert.equal(JSON.stringify(original), input);
});

test("Fase 19: discrepancias, cambios de identidad y potencias añadidas conservan el veto", () => {
  const long = original.longDescription ?? "";
  const variants: readonly ProductRecord[] = [
    { ...original, providerId: "mercaeleva" },
    { ...original, categoryKey: "otros-nuevos" },
    { ...original, condition: "Nuevo" },
    { ...original, reference: "9999" },
    { ...original, url: original.url.replace("online.gamrentals.com", "example.org") },
    { ...original, title: "Grupo electrógeno DEVOL VGR-40" },
    { ...original, brand: "OTRA" },
    { ...original, model: "VGR-40" },
    { ...original, year: "2025" },
    { ...original, specs: { ...original.specs, "Marca": "OTRA" } },
    { ...original, specs: { ...original.specs, "Modelo": "VGR-40" } },
    { ...original, specs: { ...original.specs, "Nº de serie": "OTRA-SERIE" } },
    { ...original, specs: { ...original.specs, "Potencia Motor (KW)": "25kw" } },
    { ...original, shortDescription: original.shortDescription?.replace("32kvas", "35kvas") ?? null },
    { ...original, longDescription: long.replace("37,5 kvas/30 kW", "40 kvas/30 kW") },
    { ...original, longDescription: long.replace("37,5 kvas/30 kW", "37,5 kvas/25 kW") },
    { ...original, longDescription: long.replace("Motor K4100D", "Motor distinto") },
    { ...original, longDescription: long.replace("de 32 kVA reciente", "de 35 kVA reciente") },
    { ...original, longDescription: `${long} Potencia nominal 40 kVA.` },
    { ...original, specs: { ...original.specs, Potencia: "40 kVA" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.notDeepEqual(resolution(variant), { status: "resolved", value: 32 }, String(index));
  }
});

test("Fase 19: la preparación total cambia una identidad, no añade ni pierde máquinas", () => {
  const batch = prepareImportBatch(source.products, catalog);
  assert.deepEqual(batch.totals, { ready: 1006, review: 2 });
  assert.equal(new Set(batch.products.map((item) => item.product.reference)).size, 1008);
  assert.equal(batch.products.find((item) => item.product.reference === "6834")?.status, "ready");
  assert.equal(batch.products.find((item) => item.product.reference === "2312")?.status, "ready");
});
