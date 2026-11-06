import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";
import {
  reconcileGamVerifiedBasketLoad,
  reconcileGamVerifiedCapacityCoherence,
  reconcileGamVerifiedListingIdentity,
  reconcileGamVerifiedModelIdentity
} from "../gam/technical/reconciliation/gam-verified-capacity-coherence.js";
import { reconcileGamVerifiedBasketSizes } from "../gam/technical/reconciliation/gam-verified-basket-sizes.js";

const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");

const source = (reference: string): ProductRecord => {
  const record = products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Los catorce resúmenes de capacidad acreditados cambian sin inventar carga", () => {
  const expected = [
    ["4730", "200 kg"], ["4769", "256 kg sin restricciones y 350 kg con restricciones"],
    ["4755", "256 kg sin restricciones y 350 kg con restricciones"],
    ["4796", "300 kg sin restricciones y 460 kg con restricciones"],
    ["5900", "300 kg sin restricciones y 460 kg con restricciones"],
    ["4650", "300 kg"], ["4844", "300 kg"], ["4845", "300 kg"],
    ["2136", "1600 kg"], ["3189", "41000 kg"], ["5879", "1600 kg"],
    ["6625", "680 kg"], ["6869", "318 kg"], ["6870", "318 kg"]
  ] as const;
  for (const [reference, capacity] of expected) {
    const record = source(reference);
    const snapshot = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.ok(prepared.product.description?.includes(capacity), reference);
    assert.equal(JSON.stringify(record), snapshot, reference);
  }
});

test("Las dimensiones verificadas de GENIE, JLG y CTE se recuperan respetando las unidades", () => {
  for (const [reference, expected] of [
    ["6622", "3,98 x 1,83 m"], ["6625", "3,98 x 1,83 m"],
    ["6626", "1,83 x 0,91 m"],
    ["6169", "1,4 x 0,7 x 1,1 m"], ["6171", "1,4 x 0,7 x 1,1 m"]
  ] as const) {
    const record = source(reference);
    const snapshot = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Dimensiones Cesta"], expected, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(JSON.stringify(record), snapshot, reference);
  }
});

test("La preparación distingue la carga del camión, la capacidad de cesta y las variantes", () => {
  const truck = prepareSourceProduct(source("4846"));
  assert.equal(truck.product.spec["Capacidad de carga (kg)"], "250 KG");
  assert.ok(source("4846").longDescription?.includes("camión de 3.500 kg"));
  for (const reference of ["6869", "6870"]) {
    const prepared = prepareSourceProduct(source(reference));
    assert.equal(prepared.product.spec["Capacidad de carga (kg)"], "318 KG");
    assert.ok(prepared.product.description_general?.includes("capacidad de carga de 318 kg"));
    assert.ok(!prepared.product.description_general?.includes("capacidad de carga de 700 kg"));
  }
  const genie = prepareSourceProduct(source("6625"));
  assert.equal(genie.product.spec["Capacidad de carga (kg)"], "680 KG");
  assert.ok(genie.product.description_general?.includes("680 kg de capacidad de carga"));
  assert.ok(!genie.product.description_general?.includes("1.400 kg de capacidad"));
});

test("Las identidades acreditadas no dejan descripciones contradictorias", () => {
  const unicarriers = prepareSourceProduct(source("5879"));
  assert.equal(unicarriers.status, "ready");
  assert.ok(unicarriers.product.title?.includes("A2N1L16Q"));
  assert.ok(unicarriers.product.description?.includes("A2N1L16Q"));
  assert.ok(!unicarriers.product.description?.includes("A1N1L16Q"));
  const xcmg = prepareSourceProduct(source("4802"));
  assert.equal(xcmg.status, "ready");
  assert.equal(xcmg.product.spec.Modelo, "XG1523ERT");
  assert.equal(xcmg.product.spec["Altura plataforma (m)"], "13 m");
  assert.ok(!xcmg.product.description_general?.includes("divergencia debe verificarse"));
});

test("Los reconciliadores no aceptan referencias manipuladas ni evidencia contradictoria", () => {
  const capacity = source("4730");
  const invalidUrl = { ...capacity, url: `${capacity.url}?bad=1` };
  assert.strictEqual(reconcileGamVerifiedCapacityCoherence(invalidUrl), invalidUrl);
  const falseCapacity = { ...capacity, specs: { ...capacity.specs, "Capacidad de carga (kg)": "150 KG" } };
  assert.strictEqual(reconcileGamVerifiedCapacityCoherence(falseCapacity), falseCapacity);
  const noLongEvidence = { ...capacity, longDescription: "Sin capacidad documentada" };
  assert.strictEqual(reconcileGamVerifiedCapacityCoherence(noLongEvidence), noLongEvidence);
  const basket = source("6622");
  const wrongModel = { ...basket, specs: { ...basket.specs, Modelo: "GS-4390" } };
  assert.strictEqual(reconcileGamVerifiedBasketSizes(wrongModel), wrongModel);
  const variant = source("4802");
  const alteredModel = { ...variant, title: "Variante sin identidad confirmada" };
  assert.strictEqual(reconcileGamVerifiedModelIdentity(alteredModel), alteredModel);
  const truck = source("4846");
  const bogusTruck = { ...truck, specs: { ...truck.specs, "Capacidad de carga (kg)": "5000 KG" } };
  assert.strictEqual(reconcileGamVerifiedBasketLoad(bogusTruck), bogusTruck);
  const unicarriers = source("5879");
  const wrongUrl = { ...unicarriers, url: `${unicarriers.url}?other=1` };
  assert.strictEqual(reconcileGamVerifiedListingIdentity(wrongUrl), wrongUrl);
});

test("La normalización de títulos y capacidades no altera casos ambiguos", () => {
  for (const reference of ["6909", "6982", "6845", "6642", "6669", "2328"]) {
    const record = source(reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Capacidad de carga (kg)"],
      prepareSourceProduct({ ...record }).product.spec["Capacidad de carga (kg)"], reference);
  }
});
