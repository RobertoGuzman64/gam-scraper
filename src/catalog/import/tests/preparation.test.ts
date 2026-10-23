import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareImportBatch, prepareProduct } from "../preparation/prepare.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { writeOutputs } from "../../../pipeline/publication/publish.js";
import type { CategoryScrapeResult } from "../../../contracts/scraping.js";

import type { ProductRecord } from "../../../contracts/catalog.js";

const url = "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M044-4093";
const base: ProductRecord = {
  providerId: "mercaeleva",
  categoryKey: "plataformas-articuladas-diesel-segunda-mano",
  categoryName: "Maquinaria en venta",
  url,
  title: "JLG 450 AJ",
  shortDescription: "Plataforma articulada diésel de ocasión.",
  longDescription: "Plataforma revisada.",
  price: "20.500,00 €",
  reference: "M044-4093",
  brand: "JLG",
  model: "450 AJ",
  year: "2013",
  location: "Barcelona",
  country: "ES",
  horometer: "3666",
  serialNumber: null,
  condition: "Segunda mano",
  image: "https://files2.machineric.com/clients/mercaeleva/machines/M044-4093/public/1.jpg",
  images: [
    "https://files2.machineric.com/clients/mercaeleva/machines/M044-4093/public/1.jpg",
    "https://files2.machineric.com/clients/mercaeleva/machines/M044-4093/public/2.jpeg"
  ],
  specs: { "Altura de trabajo": "16 m" }
};

const category = { key: base.categoryKey, name: base.categoryName, url: "https://example.org/productos" };
const result = (product: ProductRecord, failures: CategoryScrapeResult["failures"] = []): CategoryScrapeResult => ({
  category,
  products: [product],
  discoveredProductUrls: 1,
  failures
});

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

test("el batch separa preparados y revisión sin perder referencias", async () => {
  const catalog = await loadImportCatalog();
  const prepared = prepareImportBatch([base, { ...base, reference: "TE9999", price: null }], catalog);
  assert.deepEqual(prepared.totals, { ready: 2, review: 0 });
  assert.equal(prepared.products[1]?.product.reference, "TE9999");
});

test("CSV mantiene sus campos y añade imágenes; preparación publicada por separado", async () => {
  const dir = await mkdtemp(join(tmpdir(), "catalog-preparation-"));
  try {
    await writeOutputs(dir, "lote", [result(base)], "2026-10-15T09:00:00Z", "2026-10-15T09:01:00Z");
    const csv = await readFile(join(dir, "lote-all.csv"), "utf8");
    assert.match(csv, /imagesJson/);
    assert.match(csv, /2\.jpeg/);
    const report: unknown = JSON.parse(await readFile(join(dir, "lote-preparation.json"), "utf8"));
    assert.ok(report !== null && typeof report === "object" && "totals" in report);
    if (report && typeof report === "object" && "totals" in report) {
      assert.deepEqual(report.totals, { ready: 1, review: 0 });
    }
    await assert.rejects(writeOutputs(dir, "lote", [result({ ...base, price: null }, [{ url, error: "503" }])],
      "2026-10-15T09:02:00Z", "2026-10-15T09:03:00Z"), /Extracción partial/);
    assert.equal(await readFile(join(dir, "lote-all.csv"), "utf8"), csv);
    assert.match(await readFile(join(dir, "lote-partial-preparation.json"), "utf8"), /"review": 0/);
    assert.deepEqual(JSON.parse(await readFile(join(dir, "lote-preparation.json"), "utf8")), report);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});


test("serie compartida con referencias diferentes exige revisión solo de las fichas afectadas", async () => {
  const catalog = await loadImportCatalog();
  const a = { ...base, serialNumber: "SN-COMPARTIDO" };
  const b = { ...base, reference: "M044-4094", url: `${url}-2`, serialNumber: "sn-compartido" };
  const other = { ...base, reference: "M044-4095", url: `${url}-3`, serialNumber: "OTRO" };
  const batch = prepareImportBatch([a, b, other], catalog);
  assert.deepEqual(batch.totals, { ready: 1, review: 2 });
  for (const entry of batch.products.slice(0, 2)) {
    assert.equal(entry.status, "review");
    assert.ok(entry.issues.some((issue) => issue.includes("Número de serie") && issue.includes("M044-4093") && issue.includes("M044-4094")));
  }
  assert.equal(batch.products[2]?.status, "ready");
  assert.equal(batch.products[0]?.product.reference, "M044-4093");
  assert.equal(batch.products[1]?.product.reference, "M044-4094");
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


test("referencias repetidas en el lote se bloquean durante preparación sin perder productos", async () => {
  const catalog = await loadImportCatalog();
  const other = { ...base, reference: "m044-4093", url: `${url}-otra-unidad`, serialNumber: "OTRA-SERIE" };
  const distinct = { ...base, reference: "M044-4096", url: `${url}-tercera-unidad` };
  const prepared = prepareImportBatch([base, other, distinct], catalog);
  assert.deepEqual(prepared.totals, { ready: 1, review: 2 });
  for (const entry of prepared.products.slice(0, 2)) {
    assert.ok(entry.issues.some((issue) => issue.includes("Referencia duplicada en la extracción")));
    assert.equal(entry.status, "review");
  }
  assert.equal(prepared.products[2]?.product.reference, "M044-4096");
  assert.equal(prepared.products[2]?.status, "ready");
});
