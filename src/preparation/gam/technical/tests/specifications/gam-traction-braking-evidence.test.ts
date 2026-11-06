import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../catalog/normalization/normalize-specs.js";
import { recoverGamVerifiedTractionBraking } from "../../evidence/mobility/verified-traction-braking-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const fourWheel = ["4778", "4779", "4780", "4782", "4785", "4787", "4795", "4788", "4796", "4790", "4793", "4813", "4798"] as const;
const braking = ["2194", "2258", "2195", "2260", "2203", "2199", "2204", "2201"] as const;
const references = [...fourWheel, ...braking];
const keyFor = (reference: string): string => fourWheel.some((entry) => entry === reference) ? "Tracción 4x4" : "Frenado regenerativo";
const record = (reference: string): ProductRecord => {
  const found = catalog.products.find((item) => item.reference === reference);
  assert.ok(found, reference);
  return found;
};

test("añade una prestación acreditada a veintiuna fichas sin modificar originales", () => {
  const changed: string[] = [];
  for (const source of catalog.products) {
    const snapshot = structuredClone(source);
    const result = recoverGamVerifiedTractionBraking(source);
    assert.deepEqual(source, snapshot, String(source.reference));
    for (const [key, value] of Object.entries(source.specs ?? {})) {
      assert.deepEqual(result[key], value, `${source.reference}: ${key}`);
    }
    const added = Object.keys(result).filter((key) => !Object.hasOwn(source.specs ?? {}, key));
    if (added.length > 0) {
      assert.equal(added.length, 1, String(source.reference));
      assert.equal(added[0], keyFor(source.reference ?? ""));
      assert.equal(result[added[0] ?? ""], true);
      changed.push(String(source.reference));
    }
  }
  assert.deepEqual(new Set(changed), new Set(references));
  assert.equal(changed.length, 21);
});

test("las veintiuna prestaciones sobreviven al preparador y al normalizador", () => {
  for (const reference of references) {
    const prepared = prepareSourceProduct(record(reference));
    const normalized = normalizeSpecsObject(prepared.product.spec);
    const key = keyFor(reference);
    assert.equal(prepared.product.spec[key], true, reference);
    assert.equal(normalized.normalized[key], true, reference);
    assert.ok(!normalized.unknownKeys.includes(key), reference);
  }
});

test("bloquea referencias, variantes, proveedor, fuente y especificaciones existentes", () => {
  for (const reference of references) {
    const source = record(reference);
    const key = keyFor(reference);
    const variants: readonly ProductRecord[] = [
      { ...source, providerId: "gomariz" },
      { ...source, reference: "9999" },
      { ...source, brand: "OTRO" },
      { ...source, model: "OTRO" },
      { ...source, condition: "Segunda mano" },
      { ...source, categoryKey: "otra-categoria" },
      { ...source, url: `${source.url}?variante=distinta` },
      { ...source, title: "Modelo diferente" },
      { ...source, shortDescription: "Modelo diferente" },
      { ...source, longDescription: "Modelo diferente" },
      { ...source, specs: { ...source.specs, [key]: false } }
    ];
    for (const variant of variants) {
      assert.deepEqual(recoverGamVerifiedTractionBraking(variant), variant.specs ?? {}, `${reference}: variante no válida`);
    }
    const withoutEvidence = source.longDescription?.replace(
      /tracci[oó]n en las cuatro ruedas|tracci[oó]n integral|tracci[oó]n 4x4|sistema de frenado regenerativo/giu,
      "prestación no documentada"
    ) ?? null;
    assert.deepEqual(recoverGamVerifiedTractionBraking({ ...source, longDescription: withoutEvidence }), source.specs ?? {}, reference);
  }
});
