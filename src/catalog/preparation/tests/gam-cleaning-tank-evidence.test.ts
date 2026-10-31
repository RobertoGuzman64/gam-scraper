import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamCleaningTankSpecs } from "../evidence/providers/gam/cleaning-tank-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const solutionKey = "Depósito de solución";
const recoveryKey = "Depósito de recuperación";

const recordOf = (reference: string) => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM recupera las capacidades diferenciadas en litros de su propio texto", () => {
  for (const [reference, solution, recovery] of [
    ["4019", 480, 346],
    ["4022", 410, 360],
    ["3996", 15, 16.5],
    ["3999", 50, 50],
    ["6149", 70, 75],
    ["4005", 78.5, 80],
    ["4003", 121, 140],
    ["4009", 125, 135],
    ["5771", 218, 237],
    ["4015", 285, 346],
    ["4017", null, 360],
    ["4013", 280, null]
  ] as const) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[solutionKey], solution ?? undefined, reference);
    assert.equal(prepared.product.spec[recoveryKey], recovery ?? undefined, reference);
    const normalized = normalizeSpecsObject(prepared.product.spec);
    if (solution !== null) {
      assert.equal(normalized.normalized[solutionKey], solution, reference);
      assert.ok(!normalized.unknownKeys.includes(solutionKey));
    }
    if (recovery !== null) {
      assert.equal(normalized.normalized[recoveryKey], recovery, reference);
      assert.ok(!normalized.unknownKeys.includes(recoveryKey));
    }
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original);
  }
});

test("GAM rechaza fuentes incompatibles, medidas contradictorias y claves existentes", () => {
  const record = recordOf("4019");
  const longDescription = "La barredora fregadora TENNANT BF M17 D dispone de un depósito de solución de 480 litros y de recuperación de 346 litros.";
  for (const variant of [
    { ...record, providerId: "gomariz" },
    { ...record, categoryKey: "carretillas-nuevas" },
    { ...record, condition: "Segunda mano" as const },
    { ...record, model: "BF M17 C" },
    { ...record, reference: "4020" },
    { ...record, shortDescription: "TENNANT BF M17 C, equipo de limpieza industrial" },
    { ...record, specs: { ...record.specs, Modelo: "BF M17 C" } },
    { ...record, brand: "Otra" },
    { ...record, specs: { ...record.specs, Marca: "Otra" } },
    { ...record, url: "https://online.gamrentals.com/es/tennant/4019-bf-m17-c" },
    { ...record, specs: { ...record.specs, "Depósito de solución": 480 } },
    { ...record, specs: { ...record.specs, "Depósito de recuperación (l)": 346 } },
    { ...record, longDescription: "TENNANT BF M17 D: depósito de solución de 480 litros y depósito de solución de 490 litros, depósito de recuperación de 346 litros." },
    { ...record, longDescription: "TENNANT BF M17 D: depósito de solución de 480 litros y depósito de recuperación de 346 litros y depósito de recuperación de 360 litros." },
    { ...record, longDescription: "TENNANT BF M17 D: depósitos de solución y recuperación de 500 litros, depósito de solución de 480 litros." },
    { ...record, longDescription: "TENNANT BF M17 D: depósitos de solución y recuperación de 3000 litros." },
    { ...record, longDescription: longDescription }
  ]) {
    if (variant.longDescription === longDescription) {
      assert.deepEqual(recoverGamCleaningTankSpecs(variant), { ...variant.specs, [solutionKey]: 480 });
    } else {
      assert.deepEqual(recoverGamCleaningTankSpecs(variant), variant.specs);
    }
  }
  for (const reference of ["6148", "4018", "4021"]) {
    const excluded = recordOf(reference);
    assert.deepEqual(recoverGamCleaningTankSpecs(excluded), excluded.specs ?? {}, reference);
  }
});

test("solo las 25 fichas GAM con prueba atribuible reciben depósitos, sin arrastrar Gomariz", () => {
  const expected = [
    "4019", "4020", "4022", "3996", "3999", "6149", "4000", "4005", "4001", "4002",
    "5773", "4008", "4011", "4006", "4007", "4003", "4004", "4009", "4010", "5771",
    "4012", "4013", "4014", "4015", "4017"
  ];
  const changed = gam.products.flatMap((record) => {
    const source = record.specs ?? {};
    const enriched = recoverGamCleaningTankSpecs(record);
    const keys = Object.keys(enriched).filter((key) => !Object.hasOwn(source, key));
    return keys.length > 0 ? [{ reference: record.reference, keys }] : [];
  });
  assert.deepEqual(new Set(changed.map(({ reference }) => reference)), new Set(expected));
  assert.equal(changed.length, 25);
  assert.equal(changed.reduce((count, row) => count + row.keys.length, 0), 45);
  assert.ok(changed.every(({ keys }) => keys.every((key) => key === solutionKey || key === recoveryKey)));
  assert.ok(gomariz.products.every((record) =>
    JSON.stringify(recoverGamCleaningTankSpecs(record)) === JSON.stringify(record.specs ?? {})));
});
