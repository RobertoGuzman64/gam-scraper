import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { isLeafCategoryForCondition } from "../mapping/category-mapping.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { validateCreateManyCandidate, validateImportCandidate } from "../preparation/import-validation.js";
import { prepareProduct } from "../preparation/prepare.js";
import type { ImportCatalog } from "../preparation/contracts.js";

const used: ProductRecord = {
  providerId: "mercaeleva",
  categoryKey: "plataformas-articuladas-diesel-segunda-mano",
  categoryName: "Maquinaria en venta",
  url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M044-4093",
  title: "JLG 450 AJ", shortDescription: "Plataforma articulada diésel de ocasión.",
  longDescription: "Plataforma revisada.", price: "20.500,00 €", reference: "M044-4093",
  brand: "JLG", model: "450 AJ", year: "2013", location: "Barcelona", country: "ES",
  horometer: "3666", serialNumber: null, condition: "Segunda mano",
  image: "https://files2.machineric.com/clients/mercaeleva/machines/M044-4093/public/1.jpg",
  images: ["https://files2.machineric.com/clients/mercaeleva/machines/M044-4093/public/1.jpg"],
  specs: { "Altura de trabajo": "16 m" }
};

test("Excel y create/many distinguen el precio y la preparación sigue create/many", async () => {
  const catalog = await loadImportCatalog();
  const prepared = prepareProduct({ ...used, price: null }, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.ok(validateImportCandidate(prepared.product, catalog).includes("Precio ausente o inválido"));
  assert.deepEqual(validateCreateManyCandidate(prepared.product, catalog), []);
  assert.deepEqual(validateCreateManyCandidate({ ...prepared.product, price: 0 }, catalog), ["Precio ausente o inválido"]);
});

test("precio numérico publicado pero inválido no pasa a ready ni a create/many", async () => {
  const catalog = await loadImportCatalog();
  const prepared = prepareProduct({ ...used, price: "12,34,56" }, catalog);
  assert.equal(prepared.product.price, null);
  assert.equal(prepared.status, "review");
  assert.ok(prepared.issues.includes("Precio publicado inválido"));
  assert.deepEqual(validateCreateManyCandidate(prepared.product, catalog), []);
});

test("GAM conserva el mástil obligatorio aunque no publique precio", async () => {
  const catalog = await loadImportCatalog();
  const forklift: ProductRecord = {
    ...used, providerId: "gam", categoryKey: "elevacion-nueva",
    categoryName: "Carretillas elevadoras nuevas",
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-hyster/99999-carretilla",
    title: "Carretilla elevadora diésel Hyster", reference: "99999", price: null,
    condition: "Nuevo", specs: { "Capacidad de carga": "2500 kg" }
  };
  const prepared = prepareProduct(forklift, catalog);
  assert.equal(prepared.product.price, null);
  assert.equal(prepared.product.categorySellID, 11);
  assert.ok(prepared.issues.includes("Atributo obligatorio ausente: Tipo de mástil"));
  assert.ok(!prepared.issues.some((issue) => issue.startsWith("Precio ")));
  assert.equal(prepared.status, "review");
  assert.ok(validateCreateManyCandidate(prepared.product, catalog).includes("Atributo obligatorio ausente: Tipo de mástil"));
});

test("create/many mantiene las restricciones comerciales aunque el precio sea opcional", async () => {
  const catalog = await loadImportCatalog();
  const prepared = prepareProduct(used, catalog).product;
  for (const invalid of [
    { ...prepared, condition: null },
    { ...prepared, categorySellID: null },
    { ...prepared, description: null },
    { ...prepared, images: [] },
    { ...prepared, attributes: [] }
  ]) {
    assert.ok(validateCreateManyCandidate(invalid, catalog).length > 0);
  }
  assert.deepEqual(validateImportCandidate(prepared, catalog), []);
  assert.deepEqual(validateCreateManyCandidate(prepared, catalog), []);
});

test("categorías inactivas y relaciones desactivadas no son equivalencias importables", async () => {
  const catalog = await loadImportCatalog();
  const prepared = prepareProduct(used, catalog).product;
  const category = catalog.categories.find((item) => item.id === prepared.categorySellID);
  assert.ok(category);
  const inactive: ImportCatalog = {
    ...catalog, categories: catalog.categories.map((item) => item.id === category.id ? { ...item, active: false } : item)
  };
  assert.equal(isLeafCategoryForCondition(category.id, inactive.categories, "Segunda_Mano"), false);
  assert.equal(prepareProduct(used, inactive).product.categorySellID, null);
  assert.ok(validateCreateManyCandidate(prepared, inactive).includes("Categoría no válida para create/many"));
  const relation = catalog.relations.find((item) => item.categoryID === category.id);
  assert.ok(relation);
  const disabled: ImportCatalog = {
    ...catalog,
    relations: catalog.relations.map((item) => item.categoryID === relation.categoryID && item.attributeID === relation.attributeID
      ? { ...item, actived: false } : item)
  };
  const adjusted = prepareProduct(used, disabled);
  assert.ok(!adjusted.product.attributes.some((item) => item.attributeID === relation.attributeID));
  assert.ok(validateCreateManyCandidate(prepared, disabled).some((issue) => issue.includes(`Atributo no asociado o duplicado: ${relation.attributeID}`)));
});

test("tipos Prisma adicionales se respetan sin construir valores DATE o MULTISELECT artificiales", async () => {
  const catalog = await loadImportCatalog();
  const numeric = catalog.attributes.find((item) => item.type === "NUMBER");
  assert.ok(numeric);
  const decimal: ImportCatalog["attributes"][number] = { ...numeric, type: "DECIMAL" };
  assert.equal(resolveAttributeValue({ ...used, specs: { [numeric.name]: "16" } }, decimal), 16);
  for (const type of ["DATE", "MULTISELECT"] as const) {
    const attribute: ImportCatalog["attributes"][number] = { ...numeric, type };
    assert.equal(resolveAttributeValue({ ...used, specs: { [numeric.name]: "2026-01-02" } }, attribute), null);
  }
});
