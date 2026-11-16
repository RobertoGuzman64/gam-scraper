import assert from "node:assert/strict";
import test from "node:test";
import { accreditedSourceSamples } from "../../../../../testing/domain-cases/accredited-source-samples.js";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGomarizDocumentedWeight } from "../../evidence/documented-weight.js";

const originals = accreditedSourceSamples("gomariz-documented-weight");
const original = (reference: string): ProductRecord => {
  const record = originals.find((item) => item.reference === reference);
  if (!record) throw new Error(reference);
  return record;
};

const corrected = [
  ["TE1283", 2135],
  ["CA534", 3460]
] as const;

test("Gomariz: solo reconcilia pesos cuya cifra, identidad y documentación acreditada coinciden", () => {
  for (const [reference, kg] of corrected) {
    const record = original(reference);
    const snapshot = JSON.stringify(record);
    const changed = reconcileGomarizDocumentedWeight(record);
    assert.notStrictEqual(changed, record, reference);
    assert.deepEqual(changed.specs, { ...record.specs, Peso: `${kg} kg` }, reference);
    assert.equal(prepareSourceProduct(record).status, "ready", reference);
    assert.equal(prepareSourceProduct(record).issues.length, 0, reference);
    assert.equal(JSON.stringify(record), snapshot, reference);
  }
});

test("Gomariz: los pesos sin evidencia, precios inválidos y motorizaciones cuestionadas siguen en revisión", () => {
  for (const reference of ["CA1459", "TE1152", "RE454"]) {
    const record = original(reference);
    assert.strictEqual(reconcileGomarizDocumentedWeight(record), record, reference);
    assert.equal(prepareSourceProduct(record).status, "review", reference);
  }
});

test("Gomariz: no infiere kg ante otra cifra, identidad, fuente o especificación contradictoria", () => {
  for (const [reference] of corrected) {
    const record = original(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, categoryKey: "otra" },
      { ...record, condition: "Nuevo" },
      { ...record, title: `${record.title} variante` },
      { ...record, brand: "Otra marca" },
      { ...record, model: "OTRA VARIANTE" },
      { ...record, url: `${record.url}?origen=otro` },
      { ...record, url: record.url.replace("https:", "http:") },
      { ...record, url: record.url.replace("www.gomarizrent.com", "www.gomarizrent.com:8443") },
      { ...record, url: record.url.replace("/producto/", "/otra/") },
      { ...record, url: record.url.replace("gomarizrent.com", "example.invalid") },
      { ...record, specs: { ...record.specs, Peso: "2135 m / 2220 kg" } },
      { ...record, specs: { ...record.specs, Peso: "2134 m" } },
      { ...record, specs: { ...record.specs, Marca: "Otra marca" } },
      { ...record, specs: { ...record.specs, Modelo: "Otra variante" } },
      { ...record, specs: { ...record.specs, Peso: "2135 kg" } },
      { ...record, specs: { ...record.specs, Peso: "2135 metros" } },
      { ...record, specs: { ...record.specs, "Peso operativo": "2800 kg" } }
    ];
    for (const changed of variants) {
      assert.strictEqual(reconcileGomarizDocumentedWeight(changed), changed, `${reference}: ${changed.url}`);
    }
  }
});

test("Gomariz: el reconciliador no altera otros originales de la muestra acreditada", () => {
  const references = new Set<string>(corrected.map(([reference]) => reference));
  for (const record of originals) {
    if (references.has(record.reference ?? "")) continue;
    assert.strictEqual(reconcileGomarizDocumentedWeight(record), record, record.reference ?? record.url);
  }
});
