import { readMercaelevaSource } from "../../../../../../testing/builders/mercaeleva-source-fixture.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { resolveMercaelevaConciseDescription } from "../../../../mapping/providers/mercaeleva/concise-description.js";
import { resolveMercaelevaGeneralDescription } from "../../../../mapping/providers/mercaeleva/general-description.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const originals = await readMercaelevaSource();
const legacyShort = (record: ProductRecord): ProductRecord => {
  const general = record.longDescription ?? "";
  const short = general.match(/^ref\.\s*[^\s]+\s+(.+?)(?:\s+HORAS|\s+HOURS|\s+AÑO DE FABRICACION|\s+YEAR OF MANUFACTURE)/iu)?.[1] ??
    general.match(/^(Marca:.+?Tipo: Camión porta-vehículos)/iu)?.[1] ?? null;
  return { ...record, shortDescription: short };
};
const records = originals.map(legacyShort);
const find = (reference: string): ProductRecord => {
  const record = records.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

const improved = [
  ["M239-6301", "2012"],
  ["M570-8735", "4707 h"],
  ["M879-4639", "2261 h"],
  ["M200-9533", "4000 kg"],
  ["M030-7485", "11 m"],
  ["M928-9933", "160 CV"]
] as const;

test("Mercaeleva: enriquece solo resúmenes escuetos con evidencia propia", () => {
  for (const [reference, value] of improved) {
    const record = find(reference);
    const original = JSON.stringify(record);
    const newShort = resolveMercaelevaConciseDescription(record);
    assert.ok(newShort, reference);
    assert.ok(newShort.includes(value), `${reference}: ${value}`);
    assert.ok(newShort.includes(record.brand ?? ""), reference);
    assert.ok(newShort.includes(record.model ?? ""), reference);
    const output = prepareSourceProduct(record);
    assert.ok(output.product.description, reference);
    assert.ok(output.product.description_general, reference);
    assert.equal(output.product.reference, record.reference, reference);
    assert.equal(output.product.sourceUrl, record.url, reference);
    assert.deepEqual(output.product.spec, record.specs, reference);
    assert.equal(JSON.stringify(record), original, reference);
  }
});

test("Mercaeleva: conserva textos breves informativos y contradicciones no resueltas", () => {
  for (const reference of ["M582-1882", "M940-4770", "M017-2019", "M432-1479", "M913-0641", "M736-5615"]) {
    const record = find(reference);
    assert.equal(resolveMercaelevaConciseDescription(record), null, reference);
    assert.ok(prepareSourceProduct(record).product.description, reference);
  }
});

test("Mercaeleva: exige identidad y procedencia exactas, sin contaminar otros proveedores", () => {
  const record = find("M239-6301");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, categoryKey: "alquiler" },
    { ...record, reference: "M239-6302" },
    { ...record, url: record.url.replace("sales.mercaeleva.com", "otro.example") },
    { ...record, title: "BT LPE200/9 TRANSPALET ELECTRICO" },
    { ...record, brand: "Linde" },
    { ...record, model: "LPE200/9" },
    { ...record, shortDescription: null },
    { ...record, longDescription: record.longDescription?.replace("2012", "2013") ?? null },
    { ...record, year: "2013" },
    { ...record, specs: { ...record.specs, Marca: "Linde" } },
    { ...record, specs: { ...record.specs, Modelo: "LPE200/9" } },
    { ...record, specs: { ...record.specs, "Año de fabricación": "2013" } },
    { ...record, specs: { ...record.specs, "Artículo No.": "OTRO" } },
    { ...record, specs: { ...record.specs, Estado: "Nuevo" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveMercaelevaConciseDescription(variant), null, String(index));
  }
});

test("Mercaeleva: bloquea incongruencias técnicas de manipuladores y plataformas", () => {
  const manipulator = find("M200-9533");
  const platform = find("M030-7485");
  for (const variant of [
    { ...manipulator, specs: { ...manipulator.specs, "Altura máxima de elevación": "16 m" } },
    { ...manipulator, specs: { ...manipulator.specs, "Horas laborales": "5200 h" } },
    { ...manipulator, specs: { ...manipulator.specs, "Título adicional": "MANIPULADOR TELESCOPICO 16 MT" } },
    { ...manipulator, longDescription: manipulator.longDescription?.replace("HORAS 5324", "HORAS 5000") ?? null },
    { ...platform, specs: { ...platform.specs, "Tipo de motor": "Diesel" } },
    { ...platform, specs: { ...platform.specs, "Altura de trabajo": "12 m" } },
    { ...platform, longDescription: platform.longDescription?.replace("HOURS 2412", "HOURS 2142") ?? null },
    { ...platform, specs: { ...platform.specs, "Año de fabricación": "2007" } }
  ]) assert.equal(resolveMercaelevaConciseDescription(variant), null, variant.reference ?? "sin referencia");
});

test("Mercaeleva: no acepta una potencia de camión contradictoria", () => {
  const truck = find("M928-9933");
  for (const variant of [
    { ...truck, specs: { ...truck.specs, "Título adicional": "Camión porta-vehículos 180CV" } },
    { ...truck, specs: { ...truck.specs, "Tipo de motor": "Gasolina" } },
    { ...truck, longDescription: truck.longDescription?.replace("Potencia: 160 CV", "Potencia: 180 CV") ?? null },
    { ...truck, shortDescription: "Camión porta-vehículos Iveco" }
  ]) assert.equal(resolveMercaelevaConciseDescription(variant), null);
});

test("Mercaeleva: solo cambia las cortas previstas entre las fichas del original canónico", () => {
  const expected = improved.map(([reference]) => reference).sort();
  const changed = records.filter((record) => resolveMercaelevaConciseDescription(record) !== null)
    .map((record) => record.reference).sort();
  assert.deepEqual(changed, expected);
  assert.equal(records.length, 221);
  assert.equal(new Set(records.map((record) => record.reference)).size, 221);
});
