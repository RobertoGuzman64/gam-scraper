import assert from "node:assert/strict";

import test from "node:test";

import { differenceBetween } from "../active-publication.js";

import { evaluateIndividualPublicationDifference } from "../publication-acceptance.js";

import { reconcileRemovedSpecifications } from "../specification-reconciliations.js";

import type { ProductRecord } from "../../contracts/catalog.js";
import { prepareSourceProduct } from "../../preparation/prepare-product.js";

import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";

import { accreditedReconciliationCases } from "../../testing/fixtures/gam/specification-reconciliations.js";

const reconciliationProduct = (
  item: (typeof accreditedReconciliationCases)[number], spec: ImportCandidate["spec"]
): ImportCandidate => ({
  providerId: "gam", sourceUrl: item.sourceUrl, reference: item.reference,
  title: null, categorySellID: null, category: null, condition: null, price: null,
  description_title: null, description: null, description_general: null,
  image: null, images: [], spec, attributes: []
});

const previous = accreditedReconciliationCases.map((item) => reconciliationProduct(item, item.previousSpec));

const next = accreditedReconciliationCases.map((item) => reconciliationProduct(item, item.nextSpec));

const difference = differenceBetween("GAM anterior", "GAM corregida", previous, next);

const migrationKeys = [
  "ref:6688:ALFA ROMEO", "ref:6689:AUDI", "ref:6690:PEUGEOUT", "ref:2218:Ancho promedio",
  "ref:2109:Capacidad de la batería", "ref:2108:Capacidad de la batería", "ref:920:Capacidad de la batería",
  "ref:2134:Capacidad de carga (kg)", "ref:2135:Capacidad de carga (kg)", "ref:1714:Altura Plataforma",
  "ref:2737:Potencia Motor (KW)", "ref:2573:Potencia Motor (CV)"
];

test("distingue doce correcciones técnicas comprobables de pérdidas accidentales", () => {
  const reconciled = reconcileRemovedSpecifications("gam", difference, previous, next);
  assert.deepEqual([...reconciled.resolved].sort(), [...migrationKeys].sort());
  assert.deepEqual(reconciled.unresolved, []);
  assert.deepEqual(difference.lostSpecificationValues, []);
  assert.ok(evaluateIndividualPublicationDifference("gam", difference, previous, next, null).accepted);
  const other = reconcileRemovedSpecifications("gomariz", difference, previous, next);
  assert.deepEqual(other.resolved, []);
  assert.deepEqual([...other.unresolved].sort(), [...migrationKeys].sort());
});

test("un cambio del valor previo, del destino o de la procedencia invalida cada reconciliación", () => {
  for (const removal of migrationKeys) {
    const first = removal.indexOf(":", removal.indexOf(":") + 1);
    const identity = removal.slice(0, first);
    const key = removal.slice(first + 1);
    const original = previous.find((item) => `ref:${item.reference?.toLowerCase()}` === identity);
    const updated = next.find((item) => `ref:${item.reference?.toLowerCase()}` === identity);
    assert.ok(original && updated);
    const invalidOld = previous.map((item) => item === original ? { ...item, spec: { ...item.spec, [key]: "valor cambiado" } } : item);
    const invalidNew = next.map((item) => item === updated ? { ...item, sourceUrl: "https://example.com/otra-referencia" } : item);
    for (const [before, after] of [[invalidOld, next], [previous, invalidNew]] as const) {
      const assessment = reconcileRemovedSpecifications("gam", difference, before, after);
      assert.ok(assessment.unresolved.includes(removal), removal);
      assert.equal(evaluateIndividualPublicationDifference("gam", difference, before, after, null).accepted, false, removal);
    }
    const destination = removal.includes("Capacidad de carga") ? "Capacidad de arrastre" :
      removal.includes("Ancho promedio") || removal.includes("Capacidad de la batería") ? "Voltaje batería (V)" :
      removal.includes("Potencia Motor") ? "Modelo" :
      removal.includes("Altura Plataforma") ? "Altura" : "Marca";
    const damaged = next.map((item) => item === updated ? { ...item, spec: { ...item.spec, [destination]: "valor ajeno" } } : item);
    assert.ok(reconcileRemovedSpecifications("gam", difference, previous, damaged).unresolved.includes(removal), removal);
    assert.equal(evaluateIndividualPublicationDifference("gam", difference, previous, damaged, null).accepted, false, removal);
  }
});

const platform: ProductRecord = {
  providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta",
  url: "https://manain.com/producto/venta-elevacion-brazo-articulado-equiptest-tx1/",
  title: "TX1", shortDescription: null, longDescription: null, price: null,
  condition: "Segunda mano", reference: "TEST-TX1", brand: "EQUIPTEST", model: "TX1",
  year: "2021", location: null, country: null, horometer: "500", serialNumber: null,
  image: "https://manain.com/imagen-tx1.jpg",
  specs: { Marca: "EQUIPTEST", Modelo: "TX1", Motor: "Diésel", "Nueva o usada": "usada",
    "Altura trabajo": "15 m", "Capacidad carga": "230 kg", Peso: "10 kg" }
};

test("reconcilia únicamente retiradas de peso reproducibles desde el original de la unidad", () => {
  const duplicate: ProductRecord = { ...platform, specs: { ...platform.specs, Peso: "1200 kg", "Peso operativo": "1200 kg" } };
  for (const source of [platform, duplicate]) {
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    const field = source === platform ? "Peso" : "Peso operativo";
    const originalWeight = source.specs?.[field];
    assert.ok(originalWeight);
    const old = { ...prepared.product, spec: { ...prepared.product.spec, [field]: originalWeight } };
    const updated = prepared.product;
    const difference = differenceBetween("before", "after", [old], [updated]);
    const evaluate = (originals: readonly ProductRecord[], before = old, after = updated) =>
      reconcileRemovedSpecifications(source.providerId, difference, [before], [after], originals);
    assert.deepEqual(evaluate([source]), { resolved: difference.removedSpecifications, unresolved: [] });
    assert.equal(evaluateIndividualPublicationDifference(source.providerId, difference, [old], [updated], null, [source]).accepted, true);
    for (const originals of [[], [source, source], [{ ...source, url: "https://example.com/otra-unidad" }],
      [{ ...source, specs: { ...source.specs, [field]: "1300 kg" } }]]) {
      assert.deepEqual(evaluate(originals).unresolved, difference.removedSpecifications);
    }
    assert.deepEqual(evaluate([source], { ...old, spec: { ...old.spec, [field]: "1300 kg" } }).unresolved, difference.removedSpecifications);
    assert.deepEqual(evaluate([source], old, { ...updated, description_general: "Peso declarado de 10 kg" }).unresolved, difference.removedSpecifications);
    assert.deepEqual(evaluate([source], old, { ...updated, spec: { ...updated.spec, Peso: "1300 kg" } }).unresolved, difference.removedSpecifications);
  }
});

test("la omisión del peso inverosímil es aplicable a otros proveedores y no admite pesos válidos", () => {
  const source: ProductRecord = { ...platform, providerId: "gomariz", title: "EQUIPTEST TX1 Plataforma articulada",
    url: "https://www.gomarizrent.com/elevacion-y-trabajos-en-altura/brazo-articulado/equiptest-tx1/",
    image: "https://www.gomarizrent.com/imagen-tx1.jpg",
    specs: { Marca: "EQUIPTEST", Modelo: "TX1", Motor: "Diésel", "Altura de trabajo": "15 m", Capacidad: "230 kg", Peso: "10 kg" } };
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  const next = prepared.product;
  const previous = { ...next, spec: { ...next.spec, Peso: "10 kg" } };
  const diff = differenceBetween("before", "after", [previous], [next]);
  assert.equal(evaluateIndividualPublicationDifference(source.providerId, diff, [previous], [next], null, [source]).accepted, true);
  const valid = { ...source, specs: { ...source.specs, Peso: "1200 kg" } };
  const before = prepareSourceProduct(valid).product;
  const after = { ...before, spec: Object.fromEntries(Object.entries(before.spec).filter(([key]) => key !== "Peso")) };
  assert.equal(evaluateIndividualPublicationDifference(source.providerId, differenceBetween("before", "after", [before], [after]), [before], [after], null, [valid]).accepted, false);
});
