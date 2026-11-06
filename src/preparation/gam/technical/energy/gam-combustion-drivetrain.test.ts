import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../catalog/normalization/normalize-specs.js";
import { recoverGamVerifiedCombustionDriveSpecs } from "./motor-configuration-evidence.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const product = (reference: string) => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const options = "DuraMatch (1 o 2 velocidades, según configuración)";

const expected: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = [
  ["2085", { "Par motor (Nm)": "308 Nm", "Transmisión": options }],
  ["2086", { "Par motor (Nm)": "308 Nm", "Transmisión": options }],
  ["2087", { "Potencia (kW)": "55 kW", "Transmisión": options }],
  ["2088", { "Par motor (Nm)": "308 Nm", "Transmisión": options }],
  ["2089", { "Transmisión": options }],
  ["2090", { "Potencia (kW)": "55 kW", "Par motor (Nm)": "308 Nm", "Transmisión": options }],
  ["2094", { "Transmisión": options }],
  ["2096", { "Transmisión": "DuraMatch (3 velocidades)" }],
  ["6272", { "Transmisión": "ZF 3WG161 (3 velocidades adelante/atrás)" }]
];

test("conserva originales y recupera únicamente motor y transmisión acreditados", () => {
  assert.equal(expected.length, 9);
  for (const [reference, recovered] of expected) {
    const record = product(reference);
    const copy = structuredClone(record);
    const prepared = prepareSourceProduct(record).product;
    const normalized = normalizeSpecsObject(prepared.spec);
    for (const [key, value] of Object.entries(recovered)) {
      assert.equal(prepared.spec[key], value, `${reference}: ${key}`);
      assert.ok(!normalized.unknownKeys.includes(key), `${reference}: ${key}`);
    }
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, copy, reference);
  }
  assert.equal(prepareSourceProduct(product("2094")).product.spec["Potencia (kW)"], undefined);
});

test("rechaza identidad, combustible, motorización y valores ya fijados que no concuerden", () => {
  for (const reference of ["2087", "2090", "2096", "6272"]) {
    const record = product(reference);
    const invalid = [
      { ...record, providerId: "gomariz" },
      { ...record, condition: "Segunda mano" as const },
      { ...record, brand: "YALE" },
      { ...record, model: "OTRO" },
      { ...record, reference: "999999" },
      { ...record, url: record.url.replace(`${reference}-`, "999999-") },
      { ...record, title: "Ficha de otro equipo" },
      { ...record, specs: { ...record.specs, Marca: "YALE" } },
      { ...record, specs: { ...record.specs, "Motorización": "GLP", "Tipo motor": "GLP" } },
      { ...record, specs: { ...record.specs, "Transmisión": "Transmisión original" } }
    ];
    for (const variant of invalid) {
      assert.deepEqual(recoverGamVerifiedCombustionDriveSpecs(variant), variant.specs ?? {}, `${reference}: rechazo`);
    }
  }
  const kubota = product("2090");
  for (const variant of [
    { ...kubota, specs: { ...kubota.specs, "Potencia (kW)": "82 kW" } },
    { ...kubota, specs: { ...kubota.specs, "Tipo motor": "Kubota 3.8L LPG" } },
    { ...kubota, longDescription: `${kubota.longDescription} Otro motor de 82 kW.` },
    { ...kubota, longDescription: `${kubota.longDescription} Motor Kubota 3.8L GLP.` },
    { ...kubota, longDescription: `${kubota.longDescription} Otra transmisión ZF.` }
  ]) {
    assert.deepEqual(recoverGamVerifiedCombustionDriveSpecs(variant), variant.specs ?? {});
  }
});

test("bloquea familias de motor cruzadas, potencias opcionales y otros proveedores", () => {
  for (const reference of ["2073", "2074", "2075", "2076", "2079", "2082", "2041", "2042", "2092", "2093"]) {
    const record = product(reference);
    assert.deepEqual(recoverGamVerifiedCombustionDriveSpecs(record), record.specs ?? {}, reference);
  }
  assert.ok(gomariz.products.every((record) =>
    JSON.stringify(recoverGamVerifiedCombustionDriveSpecs(record)) === JSON.stringify(record.specs ?? {})));
});
