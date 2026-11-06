import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../catalog/normalization/normalize-specs.js";
import { recoverGamSweeperHopperCapacity } from "../operations/cleaning-tank-evidence.js";
import { recoverGamHysterForkliftTyresSpec, recoverGamNonMarkingTyresSpec, recoverGamVerifiedSuperelasticTyresSpec, recoverGamVerifiedTyreMaterialsSpec, recoverGamYaleSuperelasticTyresSpec } from "../mobility/non-marking-tyres-evidence.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reconcileGamSourceTechnicalUnits } from "../reconciliation/gam-source-technical-units.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");

const tyreExamples = [
  ["2074", "Superelásticos"], ["2068", "Radiales"],
  ["2019", "Bandaje macizo"], ["2021", "Bandaje macizo"],
  ["2023", "Bandaje macizo"], ["2025", "Bandaje macizo"],
  ["5891", "Superelásticos"], ["4623", "Poliuretano"],
  ["2105", "Poliuretano"], ["2108", "Poliuretano"],
  ["4622", "Poliuretano"]
] as const;
const hopperExamples = [
  ["4025", 70], ["4026", 67], ["4027", 67],
  ["4032", 310], ["4033", 395], ["4034", 850],
  ["6150", 135], ["4019", 85], ["4020", 85], ["4021", 110],
  ["4022", 198], ["4024", 80], ["4016", 20]
] as const;

const source = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera neumáticos y material rodante declarados sin alterar atributos originales", () => {
  for (const [reference, material] of tyreExamples) {
    const record = source(reference);
    const original = structuredClone(record);
    const recovered = recoverGamVerifiedTyreMaterialsSpec(record);
    const prepared = prepareSourceProduct(record).product;
    assert.equal(recovered.Neumáticos, material, reference);
    assert.equal(prepared.spec.Neumáticos, material, reference);
    assert.equal(normalizeSpecsObject(prepared.spec).normalized.Neumáticos, material, reference);
    for (const [key, value] of Object.entries(reconcileGamSourceTechnicalUnits(record).specs ?? {})) {
      assert.deepEqual(prepared.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original);
  }
});

test("recupera capacidades de tolva inequívocas y las conserva normalizadas", () => {
  for (const [reference, capacity] of hopperExamples) {
    const record = source(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record).product;
    assert.equal(recoverGamSweeperHopperCapacity(record)["Capacidad de la tolva"], capacity, reference);
    assert.equal(prepared.spec["Capacidad de la tolva"], capacity, reference);
    const normalized = normalizeSpecsObject(prepared.spec);
    assert.equal(normalized.normalized["Capacidad de la tolva"], capacity, reference);
    assert.ok(!normalized.unknownKeys.includes("Capacidad de la tolva"));
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original);
  }
});

test("rechaza referencias cruzadas, cambios de identidad, opciones y medidas contradictorias", () => {
  for (const reference of ["2074", "2023", "4623"]) {
    const record = source(reference);
    const changes: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, condition: "Segunda mano" },
      { ...record, reference: "99999" },
      { ...record, model: "OTRO" },
      { ...record, brand: "OTRA" },
      { ...record, categoryKey: "elevacion-nueva" },
      { ...record, title: "Modelo distinto" },
      { ...record, shortDescription: "Referencia distinta" },
      { ...record, url: `${record.url}?variante=otra` },
      { ...record, specs: { ...record.specs, Neumáticos: "Otro" } },
      { ...record, specs: { ...record.specs, Modelo: "OTRO" } },
      { ...record, longDescription: `${record.longDescription} Neumáticos radiales opcionales.` },
      { ...record, longDescription: `${record.longDescription} Ruedas alternativas de poliuretano.` },
      { ...record, longDescription: `${record.longDescription} No monta ruedas de poliuretano.` }
    ];
    for (const candidate of changes) {
      assert.deepEqual(recoverGamVerifiedTyreMaterialsSpec(candidate), candidate.specs ?? {}, reference);
    }
  }
  for (const reference of ["4025", "4032", "4034"]) {
    const record = source(reference);
    const changes: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, condition: "Segunda mano" },
      { ...record, reference: "99999" },
      { ...record, model: "BCS OTRO" },
      { ...record, brand: "OTRA" },
      { ...record, categoryKey: "otros-nuevos" },
      { ...record, url: `${record.url}?variante=otra` },
      { ...record, specs: { ...record.specs, "Capacidad de la tolva": 999 } },
      { ...record, longDescription: `${record.longDescription} Tolva de 888 litros.` }
    ];
    for (const candidate of changes) {
      assert.deepEqual(recoverGamSweeperHopperCapacity(candidate), candidate.specs ?? {}, reference);
    }
  }
});

test("no atribuye materiales de opciones o configuraciones contradichas", () => {
  for (const reference of ["8", "2076", "2087", "3130", "4734", "4736", "5988", "5995", "6324", "6574", "6990"]) {
    const record = source(reference);
    assert.deepEqual(recoverGamVerifiedTyreMaterialsSpec(record), record.specs ?? {}, reference);
  }
  for (const reference of ["4029", "4030", "4031"]) {
    const record = source(reference);
    assert.deepEqual(recoverGamSweeperHopperCapacity(record), record.specs ?? {}, reference);
  }
});

test("el enriquecimiento se limita a veinticuatro referencias GAM y excluye Gomariz", () => {
  const changes = gam.products.flatMap((record) => {
    const previousTyres = recoverGamVerifiedSuperelasticTyresSpec({
      ...record, specs: recoverGamYaleSuperelasticTyresSpec({
        ...record, specs: recoverGamHysterForkliftTyresSpec({
          ...record, specs: recoverGamNonMarkingTyresSpec(record)
        })
      })
    });
    const newTyres = recoverGamVerifiedTyreMaterialsSpec({ ...record, specs: previousTyres });
    const result = recoverGamSweeperHopperCapacity({ ...record, specs: newTyres });
    return Object.keys(result).length === Object.keys(previousTyres).length ? [] : [record.reference];
  });
  const expected = [...tyreExamples, ...hopperExamples].map(([reference]) => reference);
  assert.deepEqual(new Set(changes), new Set(expected));
  assert.equal(changes.length, 24);
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamSweeperHopperCapacity(record), record.specs ?? {});
    assert.deepEqual(recoverGamVerifiedTyreMaterialsSpec(record), record.specs ?? {});
  }
});
