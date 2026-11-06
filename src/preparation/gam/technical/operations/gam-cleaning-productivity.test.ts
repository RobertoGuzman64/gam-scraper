import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../catalog/normalization/normalize-specs.js";
import { recoverGamCleaningProductivitySpec } from "./cleaning-productivity-evidence.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const key = "Rendimiento de limpieza (m²/h)";

const expected = [
  ["6150", 9000], ["4025", 6300], ["4026", 7440], ["4027", 7440],
  ["4033", 20320], ["4034", 26820], ["3993", 1400], ["3994", 1800],
  ["3996", 1300], ["3997", 1631], ["3999", 2468], ["6149", 2940],
  ["4001", 4088], ["4002", 4088], ["4008", 5073], ["4003", 4415],
  ["4004", 4415], ["4009", 5300], ["4012", 7085]
] as const;

const recordOf = (reference: string) => {
  const record = gam.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera 19 rendimientos acreditados en m²/h sin alterar el origen ni las especificaciones anteriores", () => {
  for (const [reference, value] of expected) {
    const record = recordOf(reference);
    const snapshot = structuredClone(record);
    const result = prepareSourceProduct(record);
    assert.equal(result.product.spec[key], value, reference);
    const normalized = normalizeSpecsObject(result.product.spec);
    assert.equal(normalized.normalized[key], value, reference);
    assert.ok(!normalized.unknownKeys.includes(key), reference);
    for (const [originalKey, originalValue] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(result.product.spec[originalKey], originalValue, `${reference}: ${originalKey}`);
    }
    assert.deepEqual(record, snapshot, reference);
  }
});

test("no recupera métricas de modos diferentes, modelos no acreditados ni anchuras alternativas", () => {
  for (const reference of ["4019", "4020", "4021", "4022", "4024", "4029", "4030", "4000", "4005", "4006", "4007", "6148"]) {
    const record = recordOf(reference);
    assert.deepEqual(recoverGamCleaningProductivitySpec(record), record.specs ?? {}, reference);
  }
});

test("rechaza identidades cruzadas, lecturas distintas, unidades dudosas y métricas preexistentes", () => {
  const record = recordOf("4025");
  const source = record.specs ?? {};
  for (const variant of [
    { ...record, providerId: "gomariz" },
    { ...record, categoryKey: "elevacion-nueva" },
    { ...record, condition: "Segunda mano" as const },
    { ...record, model: "BCS S780" },
    { ...record, brand: "Hyster" },
    { ...record, title: "Barredora BCS S680" },
    { ...record, url: record.url.replace("4025-", "4026-") },
    { ...record, url: `${record.url}?test=1` },
    { ...record, specs: { ...source, "Rendimiento": "6200 m²/h" } },
    { ...record, longDescription: `${record.longDescription} Productividad máxima de 7.200 m² por hora.` },
    { ...record, longDescription: (record.longDescription ?? "").replace("6.300 m²", "6.300 m² en modo de barrido y 4.000 m²") },
    { ...record, longDescription: (record.longDescription ?? "").replace("6.300 m² por hora", "60.300 m² por hora") },
    { ...record, longDescription: (record.longDescription ?? "").replace("6.300 m² por hora", "6.300 m²") }
  ]) {
    assert.deepEqual(recoverGamCleaningProductivitySpec(variant), variant.specs ?? {});
  }
});

test("solo se incorporan las 19 fichas verificadas y Gomariz no cambia", () => {
  const changed = gam.products.flatMap((record) => {
    const after = recoverGamCleaningProductivitySpec(record);
    return Object.hasOwn(after, key) && !Object.hasOwn(record.specs ?? {}, key)
      ? [record.reference] : [];
  });
  assert.deepEqual(new Set(changed), new Set(expected.map(([reference]) => reference)));
  assert.equal(changed.length, expected.length);
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamCleaningProductivitySpec(record), record.specs ?? {});
  }
});
