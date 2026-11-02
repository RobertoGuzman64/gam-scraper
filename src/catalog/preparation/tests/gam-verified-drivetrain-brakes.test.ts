import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamVerifiedDrivetrainBrakes } from "../evidence/providers/gam/verified-drivetrain-brakes-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const expected: Readonly<Record<string, Readonly<{ key: string; value: string | boolean }>>> = {
  "2239": { key: "Freno electromagnético", value: true },
  "2099": { key: "Freno electromagnético", value: true },
  "2106": { key: "Freno electromagnético", value: true },
  "2136": { key: "Freno electromagnético", value: true },
  "2137": { key: "Freno electromagnético", value: true },
  "2140": { key: "Freno electromagnético", value: true },
  "2144": { key: "Freno electromagnético", value: true },
  "2090": { key: "Frenos en baño de aceite", value: true },
  "2049": { key: "Frenos en baño de aceite", value: true },
  "2045": { key: "Frenos en baño de aceite", value: true },
  "2044": { key: "Frenos en baño de aceite", value: true },
  "30": { key: "Frenos en baño de aceite", value: true },
  "2065": { key: "Transmisión", value: "Automática" },
  "2041": { key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás" },
  "2046": { key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás" },
  "2048": { key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás" },
  "2047": { key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás" },
  "31": { key: "Desplazamiento lateral", value: true },
  "3130": { key: "Neumáticos", value: "Superelásticos" },
  "2011": { key: "Tipo motor", value: "Eléctrico de corriente alterna" },
  "6743": { key: "Freno electromagnético", value: true },
  "6744": { key: "Freno electromagnético", value: true },
  "1713": { key: "Freno electromagnético", value: true },
  "4748": { key: "Neumáticos", value: "Sólidos" },
  "4749": { key: "Neumáticos", value: "Sólidos" },
  "4755": { key: "Neumáticos", value: "Sólidos anti-marcado" },
  "4791": { key: "Neumáticos", value: "Sólidos" }
};


const extraExpected: Readonly<Record<string, Readonly<{ key: string; value: string | boolean }>>> = {
  "2042": { key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás" },
  "2049": { key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás" },
  "2045": { key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás" },
  "2044": { key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás" },
  "2096": { key: "Neumáticos", value: "Industriales 8.25x15 de doble banda (opciones: radiales, superelásticas o sin huella)" },
  "4988": { key: "Neumáticos", value: "Industriales de gran perfil" },
  "4989": { key: "Neumáticos", value: "Industriales de gran perfil" },
  "4990": { key: "Neumáticos", value: "Industriales de gran perfil" },
  "4991": { key: "Neumáticos", value: "Industriales de gran perfil" },
  "5998": { key: "Neumáticos", value: "Industriales de gran tamaño" },
  "5999": { key: "Neumáticos", value: "Industriales de gran tamaño" },
  "6000": { key: "Neumáticos", value: "Industriales de gran tamaño" },
  "6001": { key: "Neumáticos", value: "Industriales de gran tamaño" },
  "4733": { key: "Frenado automático", value: true }
};

const expectedClaims = new Map<string, ReadonlyArray<Readonly<{ key: string; value: string | boolean }>>>();
for (const [reference, entry] of Object.entries(expected)) expectedClaims.set(reference, [entry]);
for (const [reference, entry] of Object.entries(extraExpected)) {
  expectedClaims.set(reference, [...(expectedClaims.get(reference) ?? []), entry]);
}

const getRecord = (reference: string): ProductRecord => {
  const found = catalog.products.find((product) => product.reference === reference);
  assert.ok(found, reference);
  return found;
};

test("recupera únicamente prestaciones demostradas por el original sin perder acreditaciones anteriores", () => {
  const changed: string[] = [];
  let addedCount = 0;
  for (const record of catalog.products) {
    const reference = record.reference ?? "";
    const before = structuredClone(record);
    const result = recoverGamVerifiedDrivetrainBrakes(record);
    assert.deepEqual(record, before, reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) assert.deepEqual(result[key], value, reference);
    const additions = Object.keys(result).filter((key) => !Object.hasOwn(record.specs ?? {}, key));
    if (!additions.length) continue;
    const entries = expectedClaims.get(reference);
    assert.ok(entries, reference);
    assert.deepEqual(new Set(additions), new Set(entries.map(({ key }) => key)), reference);
    for (const { key, value } of entries) assert.deepEqual(result[key], value, `${reference}: ${key}`);
    addedCount += additions.length;
    changed.push(reference);
  }
  assert.equal(changed.length, 38);
  assert.equal(addedCount, 41);
  assert.deepEqual(new Set(changed), new Set(expectedClaims.keys()));
});

test("conserva los nuevos datos después de preparar y normalizar", () => {
  for (const [reference, entries] of expectedClaims) {
    const prepared = prepareSourceProduct(getRecord(reference));
    const normalized = normalizeSpecsObject(prepared.product.spec);
    for (const { key, value } of entries) {
      assert.deepEqual(prepared.product.spec[key], value, `${reference}: ${key}`);
      assert.deepEqual(normalized.normalized[key], value, `${reference}: ${key}`);
      assert.ok(!normalized.unknownKeys.includes(key), `${reference}: ${key}`);
    }
  }
});

test("no atraviesa protecciones de procedencia, identidad o variante", () => {
  for (const reference of expectedClaims.keys()) {
    const record = getRecord(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: "0000" },
      { ...record, brand: "OTRA" },
      { ...record, model: "OTRO" },
      { ...record, categoryKey: "otra" },
      { ...record, condition: "Segunda mano" },
      { ...record, url: `${record.url}?otra-variante=1` },
      { ...record, title: "Otro modelo" },
      { ...record, shortDescription: "Otro modelo" },
      { ...record, longDescription: "Otro modelo" }
    ];
    for (const variant of variants) {
      assert.deepEqual(recoverGamVerifiedDrivetrainBrakes(variant), variant.specs ?? {}, reference);
    }
  }
});

test("no sobrescribe valores existentes y conserva acreditaciones independientes en la misma referencia", () => {
  for (const [reference, entries] of expectedClaims) {
    const record = getRecord(reference);
    const result = recoverGamVerifiedDrivetrainBrakes(record);
    for (const { key } of entries) {
      const variant: ProductRecord = { ...record, specs: { ...record.specs, [key]: "Valor original" } };
      const retained = recoverGamVerifiedDrivetrainBrakes(variant);
      assert.deepEqual(retained[key], "Valor original", `${reference}: ${key}`);
      for (const other of entries.filter((entry) => entry.key !== key)) {
        assert.deepEqual(retained[other.key], other.value, `${reference}: ${other.key}`);
      }
      const lower: ProductRecord = { ...record, specs: { ...record.specs, [key.toLocaleLowerCase("es")]: "Valor original" } };
      const untouched = recoverGamVerifiedDrivetrainBrakes(lower);
      assert.equal(untouched[key], undefined, `${reference}: ${key}`);
    }
    for (const { key, value } of entries) assert.deepEqual(result[key], value, `${reference}: ${key}`);
  }
});

test("rechaza el reemplazo de los fragmentos de fuente de la fase 129", () => {
  const replacements = [
    ["2042", "transmisión automática ZF 5WG211", "transmisión manual ZF 5WG211", "Transmisión"],
    ["2096", "Neumáticos industriales 8.25x15 de doble banda, disponibles en versiones radiales, superelásticas o sin huella", "Neumáticos según configuración", "Neumáticos"],
    ["4988", "neumáticos industriales de gran perfil", "neumáticos convencionales", "Neumáticos"],
    ["5998", "neumáticos industriales de gran tamaño", "neumáticos convencionales", "Neumáticos"],
    ["4733", "frenos de disco automáticos", "frenos de disco manuales", "Frenado automático"]
  ] as const;
  for (const [reference, original, modified, key] of replacements) {
    const record = getRecord(reference);
    assert.ok(record.longDescription?.toLocaleLowerCase("es").includes(original.toLocaleLowerCase("es")), reference);
    const variant: ProductRecord = { ...record, longDescription: record.longDescription?.replaceAll(original, modified) ?? null };
    assert.equal(recoverGamVerifiedDrivetrainBrakes(variant)[key], undefined, reference);
  }
});
