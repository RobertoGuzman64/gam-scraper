import assert from "node:assert/strict";
import test from "node:test";
import { prepareProduct } from "../preparation/prepare.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { base } from "./preparation-fixtures.js";

test("catálogo de atributos enlazado a categorías reales del backend", async () => {
  const catalog = await loadImportCatalog();
  assert.equal(catalog.categories.find((item) => item.id === 29)?.name, "Plataformas Articuladas Diésel de Segunda Mano");
  const required = new Set(catalog.relations.filter((rel) => rel.categoryID === 29).map((rel) => rel.attributeID));
  assert.ok(required.has(1));
  assert.ok(required.has(115));
  assert.ok(required.has(116));
});

test("producto completo se prepara con categorías y atributos reales, sin companyID ficticio", async () => {
  const catalog = await loadImportCatalog();
  const record = prepareProduct(base, catalog);
  assert.equal(record.status, "ready");
  assert.deepEqual(record.issues, []);
  assert.equal(record.product.categorySellID, 29);
  assert.equal(record.product.condition, "Segunda_Mano");
  assert.equal(record.product.price, 20500);
  assert.equal(record.product.images.length, 2);
  assert.deepEqual(record.product.attributes.find((attr) => attr.attributeID === 1), { attributeID: 1, value: 16 });
  assert.deepEqual(record.product.attributes.find((attr) => attr.attributeID === 115), { attributeID: 115, value: "JLG" });
  assert.equal("companyID" in record.product, false);
});

test("preparación conserva la descripción corta publicada aunque falte o coincida con la general", async () => {
  const catalog = await loadImportCatalog();
  const duplicated = prepareProduct({ ...base, shortDescription: "Máquina revisada.  ", longDescription: "Máquina revisada." }, catalog);
  assert.equal(duplicated.product.description, "Máquina revisada.");
  assert.equal(duplicated.product.description_general, "Máquina revisada.");
  assert.equal(duplicated.status, "ready");
  assert.deepEqual(duplicated.issues, []);

  const distinct = prepareProduct(base, catalog);
  assert.equal(distinct.product.description, base.shortDescription);
  assert.equal(distinct.product.description_general, base.longDescription);
  assert.equal(distinct.status, "ready");

  const longOnly = prepareProduct({ ...base, shortDescription: null }, catalog);
  assert.equal(longOnly.product.description, null);
  assert.equal(longOnly.product.description_general, base.longDescription);
  assert.equal(longOnly.status, "ready");
  assert.deepEqual(longOnly.issues, []);
  assert.ok(longOnly.importIssues?.createMany.some((issue) => issue.includes("backend exige una descripción corta")));

  const shortOnly = prepareProduct({ ...base, longDescription: null }, catalog);
  assert.equal(shortOnly.product.description, base.shortDescription);
  assert.equal(shortOnly.product.description_general, null);
  assert.equal(shortOnly.status, "ready");
  assert.deepEqual(shortOnly.issues, []);
});

test("la categoría genérica venta no se asigna arbitrariamente", async () => {
  const record = prepareProduct({ ...base, categoryKey: "venta" }, await loadImportCatalog());
  assert.equal(record.status, "review");
  assert.equal(record.product.categorySellID, null);
  assert.ok(record.issues.some((issue) => issue.includes("Tipo de máquina de origen sin confirmar")));
});

test("no publica como categorías de ocasión ni la raíz ni ramas de maquinaria nueva", async () => {
  const catalog = await loadImportCatalog();
  for (const categoryKey of ["maquinaria", "nuevo", "ocasion", "plataforma-elevadora-segunda-mano"]) {
    const record = prepareProduct({ ...base, categoryKey }, catalog);
    assert.equal(record.product.categorySellID, null, categoryKey);
    assert.equal(record.status, "review", categoryKey);
  }
});

test("el precio ausente se conserva sin bloquear create/many", async () => {
  const record = prepareProduct({ ...base, price: null }, await loadImportCatalog());
  assert.equal(record.status, "ready");
  assert.equal(record.product.price, null);
  assert.deepEqual(record.issues, []);
});

test("atributo obligatorio ausente bloquea importación y los desconocidos se conservan en specs", async () => {
  const record = prepareProduct({ ...base, specs: { "Altura de trabajo": "N/D", "Valor proveedor": "propio" } }, await loadImportCatalog());
  assert.equal(record.status, "ready");
  assert.deepEqual(record.issues, []);
  assert.ok(record.importIssues?.createMany.includes("Atributo obligatorio ausente: Altura de trabajo"));
  assert.equal(record.product.spec["Valor proveedor"], "propio");
  assert.ok(!record.product.attributes.some((item) => item.attributeID === 1));
});

test("precio, imágenes y descripción inválidos requieren revisión; no se inventan valores", async () => {
  const record = prepareProduct({ ...base, price: "A consultar", images: [], image: null, shortDescription: null, longDescription: null }, await loadImportCatalog());
  assert.equal(record.product.price, null);
  assert.deepEqual(record.product.images, []);
  assert.equal(record.product.description, null);
  assert.ok(!record.issues.some((issue) => issue.startsWith("Precio ")));
  assert.equal(record.status, "ready");
  assert.deepEqual(record.issues, []);
  assert.ok(record.importIssues?.createMany.includes("URL de imagen ausente o inválida"));
  assert.ok(record.importIssues?.createMany.includes("Descripción ausente"));
});

test("los formatos de precio de los tres proveedores se convierten sin adivinar separadores inválidos", async () => {
  const catalog = await loadImportCatalog();
  const cases: readonly { readonly providerId: string; readonly raw: string; readonly expected: number | null }[] = [
    { providerId: "gam", raw: "12.500 €", expected: 12500 },
    { providerId: "gomariz", raw: "18 750,50 EUR", expected: 18750.5 },
    { providerId: "mercaeleva", raw: "20,500.00 €", expected: 20500 },
    { providerId: "gam", raw: "1.234.567,89 €", expected: 1234567.89 },
    { providerId: "gomariz", raw: "1.234.56 €", expected: null },
    { providerId: "mercaeleva", raw: "12,34,56", expected: null },
    { providerId: "gam", raw: "Consultar", expected: null },
    { providerId: "gomariz", raw: "0 €", expected: null }
  ];
  for (const entry of cases) {
    const product = prepareProduct({ ...base, providerId: entry.providerId, price: entry.raw }, catalog);
    assert.equal(product.product.price, entry.expected, `${entry.providerId}: ${entry.raw}`);
    if (entry.expected === null && /\d/.test(entry.raw)) {
      assert.equal(product.status, "review");
      assert.ok(product.issues.includes("Precio publicado inválido"));
    } else if (entry.expected === null) {
      assert.equal(product.status, "ready");
      assert.deepEqual(product.issues, []);
    }
  }
});
