import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../catalog-loader.js";
import { planProductImport, readReferenceInventory } from "../export-plan.js";
import { prepareProduct } from "../prepare.js";

const record: ProductRecord = {
  providerId: "mercaeleva",
  categoryKey: "plataformas-articuladas-diesel-segunda-mano",
  categoryName: "Maquinaria en venta",
  url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M044-4093",
  title: "JLG 450 AJ",
  shortDescription: "Plataforma articulada diésel de ocasión.",
  longDescription: "Plataforma revisada.",
  price: "20.500,00 €",
  reference: "M044-4093",
  brand: "JLG",
  model: "450 AJ",
  year: "2013",
  location: "Barcelona",
  country: "ES",
  horometer: "3666",
  serialNumber: null,
  condition: "Segunda mano",
  image: "https://machineric.com/1.jpg",
  images: ["https://machineric.com/1.jpg"],
  specs: { "Altura de trabajo": "16 m" }
};

test("exportación rechaza categorías padre o de maquinaria nueva aunque figuren ready", async () => {
  const catalog = await loadImportCatalog();
  const first = prepareProduct(record, catalog);
  assert.equal(first.status, "ready");
  for (const id of [3, 25, 87]) {
    const category = catalog.categories.find((item) => item.id === id);
    assert.ok(category);
    const document = {
      quality: "complete" as const,
      published: true as const,
      products: [{ ...first, status: "ready" as const, issues: [], product: {
        ...first.product, categorySellID: category.id, category: category.name
      } }]
    };
    const plan = planProductImport(document, "mercaeleva", readReferenceInventory("companyID,reference\n45,OTRA\n", 45), catalog);
    assert.equal(plan.report.newProducts, 0, String(id));
    assert.equal(plan.report.reviewProducts, 1, String(id));
    assert.match(plan.report.review[0]?.reason ?? "", /Categoría no coincide de forma única/, String(id));
  }
});

test("exportación respeta categoría usada válida y bloquea resumen no publicado", async () => {
  const catalog = await loadImportCatalog();
  const first = prepareProduct(record, catalog);
  assert.equal(first.status, "ready");
  const inventory = readReferenceInventory("companyID,reference\n45,OTRA\n", 45);
  const complete = planProductImport({ quality: "complete", published: true, products: [first] }, "mercaeleva", inventory, catalog);
  assert.equal(complete.report.newProducts, 1);
  const longOnly = { ...first, status: "ready" as const, issues: [], product: {
    ...first.product, description: null, description_general: "Texto único publicado."
  } };
  const blocked = planProductImport({ quality: "complete", published: true, products: [longOnly] }, "mercaeleva", inventory, catalog);
  assert.equal(blocked.report.newProducts, 0);
  assert.equal(blocked.report.reviewProducts, 1);
  assert.match(blocked.report.review[0]?.reason ?? "", /Descripción corta ausente/);
});

test("Excel admite descripción corta única o repetida y sigue exigiendo la corta real", async () => {
  const catalog = await loadImportCatalog();
  const prepared = prepareProduct(record, catalog);
  const inventory = readReferenceInventory("companyID,reference\n45,OTRA\n", 45);
  for (const descriptions of [
    { description: "Texto corto real", description_general: null },
    { description: "Texto corto real", description_general: "Texto corto real" }
  ]) {
    const candidate = { ...prepared, status: "ready" as const, issues: [], product: {
      ...prepared.product, ...descriptions
    } };
    const plan = planProductImport({ quality: "complete", published: true, products: [candidate] }, "mercaeleva", inventory, catalog);
    assert.equal(plan.report.newProducts, 1);
    assert.equal(plan.report.reviewProducts, 0);
    assert.equal(plan.rows[0]?.[7], descriptions.description_general ?? "");
  }
  const invalid = { ...prepared, status: "ready" as const, issues: [], product: {
    ...prepared.product, description: null, description_general: "Solo texto largo"
  } };
  const plan = planProductImport({ quality: "complete", published: true, products: [invalid] }, "mercaeleva", inventory, catalog);
  assert.equal(plan.report.newProducts, 0);
  assert.match(plan.report.review[0]?.reason ?? "", /Descripción corta ausente/);
});
