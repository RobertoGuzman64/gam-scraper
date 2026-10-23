import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const mercaeleva = await readCanonicalCatalog("storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json");

const sources = new Map<string, readonly ProductRecord[]>([
  ["gam", gam.products],
  ["mercaeleva", mercaeleva.products]
]);

const record = (provider: "gam" | "mercaeleva", reference: string): ProductRecord => {
  const found = sources.get(provider)?.find((product) => product.reference === reference);
  assert.ok(found, `${provider}:${reference}`);
  return found;
};

const attribute = (name: string) => {
  const found = catalog.attributes.find((entry) => entry.name === name);
  assert.ok(found, name);
  return found;
};

const gamConflictingCapacity = [
  "6965", "6932", "6723", "2089", "2211", "2049", "2044", "6272",
  "2016", "2275", "2193", "6421", "50", "2237", "2240", "2136"
] as const;

const gamVariableCapacity = ["237", "235"] as const;
const mercaelevaConflictingCapacity = ["M582-1882", "M827-8304", "M062-8951", "M119-9334"] as const;
const gamNonUnivocalPower = ["6834", "1210", "1218", "1211", "1212", "1213", "1216", "1217", "1219"] as const;

const allReviewed = [
  ...gamConflictingCapacity.map((reference) => `gam:${reference}`),
  ...gamVariableCapacity.map((reference) => `gam:${reference}`),
  ...mercaelevaConflictingCapacity.map((reference) => `mercaeleva:${reference}`),
  ...gamNonUnivocalPower.map((reference) => `gam:${reference}`)
];

test("Fase 6: se comprueban 31 referencias únicas del diagnóstico de capacidad y potencia", () => {
  assert.equal(allReviewed.length, 31);
  assert.equal(new Set(allReviewed).size, 31);
  for (const id of allReviewed) {
    const [provider, reference] = id.split(":");
    assert.ok(provider === "gam" || provider === "mercaeleva");
    assert.ok(reference);
    assert.equal(prepareProduct(record(provider, reference), catalog).status, "review", id);
  }
});

test("Fase 6: las 16 capacidades GAM discrepantes se conservan como contradicción", () => {
  const capacity = attribute("Capacidad de carga");
  for (const reference of gamConflictingCapacity) {
    const product = record("gam", reference);
    assert.deepEqual(resolveAttribute(product, capacity), { status: "contradiction", value: null }, reference);
    assert.ok(prepareProduct(product, catalog).issues.includes("Atributo contradictorio: Capacidad de carga"), reference);
  }
});

test("Fase 6: las dos capacidades multivalor GAM no se convierten en una carga puntual", () => {
  const capacity = attribute("Capacidad de carga");
  for (const reference of gamVariableCapacity) {
    const product = record("gam", reference);
    assert.deepEqual(resolveAttribute(product, capacity), { status: "invalid", value: null }, reference);
    assert.ok(prepareProduct(product, catalog).issues.includes("Atributo no normalizable: Capacidad de carga"), reference);
  }
});

test("Fase 6: los cuatro conflictos Mercaeleva mantienen el valor original y los vetos adicionales", () => {
  const capacity = attribute("Capacidad de carga");
  for (const reference of mercaelevaConflictingCapacity) {
    const product = record("mercaeleva", reference);
    const originalSpecs = JSON.stringify(product.specs);
    assert.deepEqual(resolveAttribute(product, capacity), { status: "contradiction", value: null }, reference);
    const prepared = prepareProduct(product, catalog);
    assert.ok(prepared.issues.includes("Atributo contradictorio: Capacidad de carga"), reference);
    assert.equal(JSON.stringify(product.specs), originalSpecs, reference);
    assert.equal(JSON.stringify(prepared.product.spec), originalSpecs, reference);
  }
  assert.ok(prepareProduct(record("mercaeleva", "M827-8304"), catalog).issues.includes("Atributo contradictorio: Tipo de mástil"));
  assert.ok(prepareProduct(record("mercaeleva", "M119-9334"), catalog).issues.includes("Atributo no normalizable: Horas de uso"));
});

test("Fase 6: las nueve potencias GAM incompatibles no seleccionan un régimen ni confunden kW con kVA", () => {
  const power = attribute("Potencia");
  for (const reference of gamNonUnivocalPower) {
    const product = record("gam", reference);
    const source = JSON.stringify(product.specs);
    assert.deepEqual(resolveAttribute(product, power), { status: "rejected", value: null }, reference);
    assert.ok(prepareProduct(product, catalog).issues.includes("Atributo rechazado por seguridad: Potencia"), reference);
    assert.equal(JSON.stringify(product.specs), source, reference);
  }
});

test("Fase 6: potencia no unívoca y capacidad nominal son conceptos separados", () => {
  const generator = record("gam", "1211");
  assert.match(generator.shortDescription ?? "", /Potencia Emergencia: 83\.0 Kva/);
  assert.match(generator.shortDescription ?? "", /Potencia continuo: 78\.0 Kva/);
  assert.equal(generator.specs?.["Potencia Motor (KW)"], "76 / 72");
  assert.equal(resolveAttribute(generator, attribute("Potencia")).status, "rejected");
  const lift = record("gam", "2016");
  assert.equal(lift.specs?.["Capacidad de carga (kg)"], "1600 KG");
  assert.match(lift.shortDescription ?? "", /1800 kg/i);
  assert.equal(resolveAttribute(lift, attribute("Capacidad de carga")).status, "contradiction");
});

test("Fase 6: la capacidad multivariante explícita no desaparece si falta la especificación", () => {
  const original = record("gam", "235");
  const specs = { ...original.specs };
  delete specs["Capacidad de carga (kg)"];
  const withoutDirect = { ...original, specs };
  assert.equal(resolveAttribute(withoutDirect, attribute("Capacidad de carga")).status, "rejected");
  assert.ok(prepareProduct(withoutDirect, catalog).issues.includes("Atributo rechazado por seguridad: Capacidad de carga"));
  const unambiguous = { ...withoutDirect, shortDescription: "Logitrans Panther con capacidad de carga de 1600 kg" };
  assert.deepEqual(resolveAttribute(unambiguous, attribute("Capacidad de carga")), { status: "resolved", value: 1600 });
});
