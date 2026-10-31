import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamHysterForkliftTyresSpec } from "../evidence/providers/gam/non-marking-tyres-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const macizos = new Set(["2018", "2026", "2027"]);
const references = [
  "2030", "2018", "2031", "2032", "2036", "2033", "2034", "2035", "2026",
  "30", "2027", "2039", "2029", "2010", "2013", "4625", "2014", "4626"
] as const;

const recordOf = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera neumáticos acreditados de dieciocho carretillas eléctricas Hyster sin modificar la fuente", () => {
  for (const reference of references) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const result = prepareSourceProduct(record);
    const expected = macizos.has(reference) ? "Macizos" : "Superelásticos";
    assert.equal(result.product.spec["Neumáticos"], expected, reference);
    const normalized = normalizeSpecsObject(result.product.spec);
    assert.equal(normalized.normalized["Neumáticos"], expected, reference);
    assert.ok(!normalized.unknownKeys.includes("Neumáticos"), reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(result.product.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original, reference);
  }
});

test("rechaza identidades cruzadas, origen manipulado, medidas previas y neumáticos alternativos", () => {
  const record = recordOf("2030");
  const source = record.specs ?? {};
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" },
    { ...record, categoryKey: "elevacion-nueva" },
    { ...record, brand: "YALE" },
    { ...record, model: "J1.8UT" },
    { ...record, title: "Carretilla Hyster J1.8UT" },
    { ...record, reference: "9999" },
    { ...record, url: `${record.url}?modelo=otro` },
    { ...record, url: `${record.url}#ficha` },
    { ...record, url: record.url.replace("electricas-hyster", "diesel-hyster") },
    { ...record, specs: { ...source, Marca: "YALE" } },
    { ...record, specs: { ...source, Neumáticos: "Macizos" } },
    { ...record, specs: { ...source, Ruedas: "Superelásticas" } },
    { ...record, longDescription: "Hyster J1.5UT utiliza ruedas macizas y ruedas superelásticas." },
    { ...record, longDescription: "Hyster J1.5UT ofrece ruedas macizas o superelásticas." },
    { ...record, longDescription: "Hyster J1.5UT ofrece ruedas superelásticas opcionales." },
    { ...record, longDescription: "Hyster J1.5UT dispone de ruedas superelásticas o macizas." },
    { ...record, longDescription: "Hyster J1.5UT sin ruedas superelásticas." },
    { ...record, longDescription: "Hyster J1.5UT usa neumáticos convencionales." }
  ];
  for (const variant of variants) {
    assert.deepEqual(recoverGamHysterForkliftTyresSpec(variant), variant.specs ?? {});
  }
});

test("solo incorpora los dieciocho valores observados y no altera Gomariz ni otros modelos GAM", () => {
  const changed = gam.products.filter((record) =>
    Object.keys(recoverGamHysterForkliftTyresSpec(record)).length > Object.keys(record.specs ?? {}).length
  ).map((record) => record.reference);
  assert.equal(changed.length, references.length);
  assert.deepEqual(new Set(changed), new Set(references));
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamHysterForkliftTyresSpec(record), record.specs ?? {});
  }
});
