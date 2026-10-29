import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { parsePreparation } from "../../preparation/preparation-document.js";
import { prepareProduct } from "../prepare-product.js";
import { planProductImport, readReferenceInventory } from "../export-plan.js";
import { planCreateMany } from "../create-many-plan.js";

const source: ProductRecord = {
  providerId: "gam", categoryKey: "elevacion-nueva", categoryName: "Plataformas elevadoras nuevas",
  url: "https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/6607-maquina",
  title: "Plataforma de tijera eléctrica XCMG", shortDescription: "Plataforma elevadora eléctrica.",
  longDescription: "Plataforma para trabajos en altura.", price: "21000",
  reference: "6607", externalReference: " JP-00239 ", brand: "XCMG", model: "XG0607DC",
  year: null, location: null, country: null, horometer: null, serialNumber: null,
  image: "https://online.gamrentals.com/img/6607.jpg",
  images: ["https://online.gamrentals.com/img/6607.jpg"],
  condition: "Nuevo", specs: { "Altura de trabajo": "8 m" }
};

const emptyInventory = readReferenceInventory("companyID,reference\n45,OTRA\n", 45);
const catalog = await loadImportCatalog();
const documentFor = (records: readonly ProductRecord[]) => parsePreparation({
  quality: "complete", published: true, products: records.map((record) => prepareProduct(record, catalog))
}, "gam");

test("GAM conserva identidad técnica y exporta externalReference en Excel y create/many", () => {
  const document = documentFor([source]);
  const prepared = document.products[0];
  assert.ok(prepared);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.reference, "6607");
  assert.equal(prepared.product.externalReference, "JP-00239");
  assert.deepEqual(prepared.importIssues?.excel, []);
  assert.deepEqual(prepared.importIssues?.createMany, []);
  const excel = planProductImport(document, "gam", emptyInventory, catalog);
  const json = planCreateMany(document, "gam", emptyInventory, catalog);
  assert.equal(excel.report.newProducts, 1);
  assert.equal(json.report.newProducts, 1);
  assert.equal(excel.rows[0]?.[0], "JP-00239");
  assert.equal(json.products[0]?.reference, "JP-00239");
  assert.deepEqual(excel.report.selectedSources, [{ reference: "JP-00239", sourceUrl: source.url }]);
  assert.deepEqual(json.report.selectedSources, excel.report.selectedSources);
  assert.equal(document.products[0]?.product.reference, "6607");

  const alreadyImported = readReferenceInventory("companyID,reference\n45,jp-00239\n", 45);
  assert.equal(planProductImport(document, "gam", alreadyImported, catalog).report.existingProducts, 1);
  assert.equal(planCreateMany(document, "gam", alreadyImported, catalog).report.existingProducts, 1);
  const idInventory = readReferenceInventory("companyID,reference\n45,6607\n", 45);
  assert.equal(planCreateMany(document, "gam", idInventory, catalog).report.newProducts, 1);
});

test("GAM nunca sustituye externalReference ausente por el ID de URL, ni en preparaciones antiguas", () => {
  const missing = documentFor([{ ...source, externalReference: null }]);
  const old = documentFor([source]);
  const entry = old.products[0];
  assert.ok(entry);
  const { externalReference: unused, ...legacyProduct } = entry.product;
  assert.equal(unused, "JP-00239");
  const legacy = parsePreparation({ ...old, products: [{ ...entry, product: legacyProduct }] }, "gam");
  for (const document of [missing, legacy]) {
    assert.equal(document.products[0]?.product.reference, "6607");
    for (const plan of [
      planProductImport(document, "gam", emptyInventory, catalog),
      planCreateMany(document, "gam", emptyInventory, catalog)
    ]) {
      assert.equal(plan.report.newProducts, 0);
      assert.equal(plan.report.reviewProducts, 1);
      assert.match(plan.report.review[0]?.reason ?? "", /externalReference.*ausente/);
    }
  }
});

test("GAM no fusiona máquinas con referencia comercial compartida ni las importa por duplicado", () => {
  const another = { ...source, reference: "6608", url: source.url.replace("6607", "6608"),
    externalReference: "jp-00239" };
  const document = documentFor([source, another]);
  assert.deepEqual(document.products.map((entry) => entry.product.reference), ["6607", "6608"]);
  for (const plan of [
    planProductImport(document, "gam", emptyInventory, catalog),
    planCreateMany(document, "gam", emptyInventory, catalog)
  ]) {
    assert.equal(plan.report.newProducts, 0);
    assert.equal(plan.report.duplicateReferences, 2);
    assert.equal(plan.report.reviewProducts, 0);
    assert.deepEqual(plan.report.duplicates.map((issue) => issue.reference), ["JP-00239", "jp-00239"]);
  }
});

test("preparación GAM rechaza tipos de referencia comercial alterados", () => {
  const document = documentFor([source]);
  const entry = document.products[0];
  assert.ok(entry);
  assert.throws(() => parsePreparation({ ...document, products: [{ ...entry, product: {
    ...entry.product, externalReference: 6607
  } }] }, "gam"), /productos inválidos/);
});
