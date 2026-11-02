import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../normalization/normalize-specs.js";
import { recoverGamVerifiedResidualPerformanceSpecs } from "../../../../evidence/providers/gam/operacion-seguridad/verified-residual-performance-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const references = [
  "6420", "4388", "6480", "6481", "6368", "4624", "6113", "6114", "6323", "6115",
  "5989", "5990", "4660", "4717", "3997", "2369", "6573", "4012", "4006", "4007"
] as const;

const newTechnicalReferences = [
  "6113", "6114", "6115", "4388", "2100", "2101", "2102", "6990", "4622", "2089",
  "2076", "2070", "2043", "2367", "2040", "2026", "2025", "2014", "5079", "159"
] as const;

const additionalTechnicalReferences = [
  "2080", "2081", "2083", "2084", "2220", "2221", "2222", "2223", "2254", "2285",
  "2286", "2030", "2031", "2032", "2033", "3800", "4738", "6963", "2010", "6542"
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

test("recupera solo las referencias acreditadas y conserva los originales", () => {
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
  assert.deepEqual(new Set(changed), new Set([...references, ...newTechnicalReferences, ...additionalTechnicalReferences]));
  assert.equal(changed.length, 56);
  assert.equal(addedCount, 65);
});

test("todas las recuperaciones llegan al preparador y sobreviven al normalizador", () => {
  for (const reference of [...references, ...newTechnicalReferences, ...additionalTechnicalReferences]) {
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
  for (const reference of [...references, ...newTechnicalReferences, ...additionalTechnicalReferences]) {
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
      { ...source, longDescription: "Modelo ajeno" }
    ];
    for (const variant of variants) {
      assert.deepEqual(recoverGamVerifiedResidualPerformanceSpecs(variant), variant.specs ?? {}, `${reference}: protección de variante`);
    }
    const accredited = { ...source.specs, [first]: "Valor acreditado previamente" };
    const retained = recoverGamVerifiedResidualPerformanceSpecs({ ...source, specs: accredited });
    assert.equal(retained[first], accredited[first], `${reference}: no sobrescribe la acreditación previa`);
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
    const retained = reference === "6113" ? { ...source.specs, Consumo: "5,19 kWh/h (aprox., ciclo VDI)" } : source.specs ?? {};
    assert.deepEqual(recoverGamVerifiedResidualPerformanceSpecs(modified), retained, reference);
  }
});


const newTechnicalClaims = [
  ["6113", "Consumo", "5,19 kWh/h (aprox., ciclo VDI)"],
  ["6114", "Consumo", "5,3 kWh/h (aprox., ciclo VDI)"],
  ["6115", "Consumo", "5,7 kWh/h (aprox., ciclo VDI)"],
  ["4388", "Consumo", "0,45 kWh/h (consumo medio declarado)"],
  ["2100", "Consumo", "1,53 kWh/h (declarado)"],
  ["2101", "Consumo", "1,97 kWh/h (declarado)"],
  ["2102", "Consumo", "2,4 kWh/h (declarado)"],
  ["6990", "Consumo", "≈ 0,42 kWh/h (ciclo VDI)"],
  ["4622", "Consumo", "0,25 kWh/h (declarado)"],
  ["2089", "Frenos en baño de aceite", true],
  ["2076", "Frenos en baño de aceite", true],
  ["2070", "Frenos en baño de aceite", true],
  ["2043", "Frenos en baño de aceite", true],
  ["2367", "Frenos en baño de aceite", true],
  ["2040", "Frenos en baño de aceite", true],
  ["2026", "Frenos en baño de aceite", true],
  ["2025", "Frenado regenerativo", true],
  ["2014", "Frenado regenerativo", true],
  ["5079", "Ruedas", "Delanteras gemelas cushion; traseras superelásticas"],
  ["159", "Autonomía máxima (km)", 30]
] as const;

test("GAM: recupera veinte prestaciones técnicas individualizadas sin pérdidas", () => {
  assert.deepEqual(new Set(newTechnicalClaims.map(([reference]) => reference)), new Set(newTechnicalReferences));
  for (const [reference, key, value] of newTechnicalClaims) {
    const source = record(reference);
    const before = structuredClone(source);
    assert.equal(Object.hasOwn(source.specs ?? {}, key), false, reference);
    const recovered = recoverGamVerifiedResidualPerformanceSpecs(source);
    assert.deepEqual(recovered[key], value, reference);
    const prepared = prepareSourceProduct(source).product;
    assert.deepEqual(prepared.spec[key], value, reference);
    const normalized = normalizeSpecsObject(prepared.spec);
    assert.equal(normalized.unknownKeys.includes(key), false, reference);
    assert.notEqual(normalized.normalized[key], undefined, reference);
    assert.deepEqual(source, before, reference);
  }
});

test("GAM: no admite cifras o tipos de frenado alterados en la fuente", () => {
  for (const [reference, original, changed, key] of [
    ["6113", "5,19 kWh/h", "9,19 kWh/h", "Consumo"],
    ["4388", "0,45 kWh/h", "0,95 kWh/h", "Consumo"],
    ["6990", "0,42 kWh/h", "0,52 kWh/h", "Consumo"],
    ["4622", "0.25 kWh/h", "0.75 kWh/h", "Consumo"],
    ["2089", "frenos en baño de aceite", "frenos convencionales", "Frenos en baño de aceite"],
    ["2025", "freno regenerativo", "freno mecánico", "Frenado regenerativo"],
    ["5079", "ruedas delanteras gemelas cushion", "ruedas delanteras gemelas macizas", "Ruedas"],
    ["159", "recorrer 30 km", "recorrer 50 km", "Autonomía máxima (km)"]
  ] as const) {
    const source = record(reference);
    assert.ok(source.longDescription?.includes(original), reference);
    const variant = { ...source, longDescription: source.longDescription?.replaceAll(original, changed) ?? null };
    const recovered = recoverGamVerifiedResidualPerformanceSpecs(variant);
    assert.equal(recovered[key], undefined, reference);
  }
});

const additionalTechnicalClaims = [
  ["2080", "Frenos de disco húmedos", true],
  ["2081", "Frenos de disco húmedos", true],
  ["2083", "Frenos de disco húmedos", true],
  ["2084", "Frenos de disco húmedos", true],
  ["2220", "Frenado regenerativo", true],
  ["2221", "Frenado regenerativo", true],
  ["2222", "Frenado regenerativo", true],
  ["2223", "Frenado regenerativo", true],
  ["2254", "Frenado regenerativo", true],
  ["2285", "Frenado regenerativo", true],
  ["2286", "Frenado regenerativo", true],
  ["2030", "Frenos hidráulicos autocompensados", true],
  ["2031", "Frenos hidráulicos autocompensados", true],
  ["2032", "Frenos hidráulicos autocompensados", true],
  ["2033", "Frenos hidráulicos", true],
  ["3800", "Frenos en baño de aceite", true],
  ["4738", "Frenado automático", true],
  ["6963", "Frenado automático", true],
  ["2010", "Capacidad de la batería (Ah)", 875],
  ["6542", "Rotación de plataforma", "160°"],
] as const;

test("valida las prestaciones residuales acreditadas con el normalizador y conserva el origen", () => {
  assert.deepEqual(new Set(additionalTechnicalClaims.map(([reference]) => reference)), new Set(additionalTechnicalReferences));
  for (const [reference, key, value] of additionalTechnicalClaims) {
    const source = record(reference);
    const before = structuredClone(source);
    assert.equal(Object.hasOwn(source.specs ?? {}, key), false, reference);
    const prepared = prepareSourceProduct(source).product;
    assert.deepEqual(prepared.spec[key], value, reference);
    const normalized = normalizeSpecsObject(prepared.spec);
    assert.equal(normalized.unknownKeys.includes(key), false, reference);
    assert.notEqual(normalized.normalized[key], undefined, reference);
    assert.deepEqual(source, before, reference);
  }
});

test("rechaza cambios de identidad y evidencias distintas de frenado y medidas", () => {
  for (const [reference, oldValue, newValue, key] of [
    ["2080", "frenos de disco húmedos", "frenos regenerativos", "Frenos de disco húmedos"],
    ["2220", "frenos regenerativos", "frenos hidráulicos", "Frenado regenerativo"],
    ["2030", "frenos hidráulicos autocompensados", "frenos regenerativos", "Frenos hidráulicos autocompensados"],
    ["3800", "frenos en baño de aceite", "frenos de disco seco", "Frenos en baño de aceite"],
    ["4738", "frenos automáticos", "frenos manuales", "Frenado automático"],
    ["6963", "frenado automático", "frenado manual", "Frenado automático"],
    ["2010", "batería de 875 Ah", "batería de 975 Ah", "Capacidad de la batería (Ah)"],
    ["6542", "rotación de plataforma es de 160°", "rotación de plataforma es de 180°", "Rotación de plataforma"]
  ] as const) {
    const source = record(reference);
    assert.ok(source.longDescription?.includes(oldValue), reference);
    const variant: ProductRecord = { ...source, longDescription: source.longDescription?.replaceAll(oldValue, newValue) ?? null };
    assert.equal(recoverGamVerifiedResidualPerformanceSpecs(variant)[key], undefined, reference);
    assert.deepEqual(recoverGamVerifiedResidualPerformanceSpecs({ ...source, title: "Otro modelo" }), source.specs ?? {}, reference);
    const retained = recoverGamVerifiedResidualPerformanceSpecs({ ...source, specs: { ...source.specs, [key]: "Dato previamente acreditado" } });
    assert.equal(retained[key], "Dato previamente acreditado", reference);
  }
});
