import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { resolveCommercialCondition } from "../preparation/condition.js";
import { prepareProduct } from "../preparation/prepare.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";

const catalog = await loadImportCatalog();
const product: ProductRecord = {
  providerId: "gomariz",
  categoryKey: "venta",
  categoryName: "Maquinaria de ocasión",
  url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-ss0507etijera-electrica-electric-scissor/",
  title: "LGMG SS0507E",
  shortDescription: null,
  longDescription: "Las tijeras eléctricas están diseñadas para trabajos de interior.",
  price: null,
  reference: "TE1858",
  brand: "LGMG",
  model: "SS0507E",
  year: "2022",
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  image: null,
  specs: { Motor: "Eléctrico", "Altura de trabajo": "6.3 m" }
};

test("Gomariz: la procedencia verificada de venta de ocasión permite resolver condición y categoría", () => {
  const prepared = prepareProduct(product, catalog);
  assert.equal(prepared.product.condition, "Segunda_Mano");
  assert.equal(prepared.product.categorySellID, 27);
  assert.ok(!prepared.issues.some((issue) => issue.includes("Condición comercial")));
  assert.ok(!prepared.issues.some((issue) => issue.includes("Categoría Equipzilla")));
  assert.equal(prepared.product.price, null);
  assert.ok(prepared.issues.includes("Precio no disponible o inválido"));
  assert.equal(prepared.status, "review");
});

test("Gomariz: no se extiende la condición de ocasión a otro dominio, ruta o colección", () => {
  const invalidSources: readonly ProductRecord[] = [
    { ...product, url: "https://example.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-ss0507e/" },
    { ...product, url: "https://gomarizrent.com.evil.test/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-ss0507e/" },
    { ...product, url: "https://www.gomarizrent.com/alquiler/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-ss0507e/" },
    { ...product, url: "https://www.gomarizrent.com/venta/" },
    { ...product, categoryKey: "alquiler" },
    { ...product, categoryName: "Maquinaria nueva" },
    { ...product, providerId: "otro-proveedor" },
    { ...product, url: "no-es-una-url" }
  ];
  for (const record of invalidSources) {
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.product.condition, null, record.url);
    assert.equal(prepared.product.categorySellID, null, record.url);
  }
});

test("Gomariz: una condición explícita contradictoria impide clasificar como ocasión", () => {
  const conflicting = prepareProduct({ ...product, condition: "Nuevo" }, catalog);
  assert.equal(conflicting.product.condition, null);
  assert.equal(conflicting.product.categorySellID, null);
  assert.ok(conflicting.issues.includes("Condición comercial contradictoria entre la ficha y el origen"));
  assert.equal(resolveCommercialCondition({ ...product, condition: "Segunda mano" }).contradictory, false);
});

test("Gomariz: una familia sin motor inequívoco conserva categoría pendiente", () => {
  const ambiguous = prepareProduct({
    ...product,
    url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/brazo-articulado/jlg-340aj/",
    specs: {}
  }, catalog);
  assert.equal(ambiguous.product.condition, "Segunda_Mano");
  assert.equal(ambiguous.product.categorySellID, null);
  assert.ok(ambiguous.issues.includes("Categoría Equipzilla sin correspondencia inequívoca"));
});
