import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamVerifiedSteeringBraking } from "../evidence/providers/gam/verified-steering-braking-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const braking = ["5888", "5889", "5890", "5891", "3803", "2335", "2205", "2206", "2370", "2154", "2259", "2243", "2244", "2018", "2019", "2021", "2022", "2023", "2024", "2010", "6990", "2248", "2251", "2245", "2249", "2250"] as const;
const steering = ["6322", "6325", "2237", "2302", "2241", "2240", "2238", "6113", "6114", "6323", "6115", "6326", "6327", "2129"] as const;
const selected = new Set<string>([...braking, ...steering]);
const keyFor = (reference: string): string => braking.some((entry) => entry === reference)
  ? "Frenado regenerativo" : "Dirección asistida";
const getRecord = (reference: string): ProductRecord => {
  const found = catalog.products.find((record) => record.reference === reference);
  assert.ok(found, reference);
  return found;
};

test("recupera prestaciones explícitas sin alterar el original", () => {
  const changed: string[] = [];
  for (const record of catalog.products) {
    const reference = record.reference ?? "";
    const snapshot = structuredClone(record);
    const enriched = recoverGamVerifiedSteeringBraking(record);
    assert.deepEqual(record, snapshot, reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(enriched[key], value, `${record.reference}: ${key}`);
    }
    const added = Object.keys(enriched).filter((key) => !Object.hasOwn(record.specs ?? {}, key));
    if (!added.length) continue;
    assert.equal(added.length, 1, reference);
    assert.ok(selected.has(reference), reference);
    assert.equal(added[0], keyFor(reference));
    assert.equal(enriched[added[0] ?? ""], true);
    changed.push(reference);
  }
  assert.equal(changed.length, selected.size);
  assert.deepEqual(new Set(changed), selected);
});

test("conserva las prestaciones en la preparación y normalización", () => {
  for (const reference of selected) {
    const result = prepareSourceProduct(getRecord(reference));
    const key = keyFor(reference);
    const normalized = normalizeSpecsObject(result.product.spec);
    assert.equal(result.product.spec[key], true, reference);
    assert.equal(normalized.normalized[key], true, reference);
    assert.ok(!normalized.unknownKeys.includes(key), reference);
  }
});

test("protege procedencia, identidad, condición, descripción y especificaciones previas", () => {
  for (const reference of selected) {
    const record = getRecord(reference);
    const key = keyFor(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: "0000" },
      { ...record, brand: "OTRA" },
      { ...record, model: "OTRO" },
      { ...record, condition: "Segunda mano" },
      { ...record, categoryKey: "otra-categoria" },
      { ...record, url: `${record.url}?variante=2` },
      { ...record, title: "Otra máquina" },
      { ...record, shortDescription: "Otra máquina" },
      { ...record, longDescription: "Otra máquina" },
      { ...record, specs: { ...record.specs, [key]: false } },
      { ...record, specs: { ...record.specs, [key.toLocaleLowerCase("es")]: false } }
    ];
    for (const variant of variants) {
      assert.deepEqual(recoverGamVerifiedSteeringBraking(variant), variant.specs ?? {}, reference);
    }
    const withoutEvidence = record.longDescription?.replace(
      /\bfrenad[oa] regenerativ[oa]\b|\bdirecci[oó]n asistida\b/giu,
      "prestación no documentada"
    ) ?? null;
    assert.deepEqual(recoverGamVerifiedSteeringBraking({ ...record, longDescription: withoutEvidence }), record.specs ?? {}, reference);
  }
});
