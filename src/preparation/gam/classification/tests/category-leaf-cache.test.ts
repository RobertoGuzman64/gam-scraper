import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { resolveCategory } from "../../../shared/classification/mapping/category-mapping.js";

const catalog = await loadImportCatalog();
const newProduct = accreditedSourceRecord("gam-historical", "4730");
const original = resolveCategory(newProduct, catalog.categories, "Nuevo");
if (!original) throw new Error("No se ha encontrado su categoría original");

test("la caché de categorías mantiene separadas las condiciones comerciales", () => {
  for (const condition of ["Nuevo", "Segunda_Mano"] as const) {
    const expectedId: number | null = resolveCategory(newProduct, [...catalog.categories], condition)?.id ?? null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.equal(resolveCategory(newProduct, catalog.categories, condition)?.id ?? null, expectedId);
    }
  }
});

test("la caché no mezcla catálogos distintos ni reutiliza categorías desactivadas", () => {
  const disabled = catalog.categories.map((category) =>
    category.id === original.id ? { ...category, active: false } : category
  );
  assert.equal(resolveCategory(newProduct, disabled, "Nuevo"), null);
  assert.equal(resolveCategory(newProduct, catalog.categories, "Nuevo")?.id, original.id);
  assert.equal(resolveCategory(newProduct, [...catalog.categories], "Nuevo")?.id, original.id);
});
