import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverMercaelevaDocumentedDensity180Specs } from "../../../../evidence/providers/mercaeleva/documented-density-180.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { analyzeTechnicalDensity } from "../../../../../diagnostics/technical-density.js";

const originals = (await readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")).products;
const expectedByReference: Readonly<Record<string, SpecsMap>> = {
  "M177-1398": {
    "Capacidad de plataforma": "230 kg",
    "Extensión máxima de plataforma": "0,9 m",
    "Longitud de plataforma": "1,64 m",
    "Anchura de plataforma": "0,76 m"
  },
  "M840-6795": {
    "Capacidad de plataforma": "230 kg",
    "Alcance horizontal máximo": "7,81 m"
  },
  "M940-3556": {
    "Alcance horizontal máximo": "21,3 m",
    "Capacidad máxima de plataforma": "272 kg",
    "Altura máxima de plataforma": "41,1 m"
  },
  "M547-1056": {
    "Alcance horizontal máximo": "23,4 m",
    "Capacidad máxima de plataforma": "227 kg",
    "Anchura de máquina": "2,43 m"
  },
  "M570-8735": {
    "Capacidad nominal de carga": "1800 kg",
    "Centro de carga": "600 mm",
    "Elevación de horquillas": "125 mm"
  },
  "M879-4639": {
    "Capacidad nominal de carga": "2000 kg",
    "Tensión del sistema de batería": "24 V",
    "Centro de carga": "600 mm"
  },
  "M777-6495": {
    "Alcance horizontal máximo": "17,1 m",
    "Capacidad máxima de plataforma": "227 kg",
    "Altura máxima de plataforma": "19,8 m"
  }
};
const references = new Set(Object.keys(expectedByReference));

test("MERCAELEVA: las prestaciones se limitan a los originales acreditados", () => {
  let improved = 0;
  let additions = 0;
  for (const record of originals) {
    const specs = record.specs ?? {};
    const snapshot = JSON.stringify(record);
    const actual = recoverMercaelevaDocumentedDensity180Specs(record, specs);
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
  assert.equal(improved, 7);
  assert.equal(additions, 21);
});

test("MERCAELEVA: las variantes y las sobrescrituras están bloqueadas", () => {
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
      assert.equal(recoverMercaelevaDocumentedDensity180Specs(variant, incoming), incoming, `${record.reference}:${index}`);
    }
    const occupied = { ...specs, [firstKey]: "Dato previo" };
    assert.equal(recoverMercaelevaDocumentedDensity180Specs(record, occupied), occupied);
  }
});

test("MERCAELEVA: la densidad mejorada mantiene los umbrales existentes", () => {
  const selected = originals.filter((record) => record.reference && references.has(record.reference));
  assert.equal(selected.length, 7);
  const before = selected.map((record) => {
    const prepared = prepareSourceProduct(record).product;
    const additions = expectedByReference[record.reference ?? ""];
    assert.ok(additions);
    return { ...prepared, spec: Object.fromEntries(Object.entries(prepared.spec).filter(([key]) => !(key in additions))) };
  });
  const after = selected.map((record) => prepareSourceProduct(record).product);
  const beforeDensity = analyzeTechnicalDensity(before);
  const afterDensity = analyzeTechnicalDensity(after);
  assert.equal(beforeDensity.totals.sparse + beforeDensity.totals.medium, 7);
  assert.deepEqual([afterDensity.totals.sparse, afterDensity.totals.medium], [0, 0]);
});
