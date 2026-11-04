import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverMercaelevaDocumentedResidualLiftSpecs } from "../../../../evidence/providers/mercaeleva/documented-residual-lift-specs.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { analyzeTechnicalDensity } from "../../../../../diagnostics/technical-density.js";

const originals = (await readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")).products;
const expectedByReference: Readonly<Record<string, SpecsMap>> = {
  "M005-4474": {
    "Capacidad de plataforma": "230 kg",
    "Longitud de plataforma": "2,26 m",
    "Anchura de plataforma": "0,79 m",
    "Extensión de plataforma": "0,9 m"
  },
  "M159-0669": {
    "Capacidad de plataforma": "230 kg",
    "Longitud de plataforma": "2,26 m",
    "Anchura de plataforma": "0,79 m",
    "Extensión de plataforma": "0,9 m"
  },
  "M346-8211": {
    "Capacidad de plataforma": "240 kg",
    "Longitud de plataforma": "1,27 m",
    "Anchura de plataforma": "0,70 m",
    "Extensión de plataforma": "0,6 m"
  },
  "M606-3993": {
    "Capacidad de plataforma": "240 kg",
    "Longitud de plataforma": "1,27 m",
    "Anchura de plataforma": "0,70 m",
    "Extensión de plataforma": "0,6 m"
  },
  "M318-0509": {
    "Capacidad de plataforma": "320 kg",
    "Longitud de plataforma": "2,26 m",
    "Anchura de plataforma": "1,12 m",
    "Extensión de plataforma": "0,9 m"
  },
  "M726-5166": {
    "Capacidad de plataforma": "320 kg",
    "Longitud de plataforma": "2,26 m",
    "Anchura de plataforma": "1,12 m",
    "Extensión de plataforma": "0,9 m"
  },
  "M486-0114": {
    "Capacidad de plataforma": "320 kg",
    "Longitud de plataforma": "2,64 m",
    "Anchura de plataforma": "1,12 m",
    "Extensión de plataforma": "0,9 m"
  },
  "M958-0132": {
    "Capacidad nominal de carga": "1600 kg",
    "Centro de carga": "600 mm",
    "Anchura total": "790 mm",
    "Radio de giro": "1504 mm"
  }
};
const references = new Set(Object.keys(expectedByReference));

test("MERCAELEVA: las prestaciones documentadas se aplican solo a las fichas acreditadas", () => {
  let improved = 0;
  let additions = 0;
  for (const record of originals) {
    const specs = record.specs ?? {};
    const snapshot = JSON.stringify(record);
    const actual = recoverMercaelevaDocumentedResidualLiftSpecs(record, specs);
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
  assert.equal(improved, 8);
  assert.equal(additions, 32);
});

test("MERCAELEVA: una identidad o prestación incompatible impide la incorporación", () => {
  for (const record of originals) {
    if (!record.reference || !references.has(record.reference)) continue;
    const specs = record.specs ?? {};
    const firstKey = Object.keys(expectedByReference[record.reference] ?? {})[0];
    assert.ok(firstKey, record.reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
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
      assert.equal(recoverMercaelevaDocumentedResidualLiftSpecs(variant, incoming), incoming, `${record.reference}:${index}`);
    }
    const occupied = { ...specs, [firstKey]: "Dato previo" };
    assert.equal(recoverMercaelevaDocumentedResidualLiftSpecs(record, occupied), occupied);
  }
});

test("MERCAELEVA: las fichas enriquecidas superan el umbral técnico sin ajustar el auditor", () => {
  const selected = originals.filter((record) => record.reference && references.has(record.reference));
  assert.equal(selected.length, 8);
  const before = selected.map((record) => {
    const prepared = prepareSourceProduct(record).product;
    const additions = expectedByReference[record.reference ?? ""];
    assert.ok(additions);
    return { ...prepared, spec: Object.fromEntries(Object.entries(prepared.spec).filter(([key]) => !(key in additions))) };
  });
  const after = selected.map((record) => prepareSourceProduct(record).product);
  const beforeDensity = analyzeTechnicalDensity(before);
  const afterDensity = analyzeTechnicalDensity(after);
  assert.equal(beforeDensity.totals.sparse + beforeDensity.totals.medium, 8);
  assert.deepEqual([afterDensity.totals.sparse, afterDensity.totals.medium], [0, 0]);
});
