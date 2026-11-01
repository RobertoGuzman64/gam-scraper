import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamScrubbingPressureSpec } from "../evidence/providers/gam/scrubbing-pressure-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const key = "Presión máxima de fregado (kg)";
const expected = [
  ["3996", 25], ["3999", 19], ["4000", 35.4], ["4005", 22],
  ["4001", 54.5], ["4002", 54.5], ["5773", 50], ["4008", 60],
  ["4011", 114], ["4006", 73], ["4007", 73], ["4003", 90],
  ["4004", 90], ["4009", 100], ["4010", 114], ["4012", 116],
  ["4016", 250], ["4017", 181]
] as const;

const recordOf = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera presiones máximas por configuración sin perder atributos previos", () => {
  for (const [reference, pressure] of expected) {
    const record = recordOf(reference);
    const snapshot = structuredClone(record);
    const prepared = prepareSourceProduct(record).product;
    assert.equal(prepared.spec[key], pressure, reference);
    const normalized = normalizeSpecsObject(prepared.spec);
    assert.equal(normalized.normalized[key], pressure, reference);
    assert.ok(!normalized.unknownKeys.includes(key), reference);
    for (const [name, original] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.spec[name], original, `${reference}: ${name}`);
    }
    assert.deepEqual(record, snapshot, reference);
  }
});

test("excluye cabezales ambiguos y referencias con identidad contradictoria", () => {
  for (const reference of ["4013", "4014", "4015", "4018", "6148", "5771", "4028"]) {
    const record = recordOf(reference);
    assert.deepEqual(recoverGamScrubbingPressureSpec(record), record.specs ?? {}, reference);
  }
});

test("rechaza mutaciones de identidad, origen, condiciones y presiones contradictorias", () => {
  const base = recordOf("4009");
  const variants: readonly ProductRecord[] = [
    { ...base, providerId: "gomariz" },
    { ...base, condition: "Segunda mano" },
    { ...base, categoryKey: "limpieza-barredoras" },
    { ...base, reference: "4010" },
    { ...base, model: "FCS T981 C90" },
    { ...base, brand: "Otra" },
    { ...base, title: "Fregadora TENNANT FCS T981 C90" },
    { ...base, url: `${base.url}?opcion=otra` },
    { ...base, specs: { ...base.specs, "Presión del cepillo": 88 } },
    { ...base, longDescription: `${base.longDescription ?? ""} La presión descendente ajustable de hasta 80 kg.` }
  ];
  for (const variant of variants) {
    assert.deepEqual(recoverGamScrubbingPressureSpec(variant), variant.specs ?? {});
  }

  const tiered = recordOf("4003");
  assert.deepEqual(recoverGamScrubbingPressureSpec({
    ...tiered,
    longDescription: `${tiered.longDescription ?? ""} La presión descendente de hasta 97 kg.`
  }), tiered.specs ?? {});
  const dual = recordOf("4017");
  assert.deepEqual(recoverGamScrubbingPressureSpec({
    ...dual,
    longDescription: `${dual.longDescription ?? ""} Presión descendente de hasta 190 kg.`
  }), dual.specs ?? {});
});

test("se limita al lote acreditado y no modifica el proveedor Gomariz", () => {
  const changed = gam.products.flatMap((record) => Object.hasOwn(recoverGamScrubbingPressureSpec(record), key)
    && !Object.hasOwn(record.specs ?? {}, key) ? [record.reference] : []);
  assert.deepEqual(new Set(changed), new Set(expected.map(([reference]) => reference)));
  assert.equal(changed.length, expected.length);
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamScrubbingPressureSpec(record), record.specs ?? {});
  }
});
