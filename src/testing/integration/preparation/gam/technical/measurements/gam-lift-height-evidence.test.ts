import { accreditedSourceSamples } from "../../../../../domain-cases/accredited-source-samples.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../../catalog/normalization/normalize-specs.js";
import { recoverGamMaximumLiftHeightSpec } from "../../../../../../preparation/gam/technical/measurements/lift-height-evidence.js";
import { prepareSourceProduct } from "../../../../../../preparation/prepare-product.js";

const gam = { products: accreditedSourceSamples("gam-original") };
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const key = "Altura de elevación (mm)";
const expected = [
  ["4624", 6000], ["2194", 3500], ["2196", 3500], ["2258", 3500],
  ["2195", 3500], ["2197", 3500], ["2260", 3500], ["2203", 3500],
  ["2198", 3500], ["2199", 3500], ["2204", 3500], ["2200", 3500],
  ["2201", 3500], ["2335", 3500], ["2205", 3500], ["2206", 5400],
  ["6991", 200], ["6980", 8000], ["6582", 1700], ["6743", 120], ["6990", 115]
] as const;

const recordOf = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera alturas máximas de elevación acreditadas sin confundir la altura del equipo", () => {
  for (const [reference, height] of expected) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[key], `${height} mm`, reference);
    assert.equal(normalizeSpecsObject(prepared.product.spec).normalized[key], height, reference);
    for (const [sourceKey, sourceValue] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[sourceKey], sourceValue, `${reference}: ${sourceKey}`);
    }
    assert.deepEqual(record, original, reference);
  }
  assert.equal(prepareSourceProduct(recordOf("2194")).product.spec["Altura"], "1750 mm");
});

test("descarta cambios de identidad, origen, categoría, estado y especificaciones existentes", () => {
  const record = recordOf("2194");
  const source = record.specs ?? {};
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" },
    { ...record, categoryKey: "carretillas-nuevas" },
    { ...record, brand: "HYSTER" },
    { ...record, model: "MS12E" },
    { ...record, title: "Apilador Yale MS12E" },
    { ...record, reference: "2195" },
    { ...record, specs: { ...source, Marca: "HYSTER" } },
    { ...record, specs: { ...source, Modelo: "MS12E" } },
    { ...record, specs: { ...source, "Altura de elevación (mm)": "3600 mm" } },
    { ...record, specs: { ...source, "Altura máxima de elevación": "3.5 m" } },
    { ...record, url: `${record.url}?variante=1` },
    { ...record, url: `${record.url}#modelo` },
    { ...record, url: record.url.replace("2194-", "2195-") }
  ];
  for (const variant of variants) assert.deepEqual(recoverGamMaximumLiftHeightSpec(variant), variant.specs ?? {});
});

test("descarta medidas contradictorias, ambiguas o fuera de rango", () => {
  const record = recordOf("2194");
  for (const description of [
    `${record.longDescription} Altura máxima de elevación de 4.5 metros.`,
    (record.longDescription ?? "").replace("3.5 metros", "35 metros"),
    (record.longDescription ?? "").replace("3.5 metros", "3.5 mm"),
    (record.longDescription ?? "").replace("3.5 metros", "3.500 mm"),
    (record.longDescription ?? "").replace("altura máxima de elevación", "altura del equipo")
  ]) {
    const changed = { ...record, longDescription: description };
    if (description.includes("3.500 mm")) {
      assert.equal(recoverGamMaximumLiftHeightSpec(changed)[key], "3500 mm");
    } else {
      assert.deepEqual(recoverGamMaximumLiftHeightSpec(changed), changed.specs ?? {});
    }
  }
});

test("respeta la identidad y las alturas originales en usados y equipos de baja elevación", () => {
  for (const reference of ["6582", "6743", "6990"]) {
    const record = recordOf(reference);
    for (const variant of [
      { ...record, providerId: "gomariz" },
      { ...record, brand: "OTRA MARCA" },
      { ...record, model: "OTRO MODELO" },
      { ...record, reference: "0000" },
      { ...record, url: `${record.url}?version=1` },
      { ...record, longDescription: `${record.longDescription} Altura de elevación de 2000 mm.` },
      { ...record, specs: { ...record.specs, "Altura de elevación (mm)": "800 mm" } }
    ]) {
      assert.equal(recoverGamMaximumLiftHeightSpec(variant)[key], variant.specs?.[key], reference);
    }
  }
});

test("las alturas recuperadas quedan limitadas a las fichas acreditadas y excluyen Gomariz", () => {
  const improved = gam.products.filter((record) =>
    !Object.hasOwn(record.specs ?? {}, key) && Object.hasOwn(recoverGamMaximumLiftHeightSpec(record), key)
  ).map((record) => record.reference);
  assert.equal(improved.length, expected.length);
  assert.deepEqual(new Set(improved), new Set(expected.map(([reference]) => reference)));
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamMaximumLiftHeightSpec(record), record.specs ?? {});
  }
});
