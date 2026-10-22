import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { planCreateMany } from "../export/create-many-plan.js";
import { planProductImport } from "../export/export-plan.js";
import { readReferenceInventory } from "../export/reference-inventory.js";
import { prepareProduct } from "../preparation/prepare-product.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { PreparationDocument } from "../preparation/preparation-document.js";

const record: ProductRecord = {
  providerId: "mercaeleva", categoryKey: "plataformas-articuladas-diesel-segunda-mano",
  categoryName: "Maquinaria en venta", url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M044-4093",
  title: "JLG 450 AJ", shortDescription: "Plataforma articulada diésel de ocasión.",
  longDescription: "Plataforma revisada.", price: "20.500,00 €", reference: "M044-4093",
  brand: "JLG", model: "450 AJ", year: "2013", location: "Barcelona", country: "ES",
  condition: "Segunda mano", horometer: "3666", serialNumber: null,
  image: "https://machineric.com/1.jpg", images: ["https://machineric.com/1.jpg", "https://machineric.com/2.jpg"],
  specs: { "Altura de trabajo": "16 m" }
};

const emptyInventory = readReferenceInventory("companyID,reference\n45,OTRA\n", 45);

const prepareDocument = async (records: readonly ProductRecord[]): Promise<PreparationDocument> => {
  const catalog = await loadImportCatalog();
  return { quality: "complete", published: true, products: records.map((item) => prepareProduct(item, catalog)) };
};

test("create/many exporta precio opcional sin simular datos ni modificar el contrato Excel", async () => {
  const catalog = await loadImportCatalog();
  const document = await prepareDocument([{ ...record, price: null }]);
  assert.equal(document.products[0]?.status, "review");
  const excel = planProductImport(document, "mercaeleva", emptyInventory, catalog);
  const json = planCreateMany(document, "mercaeleva", emptyInventory, catalog);
  assert.equal(excel.report.newProducts, 0);
  assert.equal(json.report.newProducts, 1);
  const product = json.products[0];
  assert.ok(product);
  assert.deepEqual(Object.keys(product).sort(), [
    "title", "categorySellID", "condition", "companyID", "description", "reference", "image",
    "images", "description_general", "description_title", "attributes", "spec"
  ].sort());
  assert.equal(product.companyID, 45);
  assert.equal(product.reference, "M044-4093");
  assert.equal(product.condition, "Segunda_Mano");
  assert.equal(product.description, record.shortDescription);
  assert.deepEqual(product.images, record.images);
  assert.deepEqual(product.spec, record.specs);
  assert.ok(!("price" in product));
  assert.ok(!("providerId" in product));
  assert.ok(!("sourceUrl" in product));
  assert.deepEqual(json.report.selectedSources, [{ reference: record.reference, sourceUrl: record.url }]);
});

test("create/many distingue registros existentes, duplicados e incompatibles sin borrarlos de informes", async () => {
  const catalog = await loadImportCatalog();
  const document = await prepareDocument([
    record,
    { ...record, reference: "EXISTE", url: `${record.url}/existe` },
    { ...record, reference: "REP", url: `${record.url}/rep1` },
    { ...record, reference: "rep", url: `${record.url}/rep2` },
    { ...record, reference: "SIN-DESC", shortDescription: null, url: `${record.url}/desc` },
    { ...record, reference: "SIN-COND", condition: null, categoryKey: "desconocida", url: `${record.url}/cond` },
    { ...record, reference: "SIN-FOTO", image: null, images: [], url: `${record.url}/foto` }
  ]);
  const inventory = readReferenceInventory("companyID,reference\n45,existe\n", 45);
  const plan = planCreateMany(document, "mercaeleva", inventory, catalog);
  assert.deepEqual([
    plan.report.newProducts, plan.report.existingProducts, plan.report.duplicateReferences, plan.report.reviewProducts
  ], [1, 1, 2, 3]);
  assert.equal(plan.report.existing[0]?.reference, "EXISTE");
  assert.deepEqual(plan.report.duplicates.map((entry) => entry.reference), ["REP", "rep"]);
  assert.ok(plan.report.review.some((entry) => entry.reference === "SIN-DESC" && entry.reason.includes("Descripción corta")));
  assert.ok(plan.report.review.some((entry) => entry.reference === "SIN-FOTO" && entry.reason.includes("Imágenes")));
  assert.ok(plan.report.review.some((entry) => entry.reference === "SIN-COND" && entry.reason.includes("Condición")));
});

test("create/many no ignora incidencias de procedencia incluso si el contrato local parece válido", async () => {
  const catalog = await loadImportCatalog();
  const document = await prepareDocument([{ ...record, price: null }]);
  const first = document.products[0];
  assert.ok(first);
  const unsafe: PreparationDocument = {
    ...document, products: [{ ...first, issues: [...first.issues, "Número de serie compartido; revisar identidad de origen"] }]
  };
  const plan = planCreateMany(unsafe, "mercaeleva", emptyInventory, catalog);
  assert.equal(plan.report.newProducts, 0);
  assert.match(plan.report.review[0]?.reason ?? "", /Número de serie compartido/);
});



test("el cierre detecta URLs de origen repetidas aunque tengan referencias distintas", async () => {
  const catalog = await loadImportCatalog();
  const document = await prepareDocument([
    record,
    { ...record, reference: "REFERENCIA-DISTINTA", url: `${record.url}#detalle` }
  ]);
  const inventory = readReferenceInventory("companyID,reference\n45,OTRA\n", 45);
  for (const plan of [
    planProductImport(document, "mercaeleva", inventory, catalog),
    planCreateMany(document, "mercaeleva", inventory, catalog)
  ]) {
    assert.equal(plan.report.total, 2);
    assert.equal(plan.report.newProducts, 0);
    assert.equal(plan.report.duplicateReferences, 0);
    assert.equal(plan.report.reviewProducts, 2);
    assert.ok(plan.report.review.every((item) => item.reason.includes("URL de origen duplicada")));
  }
});

test("el cierre conserva cada referencia exactamente en una categoría de salida", async () => {
  const catalog = await loadImportCatalog();
  const document = await prepareDocument([
    record,
    { ...record, reference: "EXISTE", url: `${record.url}/existente` },
    { ...record, reference: "SIN-PRECIO", price: null, url: `${record.url}/sin-precio` },
    { ...record, reference: "SIN-CONDICION", condition: null, url: `${record.url}/sin-condicion` },
    { ...record, reference: "URL-INVALIDA", url: "not-a-url" }
  ]);
  const inventory = readReferenceInventory("companyID,reference\n45,EXISTE\n", 45);
  for (const plan of [
    planProductImport(document, "mercaeleva", inventory, catalog),
    planCreateMany(document, "mercaeleva", inventory, catalog)
  ]) {
    const { total, newProducts, existingProducts, reviewProducts, duplicateReferences, selectedSources } = plan.report;
    assert.equal(total, newProducts + existingProducts + reviewProducts + duplicateReferences);
    assert.equal(selectedSources.length, newProducts);
    assert.deepEqual(selectedSources.map((item) => item.reference),
      "products" in plan ? plan.products.map((item) => item.reference) : plan.rows.map((row) => row[0]));
    assert.ok(plan.report.review.some((item) => item.reference === "URL-INVALIDA" && item.reason.includes("URL de origen inválida")));
    assert.ok(plan.report.review.some((item) => item.reference === "SIN-CONDICION"));
    assert.equal(plan.report.existingProducts, 1);
  }
  const excel = planProductImport(document, "mercaeleva", inventory, catalog);
  const json = planCreateMany(document, "mercaeleva", inventory, catalog);
  assert.equal(excel.report.newProducts, 1);
  assert.equal(json.report.newProducts, 2);
  assert.deepEqual(json.report.selectedSources.map((item) => item.reference), [record.reference, "SIN-PRECIO"]);
});

test("Excel comparte cabecera entre IDs de atributo de categorías distintas sin perder valores", async () => {
  const catalog = await loadImportCatalog();
  const firstCategory = catalog.categories.find((category) => category.id === 37);
  const secondCategory = catalog.categories.find((category) => category.id === 44);
  assert.ok(firstCategory);
  assert.ok(secondCategory);
  assert.ok(catalog.relations.some((relation) => relation.categoryID === 37 && relation.attributeID === 13));
  assert.ok(catalog.relations.some((relation) => relation.categoryID === 44 && relation.attributeID === 28));
  const inspectionCatalog = {
    ...catalog, attributes: catalog.attributes.map((attribute) => ({ ...attribute, required: false }))
  };
  const candidate = (await prepareDocument([record])).products[0]?.product;
  assert.ok(candidate);
  const document: PreparationDocument = {
    quality: "complete", published: true, products: [
      { status: "ready", issues: [], product: {
        ...candidate, reference: "CARRETILLA-1", sourceUrl: `${record.url}/carretilla`,
        categorySellID: firstCategory.id, category: firstCategory.name,
        attributes: [{ attributeID: 13, value: 1800 }]
      } },
      { status: "ready", issues: [], product: {
        ...candidate, reference: "TRANSPALETA-1", sourceUrl: `${record.url}/transpaleta`,
        categorySellID: secondCategory.id, category: secondCategory.name,
        attributes: [{ attributeID: 28, value: 1200 }]
      } }
    ]
  };
  const plan = planProductImport(document, "mercaeleva", emptyInventory, inspectionCatalog);
  assert.equal(plan.report.newProducts, 2);
  assert.equal(plan.headers.filter((header) => header === "Capacidad de carga (kg)").length, 1);
  const column = plan.headers.indexOf("Capacidad de carga (kg)");
  assert.deepEqual(plan.rows.map((row) => row[column]), [1800, 1200]);
  assert.equal(new Set(plan.headers).size, plan.headers.length);
});
