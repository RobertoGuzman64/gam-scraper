import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { gamElevationSourceIdentityConflict } from "../mapping/providers/gam/elevation-identity.js";
import { reconcileGamVerifiedSnorkelS4732e } from "../mapping/providers/gam/snorkel-s4732e-evidence.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const catalog = await loadImportCatalog();
const record = source.products.find((item) => item.reference === "6236");
assert.ok(record);

test("Fase 33: SNORKEL S4732E reconcilia la identidad editorial con la unidad identificada por serie", () => {
  const original = structuredClone(record);
  assert.equal(gamElevationSourceIdentityConflict(record), true);
  const corrected = reconcileGamVerifiedSnorkelS4732e(record);
  assert.notStrictEqual(corrected, record);
  assert.equal(corrected.title, "Plataforma tijera eléctrica 12M SNORKEL S4732E");
  assert.equal(corrected.shortDescription, "➨ SNORKEL S4732E Segunda Mano ➨ Venta de plataforma de tijera eléctrica de 12 metros de altura de ocasión ⭐Capacidad de la cesta 350 kg ➨ Año 2018");
  assert.ok(corrected.longDescription?.includes("altura de trabajo de aproximadamente 12 metros"));
  assert.ok(corrected.longDescription?.includes("una capacidad de carga de 350 kg"));
  assert.ok(!corrected.longDescription?.includes("S3219E"));
  assert.ok(!corrected.longDescription?.includes("8 metros"));
  assert.ok(!corrected.longDescription?.includes("250 kg"));
  assert.equal(gamElevationSourceIdentityConflict(corrected), false);
  assert.strictEqual(corrected.specs, record.specs);
  assert.equal(corrected.serialNumber, record.serialNumber);
  assert.equal(corrected.externalReference, record.externalReference);
  assert.strictEqual(reconcileGamVerifiedSnorkelS4732e(corrected), corrected);
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.category, "Plataformas de Tijera Eléctricas de Segunda Mano");
  assert.equal(prepared.product.title, corrected.title);
  assert.equal(prepared.product.description, corrected.shortDescription);
  assert.equal(prepared.product.description_general, corrected.longDescription);
  assert.deepEqual(prepared.product.spec, original.specs);
  assert.deepEqual(record, original);
});

test("Fase 33: impide reconciliar fichas similares con identidad o evidencia técnica divergente", () => {
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "6237" },
    { ...record, url: `${record.url}?ref=6236` },
    { ...record, categoryKey: "elevacion-nueva" },
    { ...record, condition: "Nuevo" },
    { ...record, externalReference: "GAM-04168" },
    { ...record, brand: "JLG" },
    { ...record, model: "S3219E" },
    { ...record, serialNumber: "S4732E-01-180200368" },
    { ...record, year: "2017" },
    { ...record, location: "TOLEDO" },
    { ...record, title: "Plataforma tijera eléctrica 12M SNORKEL S4732E" },
    { ...record, shortDescription: record.shortDescription?.replace("250 kg", "350 kg") ?? null },
    { ...record, longDescription: `${record.longDescription ?? ""} otra variante` },
    { ...record, longDescription: null },
    { ...record, specs: { ...record.specs, Modelo: "S3219E" } },
    { ...record, specs: { ...record.specs, "Nº de serie": "S4732E-01-180200368" } },
    { ...record, specs: { ...record.specs, "Altura de elevación (m)": "8 metros" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "250 KG" } },
    { ...record, specs: { ...record.specs, Anchura: "810 mm" } },
    { ...record, specs: { ...record.specs, "Dimensiones Cesta": "1,63X0,74 metros" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedSnorkelS4732e(variant), variant, String(index));
  }
  for (const item of source.products) {
    if (item.reference !== "6236") assert.strictEqual(reconcileGamVerifiedSnorkelS4732e(item), item, item.reference ?? "");
  }
});

