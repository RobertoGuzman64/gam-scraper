import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { prepareProduct } from "../preparation/prepare.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));
const reference = (code: string): ProductRecord => {
  const record = source.products.find((product) => product.reference === code);
  assert.ok(record, code);
  return record;
};
const categorySlug = (record: ProductRecord): string | null => {
  const prepared = prepareProduct(record, catalog);
  return catalog.categories.find((category) => category.id === prepared.product.categorySellID)?.slug ?? null;
};

test("Bravi Leonardo HD: identifica plataforma unipersonal con evidencia del mismo modelo", () => {
  const record = reference("2155");
  assert.equal(categorySlug(record), "plataforma-unipersonal-electrica");
  assert.equal(prepareProduct(record, catalog).status, "ready");
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, Modelo: "Lui 460" } }), null);
  assert.equal(categorySlug({ ...record, longDescription: "Plataforma elevadora para trabajos en altura" }), null);
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, "Tipo motor": "Diésel" } }), null);
  assert.equal(categorySlug({ ...record, title: "Plataforma elevadora Bravi Lui 460" }), null);
  assert.equal(categorySlug({ ...record, categoryKey: "carretillas-nuevas" }), null);
  assert.equal(categorySlug(reference("2159")), null);
  assert.equal(categorySlug(reference("157")), null);
});

test("Yale MP20XV: modelo, plataforma y batería deben corresponder a la misma ficha", () => {
  const record = reference("912");
  assert.equal(categorySlug(record), "transpaleta-electrica");
  assert.equal(prepareProduct(record, catalog).status, "ready");
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, Modelo: "MP20XD" } }), null);
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, "Capacidad de la batería": "Desconocida" } }), null);
  assert.equal(categorySlug({ ...record, specs: { ...record.specs, Motorización: "Manual" } }), null);
  assert.equal(categorySlug({ ...record, shortDescription: "Transpaleta Yale para almacenes" }), null);
  assert.equal(categorySlug({ ...record, longDescription: "Transpaleta para almacenes" }), null);
  assert.equal(categorySlug({ ...record, condition: "Segunda mano" }), null);
  assert.equal(categorySlug(reference("239")), null);
  assert.equal(categorySlug(reference("238")), null);
});

test("GAM: condición de ocasión explícita en ficha de barredora, sin fabricar categoría de destino", () => {
  const record = reference("6653");
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.product.condition, "Segunda_Mano");
  assert.equal(prepared.product.categorySellID, null);
  assert.equal(prepared.status, "review");
  assert.ok(!prepared.issues.includes("Condición comercial no confirmada (Nuevo o Segunda_Mano)"));
  assert.ok(prepared.issues.includes("Categoría Equipzilla sin correspondencia inequívoca"));
  assert.equal(prepareProduct({ ...record, shortDescription: "Barredora EUREKA MAGNUM en venta" }, catalog).product.condition, null);
  assert.equal(prepareProduct({ ...record, shortDescription: "EUREKA MAGNUM de segunda mano en venta nueva" }, catalog).product.condition, null);
  assert.equal(prepareProduct({ ...record, specs: { ...record.specs, Modelo: "Otro modelo" } }, catalog).product.condition, null);
  assert.equal(prepareProduct({ ...record, condition: "Nuevo" }, catalog).product.condition, null);
  for (const code of ["6358", "6367", "6814", "6815", "6969", "6970", "6971", "6987", "6988", "6989"]) {
    assert.equal(prepareProduct(reference(code), catalog).product.condition, null, code);
  }
});

test("GAM: categorías sin equivalente siguen sin forzarse a otra familia", () => {
  for (const code of ["3425", "3426", "1884", "3309", "6182", "3312", "4778", "6874", "4019", "4020", "4021", "4022", "2134", "2135"]) {
    assert.equal(categorySlug(reference(code)), null, code);
  }
});
