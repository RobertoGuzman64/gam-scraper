import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamVerifiedOperationalSafety } from "../evidence/providers/gam/verified-operational-safety-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const overload = ["4730", "4803", "4805", "4804", "4799", "4785", "4787", "4795", "4788", "4796", "4808", "4809", "4810"];
const alarms = ["4735", "4740", "4742", "4746", "4807"];
const sensors = ["2155", "2159"];
const expected = new Map<string, string>([
  ...overload.map((reference): readonly [string, string] => [reference, "Protección contra sobrecarga"]),
  ...alarms.map((reference): readonly [string, string] => [reference, "Alarma de inclinación"]),
  ...sensors.map((reference): readonly [string, string] => [reference, "Sensor de inclinación"])
]);

const getRecord = (reference: string): ProductRecord => {
  const found = catalog.products.find((record) => record.reference === reference);
  assert.ok(found, reference);
  return found;
};

test("recupera veinte prestaciones de seguridad de fuentes individuales conservando las especificaciones anteriores", () => {
  const changed: string[] = [];
  for (const record of catalog.products) {
    const reference = record.reference ?? "";
    const snapshot = structuredClone(record);
    const recovered = recoverGamVerifiedOperationalSafety(record);
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

test("rechaza identidades, fuentes o condiciones distintas y nunca pisa valores anteriores", () => {
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
      { ...record, longDescription: `${record.brand} ${record.model} sin la prestación acreditada` },
      { ...record, specs: { ...record.specs, [key]: "Valor original" } },
      { ...record, specs: { ...record.specs, [key.toLocaleLowerCase("es")]: "Valor original" } }
    ];
    for (const variant of variants) {
      assert.deepEqual(recoverGamVerifiedOperationalSafety(variant), variant.specs ?? {}, reference);
    }
  }
});

test("conserva controles proporcionales anteriores en referencias con otra prestación acreditada", () => {
  for (const reference of ["4742", "4746", "4807"]) {
    const record = getRecord(reference);
    const prepared = prepareSourceProduct(record).product.spec;
    assert.equal(prepared["Controles proporcionales"], true, reference);
    assert.equal(prepared["Alarma de inclinación"], true, reference);
  }
});
