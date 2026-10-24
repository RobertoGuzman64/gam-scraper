import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();

const record = (specs: ProductRecord["specs"]): ProductRecord => ({
  providerId: "mercaeleva", categoryKey: "venta", categoryName: "Maquinaria en venta",
  url: "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E48P-M827-8304",
  reference: "M827-8304", title: "Linde E48P CARRETILLA ELEVADORA ELECTRICA 4800 KG",
  shortDescription: null, longDescription: "Ref. MER0798 CARRETILLA ELEVADORA ELECTRICA 4800 KG LINDE E48P",
  brand: "Linde", model: "E48P", price: "4950", condition: "Segunda mano",
  year: null, location: null, country: null, horometer: null, serialNumber: null,
  image: null, images: [], specs: specs ?? {}
});

const attribute = (name: string) => {
  const found = catalog.attributes.find((candidate) => candidate.name === name);
  assert.ok(found, name);
  return found;
};

test("Mercaeleva: valores duplicados incompatibles bloquean capacidades aunque el título parezca confirmarlas", () => {
  const source = record({ "Capacidad máxima de elevación": ["4800 kg", "3000 kg"] });
  const result = resolveAttribute(source, attribute("Capacidad de carga"));
  assert.equal(result.status, "contradiction");
  assert.equal(result.value, null);
  const prepared = prepareProduct(source, catalog);
  assert.ok(prepared.issues.includes("Atributo contradictorio: Capacidad de carga"));
  assert.equal(prepared.status, "review");
  assert.deepEqual(prepared.product.spec["Capacidad máxima de elevación"], ["4800 kg", "3000 kg"]);
});

test("Mercaeleva: mástil duplicado incompatible prevalece sobre un texto aparentemente inequívoco", () => {
  const source = { ...record({ "Tipo de mástil": ["Triple", "Dúplex/estándar"] }),
    longDescription: "Ref. MER0798 CARRETILLA ELEVADORA ELECTRICA 4800 KG MASTIL TRIPLE LINDE E48P" };
  const result = resolveAttribute(source, attribute("Tipo de mástil"));
  assert.equal(result.status, "contradiction");
  assert.equal(result.value, null);
  assert.ok(prepareProduct(source, catalog).issues.includes("Atributo contradictorio: Tipo de mástil"));
});

test("Mercaeleva: capacidades y mástiles con lectura única conservan su mapeo", () => {
  const source = record({ "Capacidad máxima de elevación": "4800 kg", "Tipo de mástil": "Triple" });
  assert.equal(resolveAttribute(source, attribute("Capacidad de carga")).value, 4800);
  assert.equal(resolveAttribute(source, attribute("Tipo de mástil")).value, "Tríplex");
});

test("Mercaeleva: no infiere condición, categoría ni altura ante ausencias o discrepancias del catálogo", () => {
  const source = { ...record({ "Título adicional": "APILADOR ELECTRICO 1600 KG" }),
    url: "https://sales.mercaeleva.com/es/for-sale/machine/BT-SWE-160-M958-0132",
    reference: "M958-0132", title: "BT SWE 160 APILADOR ELECTRICO 1600 KG", condition: null,
    brand: "BT", model: "SWE 160" };
  const prepared = prepareProduct(source, catalog);
  assert.equal(prepared.product.condition, null);
  assert.equal(prepared.product.categorySellID, null);
  assert.equal(prepared.status, "ready");
  const conflict = { ...record({ "Altura de trabajo": "16 m" }),
    url: "https://sales.mercaeleva.com/es/for-sale/machine/LGMG-AS1413-M486-0114",
    reference: "M486-0114", title: "LGMG AS1413 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 14 MT",
    brand: "LGMG", model: "AS1413",
    longDescription: "Ref. 1236 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 16 MT LGMG AS1413 HORAS 181" };
  assert.ok(prepareProduct(conflict, catalog).issues.includes("Descripción comercial contradictoria: altura de trabajo"));
});
