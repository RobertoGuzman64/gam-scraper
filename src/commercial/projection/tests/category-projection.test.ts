import assert from "node:assert/strict";
import test from "node:test";
import { base } from "../../../preparation/testing/preparation-fixtures.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { isValidCommercialCategory, projectCommercialCategory } from "../category-projection.js";

const catalog = await loadImportCatalog();
const prepared = prepareProduct(base, catalog);

test("una categoría comercial exige hoja válida, condición y familia respaldadas", () => {
  assert.equal(prepared.product.categorySellID, 29);
  assert.equal(isValidCommercialCategory(base, 29, "Segunda_Mano", catalog), true);
  assert.equal(isValidCommercialCategory(base, 29, "Nuevo", catalog), false);
  assert.equal(isValidCommercialCategory({ ...base, categoryKey: "venta" }, 29, "Segunda_Mano", catalog), false);
  assert.equal(isValidCommercialCategory({ ...base, categoryKey: "venta" }, 0, "Segunda_Mano", catalog), false);
  assert.equal(isValidCommercialCategory(base, 29, null, catalog), false);
});

test("una proyección no sobrescribe categorías ya preparadas", () => {
  const original = JSON.stringify(prepared);
  assert.deepEqual(projectCommercialCategory(base, prepared, catalog), prepared);
  assert.equal(JSON.stringify(prepared), original);
});

test("sin categoría documentada no inventa destino ni traslada atributos", () => {
  const unclassified = { ...prepared, product: {
    ...prepared.product, categorySellID: null, category: null, attributes: []
  } };
  const unknown = { ...base, categoryKey: "venta", categoryName: "Maquinaria en venta" };
  const result = projectCommercialCategory(unknown, unclassified, catalog);
  assert.equal(result.product.categorySellID, null);
  assert.equal(result.product.category, null);
  assert.deepEqual(result.product.attributes, []);
  assert.deepEqual(unclassified.product.attributes, []);
});

test("la recuperación de categoría recalcula los diagnósticos de ambos receptores sin cambiar el estado técnico", () => {
  const source = { ...base, providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta",
    url: "https://manain.com/producto/venta-manipulacion-apilador-equiptest-s1/", title: "S1",
    brand: "EQUIPTEST", model: "S1", shortDescription: "Apilador eléctrico", longDescription: null,
    specs: { Marca: "EQUIPTEST", Modelo: "S1", Motor: "Eléctrico", "Nueva o usada": "usada", "Capacidad carga": "1200 kg" } };
  const mapped = prepareProduct(source, catalog);
  const unclassified = { ...mapped, product: { ...mapped.product, categorySellID: null, category: null, attributes: [] },
    importIssues: { excel: ["Categoría no coincide de forma única con el backend"], createMany: ["Categoría no válida para create/many"] } };
  const original = JSON.stringify(unclassified);
  const projected = projectCommercialCategory(source, unclassified, catalog);
  assert.equal(projected.product.categorySellID, mapped.product.categorySellID);
  assert.ok(projected.product.categorySellID !== null);
  assert.deepEqual(projected.importIssues, mapped.importIssues);
  assert.ok(projected.importIssues?.createMany.includes("Atributo obligatorio ausente: Altura de elevación"));
  assert.ok(!projected.importIssues?.createMany.includes("Categoría no válida para create/many"));
  assert.equal(projected.status, mapped.status);
  assert.deepEqual(projected.issues, mapped.issues);
  assert.equal(JSON.stringify(unclassified), original);
});
