import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { reconcileGamElevationEditorialIdentity } from "../mapping/providers/gam/elevation-editorial.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const record = (reference: string): ProductRecord => {
  const found = source.products.find((item) => item.reference === reference);
  assert.ok(found, reference);
  return found;
};

test("Fase 8: corrige exclusivamente el modelo editorial discordante, con identidad de origen acreditada", () => {
  for (const reference of ["6981", "6308"]) {
    const original = record(reference);
    const normalized = reconcileGamElevationEditorialIdentity(original);
    assert.notStrictEqual(normalized, original);
    assert.deepEqual(normalized.specs, original.specs);
    assert.equal(normalized.url, original.url);
    assert.equal(normalized.reference, original.reference);
    assert.equal(normalized.model, original.model);
    assert.equal(normalized.brand, original.brand);
    const prepared = prepareProduct(original, catalog);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.issues, []);
    assert.deepEqual(prepared.product.spec, original.specs);
    assert.equal(prepared.product.sourceUrl, original.url);
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.title, normalized.title);
    assert.equal(prepareProduct(normalized, catalog).status, "ready");
  }
  assert.equal(reconcileGamElevationEditorialIdentity(record("6981")).title,
    "Plataforma tijera diésel 12M GENIE GS-3384RT");
  assert.equal(reconcileGamElevationEditorialIdentity(record("6308")).shortDescription?.startsWith("➨ CTE AZ16 PICKUP Nueva"), true);
});

test("Fase 8: no corrige modelos sin URL, ficha, marca o descripción corroborantes", () => {
  const original = record("6981");
  const altered: readonly ProductRecord[] = [
    { ...original, brand: "OTRA" },
    { ...original, model: "GS-5390RT" },
    { ...original, specs: { ...original.specs, Modelo: "GS-5390 RT" } },
    { ...original, specs: { ...original.specs, Marca: "OTRA" } },
    { ...original, url: original.url.replace("gs-3384-rt", "gs-5390-rt") },
    { ...original, longDescription: `${original.longDescription ?? ""} La GENIE GS-5390 RT es otra versión.` },
    { ...original, shortDescription: "➨ GENIE GS-5390 RT Segunda Mano" },
    { ...original, title: "Plataforma articulada diésel GENIE GS-5390 RT" },
    { ...original, categoryKey: "manutencion" },
    { ...original, providerId: "gomariz" }
  ];
  for (const [index, item] of altered.entries()) {
    assert.strictEqual(reconcileGamElevationEditorialIdentity(item), item, String(index));
    if (index < 8) assert.equal(prepareProduct(item, catalog).status, "review", String(index));
  }
});

test("Fase 8: el modelo de resumen requiere corroboración y no admite otras variantes", () => {
  const original = record("6308");
  const altered: readonly ProductRecord[] = [
    { ...original, shortDescription: "➨ CTE AZ15 PICKUP Nueva ➨ Plataforma tijera 16 m" },
    { ...original, shortDescription: "➨ CTE AZ14 PICKUP Nueva ➨ Plataforma tijera sobre camión" },
    { ...original, longDescription: `${original.longDescription ?? ""} Otro modelo AZ14 PICKUP.` },
    { ...original, url: original.url.replace("az16-pickup", "az14-pickup") },
    { ...original, specs: { ...original.specs, Modelo: "AZ14 PICKUP" } }
  ];
  for (const [index, item] of altered.entries()) {
    assert.strictEqual(reconcileGamElevationEditorialIdentity(item), item, String(index));
  }
});

test("Fase 8: las identidades técnicas conflictivas permanecen bloqueadas en preparación por lote", () => {
  const batch = prepareImportBatch(source.products, catalog);
  assert.deepEqual(batch.totals, { ready: 1006, review: 2 });
  assert.equal(new Set(batch.products.map((item) => item.product.reference)).size, 1008);
  for (const reference of ["6682", "6703"]) {
    const entry = batch.products.find((item) => item.product.reference === reference);
    assert.ok(entry, reference);
    assert.equal(entry.status, "review", reference);
  }
});
