import { reconcileGamHorometer } from "../../reconciliation/gam-horometer.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverGamSourceStabilization } from "../../evidence/operations-and-safety/source-stabilization-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const sourceOf = (reference: string): ProductRecord => {
  const record = catalog.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera solo los sistemas de estabilización declarados para la variante identificada", () => {
  for (const [reference, leveling, stabilizers] of [
    ["6389", true, false],
    ["4655", true, true],
    ["6167", false, true]
  ] as const) {
    const source = sourceOf(reference);
    const original = structuredClone(source);
    const result = prepareSourceProduct(source);
    assert.equal(result.status, "ready", reference);
    assert.equal(result.product.spec["Nivelación automática"], leveling || undefined, reference);
    assert.equal(result.product.spec["Estabilizadores hidráulicos"], stabilizers || undefined, reference);
    for (const [key, value] of Object.entries(source.specs ?? {})) {
      const expected = key === "Horómetro" ? reconcileGamHorometer(source).specs?.[key] :
        key === "Dimensiones Cesta" && reference === "6167" ? "1,4 x 0,7 x 1,1 m" : value;
      assert.deepEqual(result.product.spec[key], expected, `${reference}: ${key}`);
    }
    assert.deepEqual(source, original);
  }
});

test("descarta referencias y variantes cruzadas sin completar especificaciones ajenas", () => {
  const source = sourceOf("4655");
  const specs = source.specs ?? {};
  const variants: ProductRecord[] = [
    { ...source, providerId: "mercaeleva" },
    { ...source, reference: "9999" },
    { ...source, brand: "OTRA" },
    { ...source, model: "TRACCESS 180" },
    { ...source, specs: { ...specs, Modelo: "TRACCESS 180" } },
    { ...source, url: `${source.url}?variante=otra` },
    { ...source, url: source.url.replace("traccess-135", "traccess-180") },
    { ...source, categoryKey: "carretillas-nuevas" },
    { ...source, longDescription: "Nivelación automática y estabilizadores hidráulicos." }
  ];
  for (const variant of variants) {
    assert.deepEqual(recoverGamSourceStabilization(variant, specs), specs);
  }
  assert.deepEqual(recoverGamSourceStabilization(sourceOf("6573"), sourceOf("6573").specs ?? {}), sourceOf("6573").specs ?? {});
});

test("no afirma equipos opcionales, negados ni sobrescribe especificaciones existentes", () => {
  const source = sourceOf("4655");
  const specs = source.specs ?? {};
  const description = source.longDescription ?? "";
  for (const [from, to, key] of [
    ["nivelación hidráulica automática", "nivelación hidráulica automática opcional", "Nivelación automática"],
    ["nivelación hidráulica automática", "sin nivelación hidráulica automática", "Nivelación automática"],
    ["estabilizadores hidráulicos", "estabilizadores hidráulicos opcionales", "Estabilizadores hidráulicos"],
    ["estabilizadores hidráulicos", "sin estabilizadores hidráulicos", "Estabilizadores hidráulicos"]
  ] as const) {
    assert.match(description, new RegExp(from, "iu"));
    const altered = { ...source, longDescription: description.replace(new RegExp(from, "iu"), to) };
    assert.equal(recoverGamSourceStabilization(altered, specs)[key], undefined, to);
  }
  for (const key of ["Nivelación automática", "Estabilizadores hidráulicos"] as const) {
    assert.equal(recoverGamSourceStabilization(source, { ...specs, [key]: false })[key], false);
    assert.equal(recoverGamSourceStabilization({ ...source, longDescription: `${description} Sin ${key.toLowerCase()}.` }, specs)[key], undefined);
  }
});
