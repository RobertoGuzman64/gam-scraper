import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamExplicitHorizontalReachSpec } from "../evidence/providers/gam/reach-evidence.js";
import { recoverGamNonMarkingTyresSpec } from "../evidence/providers/gam/non-marking-tyres-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const lateralReach = [
  ["6172", 9.5], ["4660", 8.2], ["4717", 8.2],
  ["4725", 11], ["4662", 12], ["4651", 15.5]
] as const;
const nonMarking = ["4731", "4733", "4735", "4740", "4744", "4746", "4772", "4808", "4809", "4810", "4743"] as const;

const recordOf = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera seis alcances laterales CTE como alcance horizontal normalizado", () => {
  for (const [reference, value] of lateralReach) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    const normalized = normalizeSpecsObject(prepared.product.spec);
    assert.equal(normalized.normalized["Alcance horizontal (m)"], value, reference);
    assert.ok(!normalized.unknownKeys.includes("Alcance horizontal (m)"));
    for (const [key, previousValue] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], previousValue, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original, reference);
  }
});

test("recupera neumáticos no marcantes XCMG acreditados", () => {
  for (const reference of nonMarking) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Neumáticos"], "No marcantes", reference);
    const normalized = normalizeSpecsObject(prepared.product.spec);
    assert.equal(normalized.normalized["Neumáticos"], "No marcantes", reference);
    assert.ok(!normalized.unknownKeys.includes("Neumáticos"));
    for (const [key, previousValue] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], previousValue, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original, reference);
  }
});

test("alcance CTE excluye capacidades contradictorias, identidades ajenas y mediciones alternativas", () => {
  const record = recordOf("4662");
  const source = record.specs ?? {};
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" },
    { ...record, categoryKey: "elevacion" },
    { ...record, model: "ZED 21.3 JHV" },
    { ...record, brand: "XCMG" },
    { ...record, reference: "9999" },
    { ...record, shortDescription: "CTE ZED 21.3 JHV. Capacidad de la cesta 250 kg" },
    { ...record, shortDescription: "CTE ZED 25 HV. Capacidad de la cesta 350 kg" },
    { ...record, url: `${record.url}?variant=otra` },
    { ...record, url: record.url.replace("4662-", "4663-") },
    { ...record, specs: { ...source, "Alcance lateral": "12 m" } },
    { ...record, longDescription: `${record.longDescription} Alcance lateral de 14 m.` },
    { ...record, longDescription: `${record.longDescription} Alcance horizontal de 14 m.` },
    { ...record, longDescription: (record.longDescription ?? "").replace("alcance lateral de 12 m", "alcance lateral de 12 m o 14 m") }
  ];
  for (const variant of variants) {
    assert.deepEqual(recoverGamExplicitHorizontalReachSpec(variant), variant.specs ?? {});
  }
  for (const reference of ["6170", "5899", "6728", "6308", "4650", "4844", "4845", "4846", "4847"]) {
    const excluded = recordOf(reference);
    assert.deepEqual(recoverGamExplicitHorizontalReachSpec(excluded), excluded.specs ?? {}, reference);
  }
});

test("neumáticos XCMG excluye variantes cruzadas, orugas, negaciones y valores ya existentes", () => {
  const record = recordOf("4733");
  const source = record.specs ?? {};
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" },
    { ...record, categoryKey: "carretillas-nuevas" },
    { ...record, brand: "CTE" },
    { ...record, model: "XG0807ACW" },
    { ...record, title: "Plataforma XCMG XG0807ACW" },
    { ...record, reference: "9999" },
    { ...record, url: `${record.url}#otra` },
    { ...record, title: `${record.title} sobre orugas` },
    { ...record, specs: { ...source, "Neumáticos": "Macizos" } },
    { ...record, specs: { ...source, "Ruedas": "No marcantes" } },
    { ...record, longDescription: "La XCMG XG0807AC tiene ruedas marcantes." },
    { ...record, longDescription: `${record.longDescription} También dispone de ruedas marcantes.` },
    { ...record, longDescription: "La XCMG XG0807AC no incluye ruedas no marcantes." }
  ];
  for (const variant of variants) {
    assert.deepEqual(recoverGamNonMarkingTyresSpec(variant), variant.specs ?? {});
  }
  for (const reference of ["4730", "4734", "4736", "4737"]) {
    const excluded = recordOf(reference);
    assert.deepEqual(recoverGamNonMarkingTyresSpec(excluded), excluded.specs ?? {}, reference);
  }
  const lithium = recordOf("4743");
  const sourceLithium = lithium.specs ?? {};
  for (const variant of [
    { ...lithium, model: "XG1212AC" },
    { ...lithium, shortDescription: "XCMG XXG1212AC-LI" },
    { ...lithium, title: "XCMG XG1212AC con batería de plomo" },
    { ...lithium, specs: { ...sourceLithium, Modelo: "XG1212AC" } },
    { ...lithium, url: lithium.url.replace("4743-", "4734-") },
    { ...lithium, longDescription: `${lithium.longDescription} También hay ruedas marcantes.` }
  ]) {
    assert.deepEqual(recoverGamNonMarkingTyresSpec(variant), variant.specs ?? {});
  }
});

test("la cohorte se limita a las fichas acreditadas sin afectar a Gomariz", () => {
  const wantedReach: ReadonlySet<string> = new Set(lateralReach.map(([reference]) => reference));
  const wantedTyres = new Set(nonMarking);
  const reached = gam.products.filter((record) => Object.keys(recoverGamExplicitHorizontalReachSpec(record))
    .length > Object.keys(record.specs ?? {}).length && record.reference !== null && wantedReach.has(record.reference));
  assert.equal(reached.length, wantedReach.size);
  const newTyres = gam.products.filter((record) => Object.keys(recoverGamNonMarkingTyresSpec(record))
    .length > Object.keys(record.specs ?? {}).length).map((record) => record.reference);
  assert.deepEqual(new Set(newTyres), wantedTyres);
  assert.equal(newTyres.length, nonMarking.length);
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamExplicitHorizontalReachSpec(record), record.specs ?? {});
    assert.deepEqual(recoverGamNonMarkingTyresSpec(record), record.specs ?? {});
  }
});
