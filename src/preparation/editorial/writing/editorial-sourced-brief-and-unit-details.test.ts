import assert from "node:assert/strict";

import test from "node:test";

import type { ProductRecord } from "../../../contracts/catalog.js";

import { resolveSourcedOperationalSpecs } from "../source/details/editorial-sourced-operational-specs.js";

import { controlledGamForklift, controlledGomarizForklift } from "../core/editorial-contract-records.js";

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

const containerSource = (basis: ProductRecord): ProductRecord => ({
  ...basis,
  title: "Reach Stacker MARCA MODELO10",
  url: basis.providerId === "gam" ? "https://online.gamrentals.com/es/manipuladores/CONTROL-03-marca-modelo10" :
    "https://www.gomarizrent.com/producto/marca-modelo10/",
  shortDescription: "MARCA MODELO10. Reach Stacker con capacidad de carga de 42000 kg.",
  longDescription: "La gama de manipuladores Reach Stacker de MARCA está destinada a la manipulación de contenedores. Existen distintas configuraciones de implementos y opciones de transporte.",
  specs: { Marca: "MARCA", Modelo: "MODELO10", "Capacidad de carga (kg)": "42000 kg",
    "Altura de elevación (m)": "14,5 m", Peso: "65000 kg", "Centro de carga": "1800 mm", "Radio de giro": "8,2 m" }
});

test("distingue la configuración de un manipulador de contenedores del texto de gama en distintos proveedores", () => {
  for (const factory of [controlledGamForklift, controlledGomarizForklift]) {
    const source = containerSource(factory());
    const snapshot = structuredClone(source);
    const result = resolveSourcedOperationalSpecs(source, source, source.longDescription, true) ?? "";
    assert.match(result, /MARCA MODELO10.*42\.000 kg.*14,5 m.*65\.000 kg.*1\.800 mm.*8,2 m/u);
    assert.match(result, /diagrama de cargas/u);
    assert.match(result, /Descripción de gama aportada por el proveedor, sin acreditar el equipamiento específico/u);
    assert.ok(result.endsWith(source.longDescription ?? ""));
    assert.equal(resolveSourcedOperationalSpecs(source, source, result, true), null);
    assert.deepEqual(source, snapshot);
  }
});

test("no atribuye prestaciones de manipuladores cuando difieren el modelo, el origen o la capacidad", () => {
  const source = containerSource(controlledGamForklift());
  const variants: readonly ProductRecord[] = [
    { ...source, reference: "OTRA-UNIDAD" },
    { ...source, shortDescription: "MARCA MODELO11. Reach Stacker con capacidad de carga de 42000 kg." },
    { ...source, url: source.url.replace("modelo10", "modelo11") },
    { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "40000 kg" } },
    { ...source, longDescription: `${source.longDescription} El modelo MODELO11 incorpora otros implementos.` },
    { ...source, title: "Carretilla elevadora MARCA MODELO10" }
  ];
  for (const variant of variants) {
    assert.equal(resolveSourcedOperationalSpecs(source, variant, source.longDescription, true), null);
    assert.equal(resolveSourcedOperationalSpecs(variant, variant, variant.longDescription, true), null);
  }
  assert.equal(resolveSourcedOperationalSpecs(source, { ...source, providerId: "gomariz" }, source.longDescription, true), null);
  assert.equal(resolveSourcedOperationalSpecs(source, source, source.longDescription, false), null);
  assert.equal(resolveSourcedOperationalSpecs(source, source, "Otro anuncio sin relación con esta unidad.", true), null);
});

test("omite cotas no corroboradas y conserva las restantes sin reinterpretar valores", () => {
  const source = containerSource(controlledGamForklift());
  const prepared = { ...source, specs: { ...source.specs, "Centro de carga": "1900 mm", "Radio de giro": "8200" } };
  const result = resolveSourcedOperationalSpecs(source, prepared, source.longDescription, true) ?? "";
  assert.match(result, /42\.000 kg.*14,5 m.*65\.000 kg/u);
  assert.doesNotMatch(result, /centro de carga indicado|radio de giro indicado/u);
});
