import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { planProductImport, readReferenceInventory } from "../export-plan.js";
import { createProductsXlsx } from "../../../infrastructure/spreadsheet/xlsx.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { record, documentFor, readZipXml } from "./export-fixtures.js";

test("un mismo XLSX contiene condiciones nuevas y usadas con atributos y precios reales", async () => {
  const catalog = await loadImportCatalog();
  const newMachine: ProductRecord = {
    ...record, providerId: "gam", categoryKey: "elevacion-nueva",
    url: "https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/99999-maquina",
    reference: "GAM-NEW", title: "Plataforma de tijera eléctrica XCMG", condition: "Nuevo",
    specs: { "Altura de trabajo": "8 m" }
  };
  const usedMachine: ProductRecord = {
    ...newMachine, categoryKey: "elevacion",
    url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/88888-maquina",
    reference: "GAM-USED", title: "Plataforma de tijera eléctrica usada", condition: "Segunda mano"
  };
  const noPrice: ProductRecord = {
    ...newMachine,
    url: "https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/77777-maquina",
    reference: "GAM-NO-PRICE", price: null
  };
  const document = await documentFor([newMachine, usedMachine, noPrice]);
  const plan = planProductImport(document, "gam", readReferenceInventory("companyID,reference\n45,OTRA\n", 45), catalog);
  assert.equal(plan.report.total, 3);
  assert.equal(plan.report.newProducts, 2);
  assert.equal(plan.report.reviewProducts, 1);
  assert.equal(plan.report.review[0]?.reference, "GAM-NO-PRICE");
  assert.match(plan.report.review[0]?.reason ?? "", /Precio ausente o inválido/);
  assert.equal(document.products[2]?.status, "ready");
  assert.equal(document.products[2]?.product.price, null);
  assert.deepEqual(plan.rows.map((row) => [row[0], row[3]]), [
    ["GAM-NEW", "Nuevo"], ["GAM-USED", "Segunda_Mano"]
  ]);
  assert.equal(plan.rows[0]?.[plan.headers.indexOf("Altura de trabajo (m)")], 8);
  assert.equal(plan.rows[1]?.[plan.headers.indexOf("Altura de trabajo (m)")], 8);
  const sheet = readZipXml(createProductsXlsx(plan.headers, plan.rows), "xl/worksheets/sheet1.xml");
  assert.match(sheet, /<c r="D2" t="inlineStr"><is><t xml:space="preserve">Nuevo<\/t><\/is><\/c>/);
  assert.match(sheet, /<c r="D3" t="inlineStr"><is><t xml:space="preserve">Segunda_Mano<\/t><\/is><\/c>/);
  assert.doesNotMatch(sheet, /GAM-NO-PRICE/);
});

test("xlsx estándar contiene hoja Productos, textos seguros, números y cabeceras compatibles", () => {
  const bytes = createProductsXlsx(["Referencia *", "Precio *", "URL 1 *"], [["=SUM(1,2)", 12500.5, "https://example.com/x.jpg"]]);
  assert.equal(bytes.readUInt32LE(0), 0x04034b50);
  assert.match(readZipXml(bytes, "xl/workbook.xml"), /name="Productos"/);
  const sheet = readZipXml(bytes, "xl/worksheets/sheet1.xml");
  assert.match(sheet, /t="inlineStr"><is><t xml:space="preserve">=SUM\(1,2\)/);
  assert.match(sheet, /<c r="B2"><v>12500\.5<\/v><\/c>/);
  assert.doesNotMatch(sheet, /<f>/);
  assert.throws(() => createProductsXlsx(["Precio *", "Precio *"], []), /duplicadas/);
});
