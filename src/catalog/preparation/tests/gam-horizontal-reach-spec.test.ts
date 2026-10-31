import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { recoverGamExplicitHorizontalReachSpec } from "../evidence/providers/gam/reach-evidence.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const recordOf = (reference: string) => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("extrae alcance horizontal medido y de la variante identificada sin modificar el canónico", () => {
  for (const [reference, expected] of [["4766", 8.6], ["4778", 8.22], ["4794", 13.2], ["6767", 12.3]] as const) {
    const record = recordOf(reference);
    const before = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    const value = prepared.product.spec["Alcance horizontal (m)"];
    if (typeof value !== "string") assert.fail(`${reference}: alcance no representado como medida`);
    assert.equal(Number(value.slice(0, -2).replace(",", ".")), expected, reference);
    assert.equal(normalizeSpecsObject({ "Alcance horizontal (m)": value }).normalized["Alcance horizontal (m)"], expected);
    for (const [key, original] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], original, `${reference}: ${key}`);
    }
    assert.deepEqual(record, before);
  }
});

test("no recupera alcances ambiguos, no corroborados o ya representados", () => {
  const record = recordOf("4766");
  const original = record.specs ?? {};
  for (const variant of [
    { ...record, providerId: "gomariz" },
    { ...record, categoryKey: "elevacion" },
    { ...record, model: "otro-modelo" },
    { ...record, specs: { ...original, "Alcance lateral": "9 m" } },
    { ...record, specs: { ...original, "Alcance horizontal": "8,6 m" } },
    { ...record, longDescription: "XCMG XGA16ACK1 tiene alcance horizontal de 8,6 m y alcance horizontal de 9 m." },
    { ...record, longDescription: "XCMG XGA16ACK1 tiene alcance lateral de 8,6 m." },
    { ...record, longDescription: "XCMG XGA16ACK1 tiene alcance horizontal de 8,6 m o 9 m." }
  ]) assert.deepEqual(recoverGamExplicitHorizontalReachSpec(variant), variant.specs);
});

test("detecta exclusivamente las fichas GAM que reciben alcance acreditado", () => {
  const recovered = gam.products.filter((record) =>
    Object.hasOwn(recoverGamExplicitHorizontalReachSpec(record), "Alcance horizontal (m)") &&
    !Object.hasOwn(record.specs ?? {}, "Alcance horizontal (m)"));
  assert.equal(recovered.length, 22);
  assert.equal(new Set(recovered.map((record) => record.reference)).size, 22);
});
