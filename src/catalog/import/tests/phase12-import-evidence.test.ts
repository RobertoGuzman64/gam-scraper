import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const records: readonly ProductRecord[] = source.products;
const byReference = new Map(records.map((record) => [record.reference, record]));
const reference = (id: string): ProductRecord => {
  const record = byReference.get(id);
  if (!record) throw new Error(`No existe referencia ${id}`);
  return record;
};
const prepared = (record: ProductRecord) => prepareProduct(record, catalog);
const attribute = (record: ProductRecord, name: string): string | number | boolean | null => {
  const definition = catalog.attributes.find((item) => item.name === name);
  if (!definition) throw new Error(`Falta atributo ${name}`);
  return prepared(record).product.attributes.find((item) => item.attributeID === definition.id)?.value ?? null;
};

test("Fase 12: microfregadora CS16 recupera operador a pie y alimentación explícita", () => {
  const record = reference("3996");
  assert.equal(attribute(record, "Tipo de conductor"), "Hombre a pie");
  assert.equal(attribute(record, "Alimentación"), "Batería");
  assert.deepEqual(prepared(record).importIssues?.createMany, []);
  assert.equal(prepared(record).status, "ready");
});

test("Fase 12: FCA T191 recupera batería sin desbloquear anchura y conductor pendientes", () => {
  const record = reference("3997");
  assert.equal(attribute(record, "Alimentación"), "Batería");
  assert.deepEqual(prepared(record).importIssues?.createMany, [
    "Atributo obligatorio ausente: Tipo de conductor",
    "Atributo obligatorio ausente: Ancho de trabajo"
  ]);
  assert.equal(prepared(record).status, "review");
});

test("Fase 12: la recuperación exige origen, familia y descripción del mismo modelo", () => {
  const record = reference("3996");
  const variants: readonly ProductRecord[] = [
    { ...record, categoryKey: "manutencion" },
    { ...record, url: record.url.replace("online.gamrentals.com", "otra-fuente.example") },
    { ...record, model: "FCA CS17" },
    { ...record, longDescription: null },
    { ...record, longDescription: reference("3997").longDescription }
  ];
  for (const variant of variants) {
    assert.equal(attribute(variant, "Alimentación"), null);
    assert.equal(attribute(variant, "Tipo de conductor"), null);
  }
});

test("Fase 12: mantiene bloqueos cuando no hay potencia inequívoca o la ficha corresponde a otra variante", () => {
  for (const id of ["4029", "4032", "4033", "4034"]) {
    assert.equal(attribute(reference(id), "Alimentación"), null, id);
  }
  assert.equal(attribute(reference("4023"), "Tipo de conductor"), null);
  for (const id of ["3996", "3997"]) {
    const record = reference(id);
    assert.equal(attribute({ ...record, longDescription: "La batería es opcional." }, "Alimentación"), null);
  }
});
