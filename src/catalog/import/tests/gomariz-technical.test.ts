import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare.js";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";

const catalog = await loadImportCatalog();
const source = (section: string, family: string, specs: SpecsMap): ProductRecord => ({
  providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria de ocasión",
  url: `https://www.gomarizrent.com/venta/${section}/${family}/ficha/`,
  title: "Máquina de ocasión", reference: "TEST", shortDescription: null, longDescription: null,
  price: null, brand: null, model: null, year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: null, specs
});
const value = (record: ProductRecord, name: string): string | number | boolean | null => {
  const attribute = catalog.attributes.find((item) => item.name === name);
  assert.ok(attribute);
  return resolveAttributeValue(record, attribute);
};
const energy = "energia-electrica-e-iluminacion";
const lifts = "elevacion-y-trabajos-en-altura";

test("Gomariz: recupera depósito en litros publicado en generadores sin confundir carga", () => {
  const generator = source(energy, "generador", { Capacidad: "350 l", Motor: "Diésel" });
  assert.equal(value(generator, "Capacidad del depósito"), 350);
  assert.equal(value(source(energy, "generador", { Capacidad: "1.200 litros" }), "Capacidad del depósito"), 1200);
  assert.equal(value(source(energy, "generador", { Capacidad: "350 kg" }), "Capacidad del depósito"), null);
  assert.equal(value(source(energy, "generador", { Capacidad: "350 l / 500 l" }), "Capacidad del depósito"), null);
  assert.equal(value(source(energy, "generador", { Capacidad: "0 l" }), "Capacidad del depósito"), null);
  assert.equal(value(source(energy, "generador", { Capacidad: "350 l", "Capacidad del depósito": "350 l" }), "Capacidad del depósito"), 350);
  assert.equal(value(source(energy, "generador", { "Capacidad del depósito": "350 litros" }), "Capacidad del depósito"), 350);
  assert.equal(value(source(energy, "generador", { Capacidad: "350 l", "Capacidad del depósito": "400 l" }), "Capacidad del depósito"), null);
  assert.equal(value(source(energy, "torre-de-luz", { Capacidad: "350 l" }), "Capacidad del depósito"), null);
  assert.equal(value(source("manipulacion-de-materiales", "manipulador-telescopico", { Capacidad: "350 l" }), "Capacidad del depósito"), null);
  assert.equal(value({ ...generator, providerId: "gam" }, "Capacidad del depósito"), null);
  assert.equal(value({ ...generator, url: generator.url.replace("gomarizrent.com", "proveedor.example") }, "Capacidad del depósito"), null);
  assert.equal(value({ ...generator, url: generator.url.replace("energia-electrica-e-iluminacion", "limpieza") }, "Capacidad del depósito"), null);
  assert.equal(value(generator, "Capacidad máxima"), null);
});

test("Gomariz: bloquea altura de plataforma contradictoria en datos ya almacenados", () => {
  const truck = source(lifts, "camion-plataforma", {
    "Altura plataforma": "3.07 m", "Altura de trabajo": "20 m", "Altura almacenaje": "3.07 m"
  });
  assert.equal(value(truck, "Altura de plataforma"), null);
  assert.equal(value(truck, "Altura de trabajo"), 20);
  assert.equal(value(source(lifts, "camion-plataforma", {
    "Altura plataforma": "15.7 m", "Altura de trabajo": "17.7 m", "Altura almacenaje": "2.94 m"
  }), "Altura de plataforma"), 15.7);
  assert.equal(value(source(lifts, "elevador-tijera", {
    "Altura plataforma": "14.30 m", "Altura de trabajo": "6.30 m"
  }), "Altura de plataforma"), null);
  assert.equal(value(source(lifts, "elevador-tijera", {
    "Altura plataforma": "4.30 m", "Altura de trabajo": "6.30 m"
  }), "Altura de plataforma"), 4.3);
  assert.equal(value(source(lifts, "elevador-mastil-vertical", {
    "Altura plataforma": "1.99 m", "Altura de trabajo": "4.50 m", "Altura almacenaje": "1.99 m"
  }), "Altura de plataforma"), 1.99);
  assert.equal(value({ ...truck, providerId: "mercaeleva" }, "Altura de plataforma"), 3.07);
  assert.equal(value(source("manipulacion-de-materiales", "manipulador-telescopico", {
    "Altura de trabajo": "13.8 m", "Alcance lateral": "9.25 m", Capacidad: "4000 kg"
  }), "Altura máxima de elevación"), null);
});

test("Gomariz: preparación del catálogo real sin inventar valores ni perder referencias", async () => {
  const catalogFile = new URL("../../../../storage/scraped/gomariz/scrape-gomariz-catalog.json", import.meta.url);
  const snapshot: unknown = JSON.parse(await readFile(catalogFile, "utf8"));
  assert.ok(snapshot && typeof snapshot === "object" && "products" in snapshot && Array.isArray(snapshot.products));
  const products: ProductRecord[] = snapshot.products;
  assert.ok(products.length > 0);
  const references = products.map((record) => record.reference);
  assert.equal(new Set(references).size, products.length);
  for (const record of products) {
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.product.reference, record.reference);
    if (record.price === null) assert.equal(prepared.product.price, null);
    if (record.reference === "GR1356" && record.specs?.Capacidad === "350 l") {
      assert.equal(value(record, "Capacidad del depósito"), 350);
    }
    if (["CC1535", "CC1666"].includes(record.reference ?? "") &&
      record.specs?.["Altura plataforma"] === record.specs?.["Altura almacenaje"] &&
      record.specs?.["Altura de trabajo"] === "20 m") {
      assert.equal(value(record, "Altura de plataforma"), null);
      assert.equal(value(record, "Altura de trabajo"), 20);
    }
  }
});

test("Gomariz: conserva y rechaza especificaciones con valores múltiples incompatibles", () => {
  const generator = source(energy, "generador", {
    Motor: ["Diésel", "Eléctrico"], Capacidad: ["350 l", "400 l"]
  });
  assert.equal(value(generator, "Combustible"), null);
  assert.equal(value(generator, "Capacidad del depósito"), null);
  const prepared = prepareProduct(generator, catalog);
  assert.ok(prepared.issues.includes("Atributo rechazado por seguridad: Capacidad del depósito"));
  assert.equal(prepared.product.attributes.some((item) => item.value === 350 || item.value === 400), false);
});

test("Gomariz: el catálogo original conserva las incidencias reales sin inventar descripciones cortas", async () => {
  const catalogFile = new URL("../../../../storage/scraped/gomariz/scrape-gomariz-catalog.json", import.meta.url);
  const snapshot: unknown = JSON.parse(await readFile(catalogFile, "utf8"));
  assert.ok(snapshot && typeof snapshot === "object" && "products" in snapshot && Array.isArray(snapshot.products));
  const products: ProductRecord[] = snapshot.products;
  const byReference = new Map(products.map((record) => [record.reference, record]));
  for (const record of products) {
    assert.equal(record.shortDescription, null, record.reference ?? record.url);
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.product.description, null, record.reference ?? record.url);
    assert.ok(prepared.importIssues);
    assert.ok(prepared.importIssues.createMany.length > 0, record.reference ?? record.url);
  }
  for (const reference of ["CC1535", "CC1666"]) {
    const record = byReference.get(reference);
    assert.ok(record);
    const prepared = prepareProduct(record, catalog);
    assert.ok(prepared.issues.includes("Atributo no normalizable: Altura de plataforma"), reference);
    assert.equal(value(record, "Altura de plataforma"), null);
    assert.equal(prepared.status, "review");
  }
  for (const reference of ["5051BDX", "1011JFB", "BA1522", "RE454", "PV556", "BA1358"]) {
    const record = byReference.get(reference);
    assert.ok(record);
    const prepared = prepareProduct(record, catalog);
    assert.ok(prepared.issues.includes("Categoría Equipzilla sin correspondencia inequívoca"), reference);
    assert.equal(prepared.product.categorySellID, null);
  }
});
