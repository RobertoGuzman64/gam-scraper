import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { planProductImport, readReferenceInventory } from "../export-plan.js";
import { parsePreparation } from "../../preparation/preparation-document.js";
import { record, documentFor } from "./export-fixtures.js";

test("el inventario exige companyID coherente e identifica referencias sin distinguir mayúsculas", () => {
  const inventory = readReferenceInventory("companyID,reference\n45,m044-4093\n", 45);
  assert.ok(inventory.references.has("M044-4093"));
  assert.throws(() => readReferenceInventory("companyID,reference\n46,M044-4093\n", 45), /otra empresa/);
  assert.throws(() => readReferenceInventory("reference\nM044-4093\n", 45), /companyID/);
  assert.throws(() => readReferenceInventory("companyID,reference\n45,\n", 45), /referencia vacía/);
});

test("solo exporta nuevos preparados, excluyendo existentes, reviews y referencias repetidas", async () => {
  const catalog = await loadImportCatalog();
  const input = await documentFor([
    record,
    { ...record, reference: "PREEXISTE", url: `${record.url}/preexiste` },
    { ...record, reference: "SINPRECIO", price: null, url: `${record.url}/sinprecio` },
    { ...record, reference: "DUPLICADA", url: `${record.url}/duplicada-1` },
    { ...record, reference: "duplicada", title: "Otra unidad", url: `${record.url}/duplicada-2` }
  ]);
  const plan = planProductImport(input, "mercaeleva", readReferenceInventory("companyID,reference\n45,preexiste\n", 45), catalog);
  assert.deepEqual({ new: plan.report.newProducts, existing: plan.report.existingProducts, review: plan.report.reviewProducts, duplicates: plan.report.duplicateReferences },
    { new: 1, existing: 1, review: 1, duplicates: 2 });
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0]?.[0], "M044-4093");
  assert.ok(plan.headers.includes("Altura de trabajo (m)"));
  assert.equal(plan.rows[0]?.[plan.headers.indexOf("Altura de trabajo (m)")], 16);
  assert.equal(plan.rows[0]?.[plan.headers.indexOf("URL 1 *")], "https://machineric.com/1.jpg");
  assert.equal(plan.rows[0]?.[plan.headers.indexOf("URL 2")], "https://machineric.com/2.jpg");
  assert.equal(plan.headers[0], "Referencia *");
  assert.equal(plan.headers[1], "Categoría *");
  assert.equal(plan.headers[3], "Condición *");
  assert.equal(plan.rows[0]?.[3], "Segunda_Mano");
  assert.equal(plan.rows[0]?.[4], 20500);
});

test("no acepta preparación parcial ni de un proveedor distinto", async () => {
  const input = await documentFor([record]);
  assert.throws(() => parsePreparation({ ...input, quality: "partial" }, "mercaeleva"), /completo/);
  assert.throws(() => parsePreparation({ ...input, published: false }, "mercaeleva"), /completo/);
  assert.throws(() => parsePreparation(input, "gam"), /no coincide/);
});

test("vuelve a comprobar campos y atributos aunque una entrada llegue marcada ready", async () => {
  const catalog = await loadImportCatalog();
  const input = await documentFor([record]);
  const first = input.products[0];
  assert.ok(first);
  const document = { ...input, products: [{ ...first, product: { ...first.product, price: null } }] };
  const plan = planProductImport(document, "mercaeleva", readReferenceInventory("companyID,reference\n45,OTRA\n", 45), catalog);
  assert.equal(plan.report.newProducts, 0);
  assert.equal(plan.report.reviewProducts, 1);
});

test("exportación rechaza falta de descripción corta pero permite general ausente o repetida", async () => {
  const catalog = await loadImportCatalog();
  const document = await documentFor([record]);
  const prepared = document.products[0];
  assert.ok(prepared);
  const inventory = readReferenceInventory("companyID,reference\n45,OTRA\n", 45);
  const longOnly = { ...document, products: [{ ...prepared, status: "ready" as const, issues: [], product: {
    ...prepared.product, description: null, description_general: record.longDescription
  } }] };
  const blocked = planProductImport(longOnly, "mercaeleva", inventory, catalog);
  assert.equal(blocked.report.newProducts, 0);
  assert.equal(blocked.report.reviewProducts, 1);
  assert.match(blocked.report.review[0]?.reason ?? "", /Descripción corta ausente/);

  const allowed = [
    { description: record.shortDescription, description_general: null },
    { description: "Máquina revisada.", description_general: "  Máquina   revisada. " }
  ];
  for (const descriptions of allowed) {
    const input = { ...document, products: [{ ...prepared, status: "ready" as const, issues: [], product: {
      ...prepared.product, ...descriptions
    } }] };
    const plan = planProductImport(input, "mercaeleva", inventory, catalog);
    assert.equal(plan.report.newProducts, 1);
    assert.equal(plan.report.reviewProducts, 0);
    assert.equal(plan.rows[0]?.[7], descriptions.description_general ?? "");
  }
});

test("la exportación no repite incidencias detectadas en la preparación", async () => {
  const catalog = await loadImportCatalog();
  const document = await documentFor([{ ...record, shortDescription: null }]);
  const plan = planProductImport(document, "mercaeleva", readReferenceInventory("companyID,reference\n45,OTRA\n", 45), catalog);
  assert.equal(plan.report.reviewProducts, 1);
  assert.equal(plan.report.newProducts, 0);
  const reason = plan.report.review[0]?.reason ?? "";
  assert.equal(reason.match(/Descripción corta ausente/g)?.length, 1);
});

test("se limita a diez URLs y no inventa imágenes adicionales", async () => {
  const catalog = await loadImportCatalog();
  const many = Array.from({ length: 12 }, (_, index) => `https://example.com/${index + 1}.jpg`);
  const input = await documentFor([{ ...record, image: many[0] ?? null, images: many }]);
  const plan = planProductImport(input, "mercaeleva", readReferenceInventory("companyID,reference\n45,OTRA\n", 45), catalog);
  assert.equal(plan.report.extraImages, 2);
  assert.equal(plan.headers.filter((h) => /^URL /.test(h)).length, 10);
  assert.ok(!plan.rows[0]?.includes(many[10] ?? ""));
});
