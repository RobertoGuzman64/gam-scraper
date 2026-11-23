import assert from "node:assert/strict";

import test from "node:test";

import type { ProductRecord } from "../../../../contracts/catalog.js";

import { resolveSourcedOperationalSpecs } from "../domain/editorial-sourced-operational-specs.js";

import { controlledGamForklift } from "./editorial-contract-records.js";

const batterySource = (): ProductRecord => ({
  ...controlledGamForklift(),
  title: "Apilador eléctrico MARCA MODELO10",
  brand: "MARCA",
  model: "MODELO10",
  specs: {
    Marca: "MARCA", Modelo: "MODELO10",
    "Capacidad de la batería": "24 V / 315-375 Ah | Li-ion 24 V / 300 Ah (V/Ah)"
  }
});

const batteryGeneral = "La ficha técnica del apilador MARCA MODELO10 describe el trabajo en almacenes y la manipulación de cargas paletizadas.";

test("las baterías alternativas proceden de la misma ficha y no se presentan como instaladas", () => {
  const source = batterySource();
  const original = JSON.stringify(source);
  const result = resolveSourcedOperationalSpecs(source, source, batteryGeneral, true) ?? "";
  assert.match(result, /entre 315 y 375 Ah/u);
  assert.match(result, /ion-litio de 300 Ah/u);
  assert.match(result, /batería instalada debe comprobarse/u);
  assert.equal(resolveSourcedOperationalSpecs(source, source, result, true), null);
  assert.equal(JSON.stringify(source), original);
});

test("no atribuye baterías a referencias, versiones, proveedores o especificaciones distintos", () => {
  const source = batterySource();
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, reference: "OTRA-UNIDAD" },
    { ...source, url: "https://online.gamrentals.com/es/carretillas/OTRA-UNIDAD" },
    { ...source, model: "MODELO11", title: "Apilador eléctrico MARCA MODELO11" },
    { ...source, condition: "Nuevo" },
    { ...source, specs: { ...source.specs, "Capacidad de la batería": "24 V / 210-250 Ah | Li-ion 24 V / 200 Ah (V/Ah)" } }
  ];
  for (const variant of variants) {
    assert.equal(resolveSourcedOperationalSpecs(source, variant, batteryGeneral, source.providerId === variant.providerId), null);
  }
  assert.equal(resolveSourcedOperationalSpecs(source, source, batteryGeneral, false), null);
  assert.equal(resolveSourcedOperationalSpecs(source, source, `${batteryGeneral} La batería es opcional.`, true), null);
  assert.equal(resolveSourcedOperationalSpecs({ ...source, model: "OTRA" }, source, batteryGeneral, true), null);
});
