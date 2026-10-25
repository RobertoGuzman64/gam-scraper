import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { reconcileGamOrderPickerEditorial } from "../mapping/providers/gam/orderpicker-editorial.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const base = gam.products.find((record) => record.reference === "2237");
assert.ok(base);

test("Fase 17: Yale MO10L corrige 2000 a 1000 kg con ficha técnica y resumen coincidentes", () => {
  const original = JSON.stringify(base);
  const corrected = reconcileGamOrderPickerEditorial(base);
  assert.notStrictEqual(corrected, base);
  assert.equal(corrected.title, "Preparapedidos 1000 Kg Yale MO10L");
  assert.equal(corrected.shortDescription, base.shortDescription);
  assert.equal(corrected.longDescription?.match(/1000 Kg/g)?.length, 2);
  assert.equal(corrected.longDescription?.match(/1000 kilogramos/g)?.length, 1);
  assert.doesNotMatch(corrected.longDescription ?? "", /\b2000\s*(?:kg|kilogramos)\b/i);
  assert.strictEqual(corrected.specs, base.specs);
  assert.equal(corrected.url, base.url);
  const prepared = prepareProduct(base, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.title, corrected.title);
  assert.equal(prepared.product.description_general, corrected.longDescription);
  assert.deepEqual(prepared.product.spec, base.specs);
  assert.equal(JSON.stringify(base), original);
  assert.strictEqual(reconcileGamOrderPickerEditorial(corrected), corrected);
});

test("Fase 17: rechaza cambios de identidad, origen, carga, pesos, resumen y texto contradictorio", () => {
  const cases: readonly ProductRecord[] = [
    { ...base, providerId: "gomariz" },
    { ...base, reference: "9999" },
    { ...base, categoryKey: "manutencion" },
    { ...base, condition: "Segunda mano" },
    { ...base, brand: "HYSTER" },
    { ...base, model: "MO20" },
    { ...base, specs: { ...base.specs, Marca: "HYSTER" } },
    { ...base, specs: { ...base.specs, Modelo: "MO20" } },
    { ...base, specs: { ...base.specs, "Capacidad de carga (kg)": "2000 KG" } },
    { ...base, specs: { ...base.specs, "Centro de carga": "1200 mm" } },
    { ...base, specs: { ...base.specs, Peso: "1220 KG" } },
    { ...base, url: base.url.replace("recogepedidos-yale", "recogepedidos-hyster") },
    { ...base, title: "Preparapedidos 2500 Kg Yale MO10L" },
    { ...base, shortDescription: "Yale MO10L de capacidad 2000 kg" },
    { ...base, longDescription: base.longDescription?.replace("2000 kilogramos", "2500 kilogramos") ?? null },
    { ...base, longDescription: `${base.longDescription ?? ""} Otra capacidad de 1500 kg.` },
    { ...base, longDescription: base.longDescription?.replace("MO10L", "MO20P") ?? null }
  ];
  for (const [index, candidate] of cases.entries()) {
    assert.strictEqual(reconcileGamOrderPickerEditorial(candidate), candidate, String(index));
  }
});

