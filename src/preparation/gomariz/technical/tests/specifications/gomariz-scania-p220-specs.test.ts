import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverGomarizDocumentedScaniaP220Specs } from "../../evidence/documented-scania-p220-specs.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { analyzeTechnicalDensity } from "../../../../../catalog/diagnostics/technical-density.js";

const originals = (await readCanonicalCatalog("src/testing/fixtures/gomariz/regression-143/scrape-gomariz-catalog.json")).products;
const expectedByReference: Readonly<Record<string, SpecsMap>> = {
  "5051BDX": {
    "Potencia aproximada del motor": "220 CV"
  }
};
const references = new Set(Object.keys(expectedByReference));

test("GOMARIZ: las prestaciones se limitan a los originales acreditados", () => {
  let improved = 0;
  let additions = 0;
  for (const record of originals) {
    const specs = record.specs ?? {};
    const snapshot = JSON.stringify(record);
    const actual = recoverGomarizDocumentedScaniaP220Specs(record, specs);
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
  assert.equal(improved, 1);
  assert.equal(additions, 1);
});

test("GOMARIZ: las variantes y las sobrescrituras están bloqueadas", () => {
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
      assert.equal(recoverGomarizDocumentedScaniaP220Specs(variant, incoming), incoming, `${record.reference}:${index}`);
    }
    const occupied = { ...specs, [firstKey]: "Dato previo" };
    assert.equal(recoverGomarizDocumentedScaniaP220Specs(record, occupied), occupied);
  }
});

test("GOMARIZ: la densidad mejorada mantiene los umbrales existentes", () => {
  const selected = originals.filter((record) => record.reference && references.has(record.reference));
  assert.equal(selected.length, 1);
  const before = selected.map((record) => {
    const prepared = prepareSourceProduct(record).product;
    const additions = expectedByReference[record.reference ?? ""];
    assert.ok(additions);
    return { ...prepared, spec: Object.fromEntries(Object.entries(prepared.spec).filter(([key]) => !(key in additions))) };
  });
  const after = selected.map((record) => prepareSourceProduct(record).product);
  const beforeDensity = analyzeTechnicalDensity(before);
  const afterDensity = analyzeTechnicalDensity(after);
  assert.equal(beforeDensity.totals.sparse + beforeDensity.totals.medium, 1);
  assert.deepEqual([afterDensity.totals.sparse, afterDensity.totals.medium], [0, 0]);
});
