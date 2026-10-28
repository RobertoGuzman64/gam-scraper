import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { planCreateMany } from "../../legacy-export/create-many-plan.js";
import { planProductImport } from "../../legacy-export/export-plan.js";
import { readReferenceInventory } from "../../legacy-export/reference-inventory.js";
import { parsePreparation } from "../preparation-document.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const record: ProductRecord = {
  providerId: "mercaeleva", categoryKey: "plataformas-articuladas-diesel-segunda-mano",
  categoryName: "Maquinaria en venta", url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M044-4093",
  reference: "M044-4093", title: "JLG 450 AJ", shortDescription: "Plataforma articulada de ocasión",
  longDescription: "Plataforma revisada", condition: "Segunda mano", price: "20.500,00 €",
  brand: "JLG", model: "450 AJ", year: "2013", location: "Barcelona", country: "ES",
  horometer: "3666", serialNumber: null, image: "https://machineric.com/1.jpg",
  images: ["https://machineric.com/1.jpg"], specs: { "Altura de trabajo": "16 m" }
};
const inventory = readReferenceInventory("companyID,reference\n45,OTRA\n", 45);

const plans = (source: ProductRecord) => {
  const prepared = prepareProduct(source, catalog);
  const document = { quality: "complete" as const, published: true as const, products: [prepared] };
  return { prepared, excel: planProductImport(document, "mercaeleva", inventory, catalog),
    createMany: planCreateMany(document, "mercaeleva", inventory, catalog) };
};

test("ausencias de atributo, descripción e imagen no degradan calidad y sí bloquean los dos receptores", () => {
  const { prepared, excel, createMany } = plans({ ...record, shortDescription: null, longDescription: null,
    image: null, images: [], specs: { "Altura de trabajo": "N/D" } });
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.attributes.some((attr) => attr.attributeID === 1), false);
  for (const receiver of [prepared.importIssues?.excel, prepared.importIssues?.createMany]) {
    assert.ok(receiver?.includes("Atributo obligatorio ausente: Altura de trabajo"));
    assert.ok(receiver?.includes("Descripción ausente"));
    assert.ok(receiver?.includes("URL de imagen ausente o inválida"));
  }
  assert.equal(excel.report.newProducts, 0);
  assert.equal(createMany.report.newProducts, 0);
  assert.equal(createMany.report.reviewProducts, 1);
});

test("Excel exige precio ausente mientras create/many puede seleccionar un producto sin precio", () => {
  const { prepared, excel, createMany } = plans({ ...record, price: null });
  assert.equal(prepared.status, "ready");
  assert.ok(prepared.importIssues?.excel.includes("Precio ausente o inválido"));
  assert.deepEqual(prepared.importIssues?.createMany, []);
  assert.equal(excel.report.newProducts, 0);
  assert.equal(createMany.report.newProducts, 1);
});

test("contradicciones y medidas inválidas impiden la exportación aunque no falte información contractual", () => {
  const invalid = plans({ ...record, specs: { "Altura de trabajo (mm)": "12 m" } });
  assert.equal(invalid.prepared.status, "review");
  assert.ok(invalid.prepared.issues.includes("Atributo no normalizable: Altura de trabajo"));
  assert.equal(invalid.createMany.report.newProducts, 0);
  const collision = plans({ ...record, specs: { "Altura de trabajo (m)": "12 m", "Altura de trabajo (mm)": "13000 mm" } });
  assert.equal(collision.prepared.status, "review");
  assert.ok(collision.prepared.issues.includes("Atributo contradictorio: Altura de trabajo"));
  assert.equal(collision.excel.report.newProducts, 0);
});

test("el parser acepta documentos anteriores sin importIssues y rechaza diagnósticos nuevos inválidos", () => {
  const prepared = prepareProduct(record, catalog);
  const { importIssues, ...historical } = prepared;
  assert.deepEqual(parsePreparation({ quality: "complete", published: true, products: [historical] }, "mercaeleva").products[0], historical);
  assert.throws(() => parsePreparation({ quality: "complete", published: true, products: [
    { ...prepared, importIssues: { excel: [22], createMany: [] } }
  ] }, "mercaeleva"), /inválidos/);
  assert.deepEqual(importIssues, { excel: [], createMany: [] });
});
