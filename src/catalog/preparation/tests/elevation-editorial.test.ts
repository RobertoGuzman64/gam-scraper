import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { reconcileGamElevationEditorialIdentity } from "../evidence/providers/gam/elevation-editorial.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const record = (reference: string): ProductRecord => {
  const found = source.products.find((item) => item.reference === reference);
  assert.ok(found, reference);
  return found;
};

test("corrige exclusivamente el modelo editorial discordante, con identidad de origen acreditada", () => {
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

test("no corrige modelos sin URL, ficha, marca o descripción corroborantes", () => {
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

test("el modelo de resumen requiere corroboración y no admite otras variantes", () => {
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

