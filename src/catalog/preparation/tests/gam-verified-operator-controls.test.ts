import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamVerifiedOperatorControls } from "../evidence/providers/gam/verified-operator-controls-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const proportional = ["4738", "4742", "4800", "4746", "6963", "4762", "4772", "4777", "4776", "5900", "4791", "6767", "6768", "4807", "5903"];
const operatorPresence = ["4626", "5998", "5999", "6000", "6001"];
const expected = new Map([
  ...proportional.map((reference) => [reference, "Controles proporcionales"] as const),
  ...operatorPresence.map((reference) => [reference, "Sistema de presencia del operador"] as const)
]);

const getRecord = (reference: string): ProductRecord => {
  const found = catalog.products.find((record) => record.reference === reference);
  assert.ok(found, reference);
  return found;
};

test("recupera prestaciones de mando y presencia acreditadas y normalizables", () => {
  const changed: string[] = [];
  for (const record of catalog.products) {
    const reference = record.reference ?? "";
    const snapshot = structuredClone(record);
    const recovered = recoverGamVerifiedOperatorControls(record);
    assert.deepEqual(record, snapshot, reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) assert.deepEqual(recovered[key], value, reference);
    const additions = Object.keys(recovered).filter((key) => !Object.hasOwn(record.specs ?? {}, key));
    if (!additions.length) continue;
    const key = expected.get(reference);
    assert.ok(key, reference);
    assert.deepEqual(additions, [key], reference);
    assert.equal(recovered[key], true, reference);
    const prepared = prepareSourceProduct(record).product.spec;
    assert.equal(prepared[key], true, reference);
    const normalized = normalizeSpecsObject(prepared);
    assert.equal(normalized.normalized[key], true, reference);
    assert.ok(!normalized.unknownKeys.includes(key), reference);
    changed.push(reference);
  }
  assert.equal(changed.length, 20);
  assert.deepEqual(new Set(changed), new Set(expected.keys()));
});

test("respeta procedencia, modelo, variantes, condición y valores existentes", () => {
  for (const [reference, key] of expected) {
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
      { ...record, longDescription: `${record.brand} ${record.model} sin esa prestación acreditada` },
      { ...record, specs: { ...record.specs, [key]: "Valor original" } },
      { ...record, specs: { ...record.specs, [key.toLocaleLowerCase("es")]: "Valor original" } }
    ];
    for (const variant of variants) {
      assert.deepEqual(recoverGamVerifiedOperatorControls(variant), variant.specs ?? {}, reference);
    }
  }
});
