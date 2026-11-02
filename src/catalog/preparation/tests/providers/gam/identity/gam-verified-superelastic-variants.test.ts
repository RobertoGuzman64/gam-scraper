import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../normalization/normalize-specs.js";
import { recoverGamVerifiedSuperelasticTyresSpec } from "../../../../evidence/providers/gam/mobility/non-marking-tyres-evidence.js";
import { recoverGamPhysicalMeasures } from "../../../../evidence/providers/gam/measurements-and-capacities/physical-measures-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const references = [
  "2079", "2080", "2081", "2083", "2084", "2094", "6573",
  "2276", "2277", "2278", "2279", "2280", "2294"
] as const;

const recordOf = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera neumáticos declarados en variantes Hyster y Yale con identidad acreditada", () => {
  for (const reference of references) {
    const record = recordOf(reference);
    const snapshot = structuredClone(record);
    const prepared = prepareSourceProduct(record).product;
    assert.equal(recoverGamVerifiedSuperelasticTyresSpec(record)["Neumáticos"], "Superelásticos", reference);
    assert.equal(prepared.spec["Neumáticos"], "Superelásticos", reference);
    const normalized = normalizeSpecsObject(prepared.spec);
    assert.equal(normalized.normalized["Neumáticos"], "Superelásticos", reference);
    assert.ok(!normalized.unknownKeys.includes("Neumáticos"));
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, snapshot);
  }
});

test("rechaza cambios de modelo, fuente, variante, ruedas alternativas o datos previos", () => {
  for (const reference of ["2079", "2276", "6573"]) {
    const record = recordOf(reference);
    const original = record.specs ?? {};
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, condition: "Segunda mano" },
      { ...record, categoryKey: "otros-nuevos" },
      { ...record, brand: "Otra" },
      { ...record, model: "OTRO" },
      { ...record, reference: "9999" },
      { ...record, title: "Modelo diferente" },
      { ...record, shortDescription: "Otra referencia" },
      { ...record, url: `${record.url}?variante=otra` },
      { ...record, url: record.url.replace(`${record.reference}-`, "9999-") },
      { ...record, specs: { ...original, Marca: "Otra" } },
      { ...record, specs: { ...original, Modelo: "Otro" } },
      { ...record, specs: { ...original, Neumáticos: "Radiales" } },
      { ...record, longDescription: `${record.longDescription} También ofrece neumáticos radiales.` },
      { ...record, longDescription: `${record.longDescription} Ruedas superelásticas opcionales.` },
      { ...record, longDescription: `${record.longDescription} No monta neumáticos superelásticos.` }
    ];
    for (const variant of variants) {
      assert.deepEqual(recoverGamVerifiedSuperelasticTyresSpec(variant), variant.specs ?? {}, `${reference}: variante`);
    }
  }
  for (const reference of ["8", "2074", "2076", "2087", "3130", "6574", "5988", "5992", "6324"]) {
    const record = recordOf(reference);
    assert.deepEqual(recoverGamVerifiedSuperelasticTyresSpec(record), record.specs ?? {}, reference);
  }
});

test("descarta pesos de versiones diferentes sin perder la barredora de descarga baja", () => {
  const record = recordOf("4030");
  const source = record.specs ?? {};
  assert.equal(recoverGamPhysicalMeasures(record)["Peso"], "880 kg");
  for (const variant of [
    { ...record, model: "BCS S16H Descarga alto" },
    { ...record, shortDescription: "BCS S16H de descarga alta" },
    { ...record, longDescription: `${record.longDescription} Peso de 990 kg.` },
    { ...record, url: record.url.replace("4030-", "4029-") },
    { ...record, specs: { ...source, Peso: "900 kg" } },
    { ...record, providerId: "gomariz" as const }
  ]) {
    const outcome = recoverGamPhysicalMeasures(variant);
    assert.deepEqual(outcome, variant.specs ?? {});
  }
});

test("el resolutor conserva ajenos y solo cambia la cohorte documentada", () => {
  const changed = gam.products.filter((record) =>
    Object.keys(recoverGamVerifiedSuperelasticTyresSpec(record)).length > Object.keys(record.specs ?? {}).length
  ).map((record) => record.reference);
  assert.deepEqual(new Set(changed), new Set(references));
  assert.equal(changed.length, references.length);
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamVerifiedSuperelasticTyresSpec(record), record.specs ?? {});
    assert.deepEqual(recoverGamPhysicalMeasures(record), record.specs ?? {});
  }
});
