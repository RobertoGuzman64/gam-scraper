import assert from "node:assert/strict";
import test from "node:test";
import { prepareProduct } from "../prepare.js";
import { loadImportCatalog } from "../catalog-loader.js";
import { planProductImport, readReferenceInventory } from "../export-plan.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

const gam: ProductRecord = {
  providerId: "gam", categoryKey: "carretillas-elevadoras-nuevas", categoryName: "Carretillas nuevas",
  url: "https://online.gamrentals.com/es/34-carretillas-elevadoras-nuevas/8000-carretilla.html",
  title: "Carretilla Hyster", shortDescription: "Equipo", longDescription: "Disponible",
  price: "21000", reference: "8000", brand: "Hyster", model: "H2.5A", year: null,
  location: null, country: null, horometer: null, serialNumber: null,
  image: "https://online.gamrentals.com/img/8000.jpg", images: ["https://online.gamrentals.com/img/8000.jpg"],
  condition: "Nuevo", specs: {}
};

test("GAM nuevo y condición desconocida no se convierten en maquinaria de segunda mano", async () => {
  const catalog = await loadImportCatalog();
  const newMachine = prepareProduct(gam, catalog);
  assert.equal(newMachine.product.condition, null);
  assert.equal(newMachine.status, "review");
  assert.ok(newMachine.issues.some((issue) => issue.includes("Maquinaria nueva")));

  const unknown = prepareProduct({ ...gam, condition: null }, catalog);
  assert.equal(unknown.product.condition, null);
  assert.equal(unknown.status, "review");
  assert.ok(unknown.issues.some((issue) => issue.includes("Condición de segunda mano no confirmada")));

  const contradictory = prepareProduct({ ...gam, condition: "Segunda mano" }, catalog);
  assert.equal(contradictory.product.condition, null);
  assert.ok(contradictory.issues.some((issue) => issue.includes("contradictoria")));

  const used = prepareProduct({
    ...gam, condition: "Segunda mano", categoryKey: "carretillas-elevadoras-diesel-segunda-mano",
    url: "https://online.gamrentals.com/es/34-carretillas-elevadoras-diesel-segunda-mano/8000-carretilla.html"
  }, catalog);
  assert.equal(used.product.condition, "Segunda_Mano");
});

test("un estado ready manipulado no permite exportar producto con condición desconocida", async () => {
  const catalog = await loadImportCatalog();
  const prepared = prepareProduct(gam, catalog);
  const document = {
    quality: "complete" as const, published: true as const,
    products: [{ ...prepared, status: "ready" as const, issues: [] }]
  };
  const inventory = readReferenceInventory("companyID,reference\n45,ANTERIOR\n", 45);
  const plan = planProductImport(document, "gam", inventory, catalog);
  assert.equal(plan.report.newProducts, 0);
  assert.equal(plan.report.reviewProducts, 1);
  assert.match(plan.report.review[0]?.reason ?? "", /Condición incompatible/);
});


test("Mercaeleva: nuevo y desconocido no se convierten en segunda mano por pertenecer al catálogo de venta", async () => {
  const catalog = await loadImportCatalog();
  const source = {
    ...gam, providerId: "mercaeleva", categoryKey: "venta", categoryName: "Maquinaria en venta",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/MB-ESL122-M288-9739",
    reference: "M288-9739", condition: null
  };
  for (const [sourceState, condition] of [["Nuevo", null], ["Usado", null], [null, null]] as const) {
    const prepared = prepareProduct({ ...source, condition, specs: sourceState ? { Estado: sourceState } : {} }, catalog);
    assert.equal(prepared.product.condition, null);
    assert.equal(prepared.status, "review");
    assert.ok(prepared.issues.some((issue) => issue.includes(sourceState === "Nuevo" ? "Maquinaria nueva" : "Condición de segunda mano no confirmada")));
  }

  const used = prepareProduct({ ...source, condition: "Segunda mano", specs: { Estado: "Usado" } }, catalog);
  assert.equal(used.product.condition, "Segunda_Mano");
  const newMachine = prepareProduct({ ...source, condition: "Nuevo", specs: { Estado: "Nuevo" } }, catalog);
  assert.equal(newMachine.product.condition, null);
  assert.ok(newMachine.issues.some((issue) => issue.includes("Maquinaria nueva")));

  const contradiction = prepareProduct({ ...source, condition: "Segunda mano", specs: { Estado: "Nuevo" } }, catalog);
  assert.equal(contradiction.product.condition, null);
  assert.ok(contradiction.issues.some((issue) => issue.includes("contradictoria")));
});

test("Gomariz y proveedores desconocidos no se consideran usados sin condición explícita", async () => {
  const catalog = await loadImportCatalog();
  for (const providerId of ["gomariz", "otro-proveedor"]) {
    const prepared = prepareProduct({ ...gam, providerId, condition: null, categoryKey: "venta" }, catalog);
    assert.equal(prepared.product.condition, null, providerId);
    assert.equal(prepared.status, "review", providerId);
    assert.ok(prepared.issues.some((issue) => issue.includes("Condición de segunda mano no confirmada")));
  }
});
