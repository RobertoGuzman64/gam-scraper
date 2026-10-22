import assert from "node:assert/strict";
import test from "node:test";
import { prepareProduct } from "../preparation/prepare.js";
import { parsePreparation } from "../preparation/preparation-document.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { planProductImport, readReferenceInventory } from "../export/export-plan.js";
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

const usedGam: ProductRecord = {
  ...gam, condition: "Segunda mano", categoryKey: "carretillas-elevadoras-diesel-segunda-mano",
  url: "https://online.gamrentals.com/es/34-carretillas-elevadoras-diesel-segunda-mano/8000-carretilla.html"
};

const mercaeleva: ProductRecord = {
  ...gam, providerId: "mercaeleva", categoryKey: "venta", categoryName: "Maquinaria en venta",
  url: "https://sales.mercaeleva.com/es/for-sale/machine/MB-ESL122-M288-9739",
  reference: "M288-9739", condition: null
};

const inventory = readReferenceInventory("companyID,reference\n45,ANTERIOR\n", 45);

test("GAM: Nuevo explícito se conserva sin mapearse a categorías de ocasión", async () => {
  const catalog = await loadImportCatalog();
  const newMachine = prepareProduct(gam, catalog);
  assert.equal(newMachine.product.condition, "Nuevo");
  assert.equal(newMachine.product.categorySellID, null);
  assert.equal(newMachine.status, "review");
  assert.ok(newMachine.issues.includes("Categoría Equipzilla sin correspondencia inequívoca"));
  assert.ok(!newMachine.issues.some((issue) => issue.includes("Condición comercial")));
  assert.equal(newMachine.product.price, 21000);
  assert.equal(newMachine.product.reference, "8000");
  assert.equal(newMachine.product.images.length, 1);

  const used = prepareProduct(usedGam, catalog);
  assert.equal(used.product.condition, "Segunda_Mano");
  assert.ok(!used.issues.some((issue) => issue.includes("Condición comercial")));
});

test("GAM: condición ausente y señales contradictorias se mantienen en review", async () => {
  const catalog = await loadImportCatalog();
  const unknown = prepareProduct({ ...gam, condition: null }, catalog);
  assert.equal(unknown.product.condition, null);
  assert.equal(unknown.status, "review");
  assert.ok(unknown.issues.some((issue) => issue.includes("Condición comercial no confirmada")));

  const contradictoryUsed = prepareProduct({ ...gam, condition: "Segunda mano" }, catalog);
  assert.equal(contradictoryUsed.product.condition, null);
  assert.ok(contradictoryUsed.issues.some((issue) => issue.includes("Condición comercial contradictoria")));

  const contradictoryNew = prepareProduct({ ...usedGam, condition: "Nuevo" }, catalog);
  assert.equal(contradictoryNew.product.condition, null);
  assert.equal(contradictoryNew.status, "review");
  assert.ok(contradictoryNew.issues.some((issue) => issue.includes("Condición comercial contradictoria")));
});

test("Mercaeleva: condición explícita y Estado publicado concuerdan o bloquean por contradicción", async () => {
  const catalog = await loadImportCatalog();
  for (const state of ["Nuevo", "Nueva"]) {
    const prepared = prepareProduct({ ...mercaeleva, specs: { Estado: state } }, catalog);
    assert.equal(prepared.product.condition, "Nuevo", state);
    assert.equal(prepared.product.categorySellID, null, state);
    assert.equal(prepared.status, "review", state);
    assert.ok(!prepared.issues.some((issue) => issue.includes("Condición comercial")), state);
  }
  for (const state of ["Usado", "Usada", "Segunda mano"]) {
    const prepared = prepareProduct({ ...mercaeleva, specs: { Estado: state } }, catalog);
    assert.equal(prepared.product.condition, "Segunda_Mano", state);
    assert.ok(!prepared.issues.some((issue) => issue.includes("Condición comercial")), state);
  }
  const explicitNew = prepareProduct({ ...mercaeleva, condition: "Nuevo", specs: { Estado: "Nuevo" } }, catalog);
  assert.equal(explicitNew.product.condition, "Nuevo");
  const explicitUsed = prepareProduct({ ...mercaeleva, condition: "Segunda mano", specs: { Estado: "Usado" } }, catalog);
  assert.equal(explicitUsed.product.condition, "Segunda_Mano");

  const contradictoryNew = prepareProduct({ ...mercaeleva, condition: "Nuevo", specs: { Estado: "Usado" } }, catalog);
  const contradictoryUsed = prepareProduct({ ...mercaeleva, condition: "Segunda mano", specs: { Estado: "Nuevo" } }, catalog);
  for (const prepared of [contradictoryNew, contradictoryUsed]) {
    assert.equal(prepared.product.condition, null);
    assert.equal(prepared.status, "review");
    assert.ok(prepared.issues.some((issue) => issue.includes("Condición comercial contradictoria")));
  }
  const ambiguous = prepareProduct({ ...mercaeleva, condition: null, specs: { Estado: "Revisado" } }, catalog);
  assert.equal(ambiguous.product.condition, null);
  assert.ok(ambiguous.issues.some((issue) => issue.includes("Condición comercial no confirmada")));
});

test("Gomariz y proveedores desconocidos no reciben condición sin evidencia", async () => {
  const catalog = await loadImportCatalog();
  for (const providerId of ["gomariz", "otro-proveedor"]) {
    const prepared = prepareProduct({ ...gam, providerId, condition: null, categoryKey: "venta" }, catalog);
    assert.equal(prepared.product.condition, null, providerId);
    assert.equal(prepared.status, "review", providerId);
    assert.ok(prepared.issues.some((issue) => issue.includes("Condición comercial no confirmada")));
  }
});

test("el contrato de preparación acepta Nuevo, Segunda_Mano y null, nunca estados desconocidos", async () => {
  const catalog = await loadImportCatalog();
  const examples = [prepareProduct(gam, catalog), prepareProduct(usedGam, catalog),
    prepareProduct({ ...mercaeleva, specs: {} }, catalog)];
  for (const entry of examples) {
    const document = { quality: "complete" as const, published: true as const, products: [entry] };
    const parsed = parsePreparation(document, entry.product.providerId);
    assert.equal(parsed.products[0]?.product.condition, entry.product.condition);
    assert.equal(parsed.products[0]?.status, entry.status);
  }
  const document = { quality: "complete" as const, published: true as const, products: [{
    ...examples[0], product: { ...examples[0]?.product, condition: "Alquiler" }
  }] };
  assert.throws(() => parsePreparation(document, "gam"), /productos inválidos/);
});

test("exportación no permite que Nuevo use una categoría de ocasión aunque se manipule ready", async () => {
  const catalog = await loadImportCatalog();
  const prepared = prepareProduct(usedGam, catalog);
  const document = {
    quality: "complete" as const, published: true as const,
    products: [{ ...prepared, status: "ready" as const, issues: [], product: {
      ...prepared.product, condition: "Nuevo" as const
    } }]
  };
  const plan = planProductImport(document, "gam", inventory, catalog);
  assert.equal(plan.report.newProducts, 0);
  assert.equal(plan.report.reviewProducts, 1);
  assert.match(plan.report.review[0]?.reason ?? "", /Categoría no coincide de forma única/);
});

test("exportación no admite condición desconocida aunque se manipule ready", async () => {
  const catalog = await loadImportCatalog();
  const prepared = prepareProduct(usedGam, catalog);
  const document = {
    quality: "complete" as const, published: true as const,
    products: [{ ...prepared, status: "ready" as const, issues: [], product: {
      ...prepared.product, condition: null
    } }]
  };
  const plan = planProductImport(document, "gam", inventory, catalog);
  assert.equal(plan.report.newProducts, 0);
  assert.equal(plan.report.reviewProducts, 1);
  assert.match(plan.report.review[0]?.reason ?? "", /Condición incompatible/);
});

test("sin condición fiable no se asigna categoría comercial de ocasión ni de nueva", async () => {
  const catalog = await loadImportCatalog();
  const unknown = prepareProduct({ ...usedGam, condition: null, categoryKey: "carretillas-elevadoras-diesel-segunda-mano" }, catalog);
  assert.equal(unknown.product.condition, null);
  assert.equal(unknown.product.categorySellID, null);
  assert.equal(unknown.product.category, null);
  assert.equal(unknown.status, "review");
  assert.ok(unknown.issues.includes("Categoría Equipzilla sin correspondencia inequívoca"));

  const contradictory = prepareProduct({ ...usedGam, condition: "Nuevo" }, catalog);
  assert.equal(contradictory.product.condition, null);
  assert.equal(contradictory.product.categorySellID, null);
  assert.ok(contradictory.issues.some((issue) => issue.includes("contradictoria")));
});
