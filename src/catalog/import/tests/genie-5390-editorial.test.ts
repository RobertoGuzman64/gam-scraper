import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { gamElevationBrandConflict } from "../mapping/providers/gam/elevation-identity.js";
import { reconcileGamVerifiedGenie5390Editorial } from "../mapping/providers/gam/genie-5390-editorial.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const original = source.products.find((record) => record.reference === "6622");
assert.ok(original);

test("la unidad GS-5390 se identifica por ficha, serie, referencia y publicación GAM", () => {
  const snapshot = JSON.stringify(original);
  assert.equal(gamElevationBrandConflict(original), true);
  const corrected = reconcileGamVerifiedGenie5390Editorial(original);
  assert.notStrictEqual(corrected, original);
  assert.equal(corrected.title, "Plataforma tijera diésel 18M GENIE GS-5390");
  assert.equal(corrected.shortDescription, "➨ GENIE GS-5390 Segunda Mano ➨ Venta de plataforma de tijera diésel de 18 metros de altura de ocasión ⭐Capacidad de la cesta 680 kg ➨ Año 2014");
  assert.equal(gamElevationBrandConflict(corrected), false);
  assert.strictEqual(corrected.specs, original.specs);
  assert.equal(corrected.longDescription, original.longDescription);
  assert.equal(corrected.serialNumber, original.serialNumber);
  assert.equal(corrected.externalReference, original.externalReference);
  assert.equal(corrected.url, original.url);
  assert.equal(corrected.reference, original.reference);
  assert.strictEqual(reconcileGamVerifiedGenie5390Editorial(corrected), corrected);
  assert.equal(JSON.stringify(original), snapshot);
  const prepared = prepareProduct(original, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.deepEqual(prepared.product.spec, original.specs);
  assert.equal(prepared.product.title, corrected.title);
  assert.equal(prepared.product.description, corrected.shortDescription);
  assert.equal(prepared.product.description_general, corrected.longDescription);
  assert.ok(prepared.product.attributes.some((attribute) => attribute.attributeID === 116 && attribute.value === "GS-5390"));
});

test("variaciones de identidad, unidad, origen y especificaciones no se corrigen", () => {
  const variants: readonly ProductRecord[] = [
    { ...original, providerId: "gomariz" },
    { ...original, reference: "6625" },
    { ...original, categoryKey: "elevacion-nueva" },
    { ...original, condition: "Nuevo" },
    { ...original, url: original.url.replace("6622", "6625") },
    { ...original, title: "Plataforma GENIE GS-5390" },
    { ...original, shortDescription: original.shortDescription?.replace("230 kg", "680 kg") ?? null },
    { ...original, brand: "JLG" },
    { ...original, model: "GS-4390" },
    { ...original, externalReference: "JP-00310" },
    { ...original, year: "2015" },
    { ...original, serialNumber: "GS9014-49496" },
    { ...original, location: "MURCIA" },
    { ...original, specs: { ...original.specs, Marca: "JLG" } },
    { ...original, specs: { ...original.specs, Modelo: "GS-4390" } },
    { ...original, specs: { ...original.specs, "Nº de serie": "GS9014-49496" } },
    { ...original, specs: { ...original.specs, Horómetro: "1522 horas" } },
    { ...original, specs: { ...original.specs, "Altura de elevación (m)": "8 metros" } },
    { ...original, specs: { ...original.specs, "Capacidad de carga (kg)": "1400 KG" } },
    { ...original, specs: { ...original.specs, "Pendiente superable": "30%" } },
    { ...original, longDescription: `${original.longDescription ?? ""} Otra variante de máquina.` },
    { ...original, longDescription: null }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedGenie5390Editorial(variant), variant, String(index));
  }
});

test("el corrector Genie no afecta a otras unidades", () => {
  for (const record of source.products) {
    if (record.reference === "6622") continue;
    assert.strictEqual(reconcileGamVerifiedGenie5390Editorial(record), record, record.reference ?? "");
  }
});
