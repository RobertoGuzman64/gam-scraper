import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamVerifiedResidualPerformanceSpecs } from "../evidence/providers/gam/verified-residual-performance-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const references = [
  "6420", "4388", "6480", "6481", "6368", "4624", "6113", "6114", "6323", "6115",
  "5989", "5990", "4660", "4717", "3997", "2369", "6573", "4012", "4006", "4007"
] as const;

const record = (reference: string): ProductRecord => {
  const found = catalog.products.find((item) => item.reference === reference);
  assert.ok(found, reference);
  return found;
};

const addedKeys = (source: ProductRecord): readonly string[] => {
  const specs = recoverGamVerifiedResidualPerformanceSpecs(source);
  return Object.keys(specs).filter((key) => !Object.hasOwn(source.specs ?? {}, key));
};

test("recupera exactamente veinte fichas sin modificar el original ni otras referencias", () => {
  const changed: string[] = [];
  let addedCount = 0;
  for (const source of catalog.products) {
    const original = structuredClone(source);
    const after = recoverGamVerifiedResidualPerformanceSpecs(source);
    const added = addedKeys(source);
    assert.deepEqual(source, original, String(source.reference));
    for (const [key, value] of Object.entries(source.specs ?? {})) {
      assert.deepEqual(after[key], value, `${source.reference}: ${key}`);
    }
    if (added.length) {
      changed.push(String(source.reference));
      addedCount += added.length;
    }
  }
  assert.deepEqual(new Set(changed), new Set(references));
  assert.equal(changed.length, 20);
  assert.equal(addedCount, 25);
});

test("todas las recuperaciones llegan al preparador y sobreviven al normalizador", () => {
  for (const reference of references) {
    const source = record(reference);
    const recovered = recoverGamVerifiedResidualPerformanceSpecs(source);
    const prepared = prepareSourceProduct(source);
    const normalized = normalizeSpecsObject(prepared.product.spec);
    for (const key of addedKeys(source)) {
      assert.equal(prepared.product.spec[key], recovered[key], `${reference}: ${key}`);
      assert.ok(!normalized.unknownKeys.includes(key), `${reference}: clave sin regla ${key}`);
      assert.notEqual(normalized.normalized[key], undefined, `${reference}: clave perdida ${key}`);
      assert.notEqual(normalized.normalized[key], null, `${reference}: valor descartado ${key}`);
    }
  }
  const nominal = normalizeSpecsObject(prepareSourceProduct(record("6420")).product.spec).normalized;
  assert.equal(nominal["Pendiente con carga, nominal 3 min (%)"], 15);
  assert.equal(nominal["Pendiente sin carga, nominal 3 min (%)"], 22);
  assert.equal(normalizeSpecsObject(prepareSourceProduct(record("3997")).product.spec).normalized["Depósito de recuperación"], 30);
  assert.equal(normalizeSpecsObject(prepareSourceProduct(record("6573")).product.spec).normalized["Velocidad máxima sin carga (km/h)"], 12.5);
  assert.equal(normalizeSpecsObject(prepareSourceProduct(record("4007")).product.spec).normalized["Potencia de aspiración (kW)"], 0.45);
});

test("no transfiere valores a otro proveedor, modelo, categoría o variante", () => {
  for (const reference of references) {
    const source = record(reference);
    const recovered = recoverGamVerifiedResidualPerformanceSpecs(source);
    const first = addedKeys(source)[0];
    assert.ok(first, reference);
    const claimValue = recovered[first];
    assert.notEqual(claimValue, undefined);
    if (claimValue === undefined) throw new Error(reference);
    const variants: readonly ProductRecord[] = [
      { ...source, providerId: "gomariz" },
      { ...source, reference: "9999" },
      { ...source, brand: "OTRO" },
      { ...source, model: "OTRO" },
      { ...source, title: "Otra máquina" },
      { ...source, categoryKey: "otra-categoria" },
      { ...source, condition: "Segunda mano" },
      { ...source, url: `${source.url}?variante=otra` },
      { ...source, shortDescription: "Modelo ajeno" },
      { ...source, longDescription: "Modelo ajeno" },
      { ...source, specs: { ...source.specs, [first]: claimValue } }
    ];
    for (const variant of variants) {
      assert.deepEqual(recoverGamVerifiedResidualPerformanceSpecs(variant), variant.specs ?? {}, `${reference}: protección de variante`);
    }
  }
});

test("rechaza evidencia que cambie de valor y no normaliza prestaciones de otras máquinas", () => {
  for (const [reference, existing, altered] of [
    ["6420", "15% con carga", "35% con carga"],
    ["6480", "5 % con carga", "8 % con carga"],
    ["6113", "500–640 Ah", "600–640 Ah"],
    ["5989", "26,3 kWh", "28,3 kWh"],
    ["4660", "±310°", "±320°"],
    ["6573", "12,5 km/h", "11,5 km/h"],
    ["4012", "5 horas con baterías húmedas", "6 horas con baterías húmedas"],
    ["4006", "0,45 kW", "0,85 kW"]
  ] as const) {
    const source = record(reference);
    const description = source.longDescription;
    assert.ok(description?.includes(existing), reference);
    if (description === null) throw new Error(reference);
    const modified: ProductRecord = {
      ...source,
      longDescription: description.replaceAll(existing, altered)
    };
    assert.deepEqual(recoverGamVerifiedResidualPerformanceSpecs(modified), source.specs ?? {}, reference);
  }
});
