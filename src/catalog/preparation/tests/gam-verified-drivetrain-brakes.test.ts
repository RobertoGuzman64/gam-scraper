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
  "2011": { key: "Tipo motor", value: "Eléctrico de corriente alterna" }
};

const getRecord = (reference: string): ProductRecord => {
  const found = catalog.products.find((product) => product.reference === reference);
  assert.ok(found, reference);
  return found;
};

test("recupera únicamente veinte prestaciones demostradas por el original", () => {
  const changed: string[] = [];
  for (const record of catalog.products) {
    const reference = record.reference ?? "";
    const before = structuredClone(record);
    const result = recoverGamVerifiedDrivetrainBrakes(record);
    assert.deepEqual(record, before, reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) assert.deepEqual(result[key], value, reference);
    const additions = Object.keys(result).filter((key) => !Object.hasOwn(record.specs ?? {}, key));
    if (!additions.length) continue;
    const entry = expected[reference];
    assert.ok(entry, reference);
    assert.deepEqual(additions, [entry.key], reference);
    assert.deepEqual(result[entry.key], entry.value, reference);
    changed.push(reference);
  }
  assert.equal(changed.length, 20);
  assert.deepEqual(new Set(changed), new Set(Object.keys(expected)));
});

test("conserva los nuevos datos después de preparar y normalizar", () => {
  for (const [reference, { key, value }] of Object.entries(expected)) {
    const prepared = prepareSourceProduct(getRecord(reference));
    const normalized = normalizeSpecsObject(prepared.product.spec);
    assert.deepEqual(prepared.product.spec[key], value, reference);
    assert.deepEqual(normalized.normalized[key], value, reference);
    assert.ok(!normalized.unknownKeys.includes(key), reference);
  }
});

test("no atraviesa protecciones de procedencia, identidad, variante o especificaciones previas", () => {
  for (const [reference, { key }] of Object.entries(expected)) {
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
      { ...record, longDescription: "Otro modelo" },
      { ...record, specs: { ...record.specs, [key]: "Original no modificable" } },
      { ...record, specs: { ...record.specs, [key.toLocaleLowerCase("es")]: "Original no modificable" } }
    ];
    for (const variant of variants) {
      assert.deepEqual(recoverGamVerifiedDrivetrainBrakes(variant), variant.specs ?? {}, reference);
    }
  }
});
