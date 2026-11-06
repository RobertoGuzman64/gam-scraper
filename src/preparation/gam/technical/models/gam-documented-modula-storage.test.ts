import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverGamDocumentedModulaStorageSpecs } from "./documented-modula-storage-specs.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { analyzeTechnicalDensity } from "../../../../catalog/diagnostics/technical-density.js";

const originals = (await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json")).products;
const expectedByReference: Readonly<Record<string, SpecsMap>> = {
  "3425": {
    "Anchura de bandeja": "2500 mm",
    "Profundidad de bandeja": "857 mm",
    "Carga neta por bandeja": "250 kg",
    "Anchura exterior del almacén": "2917 mm"
  },
  "3426": {
    "Anchura de bandeja": "2500 mm",
    "Profundidad de bandeja": "857 mm",
    "Carga neta por bandeja": "500 kg",
    "Anchura exterior del almacén": "2917 mm"
  },
  "3427": {
    "Anchura de bandeja": "2500 mm",
    "Profundidad de bandeja": "857 mm",
    "Carga neta por bandeja": "750 kg",
    "Anchura exterior del almacén": "2917 mm"
  },
  "3428": {
    "Anchura de bandeja": "3100 mm",
    "Profundidad de bandeja": "857 mm",
    "Carga neta por bandeja": "250 kg",
    "Anchura exterior del almacén": "3517 mm"
  },
  "3429": {
    "Anchura de bandeja": "3100 mm",
    "Profundidad de bandeja": "857 mm",
    "Carga neta por bandeja": "500 kg",
    "Anchura exterior del almacén": "3517 mm"
  },
  "3430": {
    "Anchura de bandeja": "3100 mm",
    "Profundidad de bandeja": "857 mm",
    "Carga neta por bandeja": "750 kg",
    "Anchura exterior del almacén": "3517 mm"
  },
  "3431": {
    "Anchura de bandeja": "4100 mm",
    "Profundidad de bandeja": "857 mm",
    "Carga neta por bandeja": "250 kg",
    "Anchura exterior del almacén": "4517 mm"
  },
  "3432": {
    "Anchura de bandeja": "4100 mm",
    "Profundidad de bandeja": "857 mm",
    "Carga neta por bandeja": "500 kg",
    "Anchura exterior del almacén": "4517 mm"
  },
  "3433": {
    "Anchura de bandeja": "4100 mm",
    "Profundidad de bandeja": "857 mm",
    "Carga neta por bandeja": "750 kg",
    "Anchura exterior del almacén": "4517 mm"
  },
  "3434": {
    "Anchura de bandeja": "1300 mm",
    "Profundidad de bandeja": "425 mm",
    "Carga neta por bandeja": "350 kg",
    "Anchura exterior del almacén": "1685 mm"
  },
  "3435": {
    "Anchura de bandeja": "1900 mm",
    "Profundidad de bandeja": "425 mm",
    "Carga neta por bandeja": "350 kg",
    "Anchura exterior del almacén": "2285 mm"
  },
  "3436": {
    "Anchura de bandeja": "2500 mm",
    "Profundidad de bandeja": "425 mm",
    "Carga neta por bandeja": "350 kg",
    "Anchura exterior del almacén": "2885 mm"
  }
};
const references = new Set(Object.keys(expectedByReference));

test("GAM: las prestaciones documentadas se aplican solo a las fichas acreditadas", () => {
  let improved = 0;
  let additions = 0;
  for (const record of originals) {
    const specs = record.specs ?? {};
    const snapshot = JSON.stringify(record);
    const actual = recoverGamDocumentedModulaStorageSpecs(record, specs);
    const expected = record.reference ? expectedByReference[record.reference] : undefined;
    if (!expected) {
      assert.equal(actual, specs, record.reference ?? record.url);
      continue;
    }
    assert.deepEqual(actual, { ...specs, ...expected }, record.reference ?? record.url);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", record.reference ?? record.url);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(prepared.product.spec[key], value, `${record.reference}:${key}`);
      assert.ok(!(key in specs), `${record.reference}:${key}`);
    }
    assert.equal(JSON.stringify(record), snapshot);
    improved++;
    additions += Object.keys(expected).length;
  }
  assert.equal(improved, 12);
  assert.equal(additions, 48);
});

test("GAM: una identidad o prestación incompatible impide la incorporación", () => {
  for (const record of originals) {
    if (!record.reference || !references.has(record.reference)) continue;
    const specs = record.specs ?? {};
    const firstKey = Object.keys(expectedByReference[record.reference] ?? {})[0];
    assert.ok(firstKey, record.reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "mercaeleva" },
      { ...record, categoryKey: "otra-categoria" },
      { ...record, reference: `${record.reference}-otro` },
      { ...record, url: `${record.url}?variante=1` },
      { ...record, title: `${record.title} variante` },
      { ...record, brand: "Otra marca" },
      { ...record, model: "Otra variante" },
      { ...record, year: "2099" },
      { ...record, longDescription: `${record.longDescription} variante` },
      { ...record, specs: { ...specs, "Dato de identidad nuevo": "Cambio" } }
    ];
    for (const [index, variant] of variants.entries()) {
      const incoming = variant.specs ?? {};
      assert.equal(recoverGamDocumentedModulaStorageSpecs(variant, incoming), incoming, `${record.reference}:${index}`);
    }
    const occupied = { ...specs, [firstKey]: "Dato previo" };
    assert.equal(recoverGamDocumentedModulaStorageSpecs(record, occupied), occupied);
  }
});

test("GAM: las fichas enriquecidas superan el umbral técnico sin ajustar el auditor", () => {
  const selected = originals.filter((record) => record.reference && references.has(record.reference));
  assert.equal(selected.length, 12);
  const before = selected.map((record) => {
    const prepared = prepareSourceProduct(record).product;
    const additions = expectedByReference[record.reference ?? ""];
    assert.ok(additions);
    return { ...prepared, spec: Object.fromEntries(Object.entries(prepared.spec).filter(([key]) => !(key in additions))) };
  });
  const after = selected.map((record) => prepareSourceProduct(record).product);
  const beforeDensity = analyzeTechnicalDensity(before);
  const afterDensity = analyzeTechnicalDensity(after);
  assert.equal(beforeDensity.totals.sparse + beforeDensity.totals.medium, 12);
  assert.deepEqual([afterDensity.totals.sparse, afterDensity.totals.medium], [0, 0]);
});
