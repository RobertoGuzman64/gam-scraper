import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { mercaelevaShortDescription } from "../mapping/providers/mercaeleva/descriptions.js";
import { mercaelevaMissingDescriptions } from "../mapping/providers/mercaeleva/missing-descriptions.js";

const source = await readCanonicalCatalog("src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = source.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Mercaeleva: convierte especificaciones propias en descripciones de máquinas nuevas sin general", () => {
  const cases = [
    ["M288-9739", "Apilador eléctrico MB ESL122", "1.200 kg", "3.600 mm"],
    ["M402-2703", "Carretilla eléctrica MB EFL253", "2.500 kg", "4.800 mm"]
  ] as const;
  for (const [reference, name, capacity, height] of cases) {
    const record = find(reference);
    const original = JSON.stringify(record);
    const generated = mercaelevaMissingDescriptions(record);
    assert.ok(generated.short, reference);
    assert.ok(generated.long, reference);
    assert.ok(generated.short.includes(name), reference);
    assert.ok(generated.short.includes(capacity), reference);
    assert.ok(generated.short.includes(height), reference);
    assert.ok(generated.long.includes(name), reference);
    assert.ok(generated.long.includes("Batería de litio"), reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.description, generated.short, reference);
    assert.equal(prepared.product.description_general, generated.long, reference);
    assert.equal(prepared.product.reference, record.reference, reference);
    assert.equal(prepared.product.sourceUrl, record.url, reference);
    assert.deepEqual(prepared.product.spec, record.specs, reference);
    assert.equal(JSON.stringify(record), original, reference);
  }
});

test("Mercaeleva: no convierte contradicciones explícitas en narración técnica", () => {
  for (const reference of ["M062-8951", "M119-9334"] as const) {
    const record = find(reference);
    assert.deepEqual(mercaelevaMissingDescriptions(record), { short: null, long: null }, reference);
    assert.equal(prepareSourceProduct(record).product.description, null, reference);
  }
});

test("Mercaeleva: exige identidad y concordancia técnica en la derivación", () => {
  const record = find("M288-9739");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, categoryKey: "alquiler" },
    { ...record, condition: "Segunda mano" },
    { ...record, reference: "M288-9740" },
    { ...record, url: record.url.replace("sales.mercaeleva.com", "otro.example") },
    { ...record, brand: "EP" },
    { ...record, model: "ESL123" },
    { ...record, title: record.title?.replace("1.200", "1.400") ?? null },
    { ...record, title: `${record.title} otro modelo` },
    { ...record, longDescription: "Texto del vendedor" },
    { ...record, shortDescription: "Texto original" },
    { ...record, specs: { ...record.specs, Marca: "EP" } },
    { ...record, specs: { ...record.specs, Modelo: "ESL123" } },
    { ...record, specs: { ...record.specs, Estado: "Usado" } },
    { ...record, specs: { ...record.specs, "Título adicional": "Otra máquina" } },
    { ...record, specs: { ...record.specs, "Tipo de Batería": "Plomo-ácido" } },
    { ...record, specs: { ...record.specs, "Capacidad máxima de elevación": "1400 kg" } },
    { ...record, specs: { ...record.specs, "Capacidad máxima de elevación": ["1200 kg", "1400 kg"] } },
    { ...record, specs: { ...record.specs, "Altura máxima de elevación": "1200 kg" } },
    { ...record, specs: { ...record.specs, "Tipo de motor": "Diésel" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(mercaelevaMissingDescriptions(variant).short, null, String(index));
  }
});

test("Mercaeleva: cabina modular solo se resume si el texto original respalda dimensiones y puerta", () => {
  const record = find("M294-4678");
  const expected = "Módulo caseta diáfana con aire de 6 x 2,35 m y puerta lateral en el lado corto.";
  assert.equal(mercaelevaShortDescription(record), expected);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.description, expected);
  assert.equal(prepared.product.description_general, record.longDescription);
  for (const variant of [
    { ...record, title: record.title?.replace("6m", "7m") ?? null },
    { ...record, longDescription: record.longDescription?.replace("LADO CORTO", "LADO LARGO") ?? null },
    { ...record, brand: "MB" },
    { ...record, providerId: "gam" }
  ]) assert.equal(mercaelevaShortDescription(variant), null);
});

test("Mercaeleva: no contamina fichas con descripción existente ni otras referencias del corte", () => {
  const recoverable = new Set(["M288-9739", "M402-2703", "M294-4678"]);
  for (const record of source.products) {
    if (!recoverable.has(record.reference ?? "")) {
      assert.deepEqual(mercaelevaMissingDescriptions(record), { short: null, long: null }, record.reference ?? "sin referencia");
    }
    if (record.shortDescription?.trim()) assert.equal(mercaelevaShortDescription(record), null);
  }
});
