import assert from "node:assert/strict";

import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";

import { prepareSourceProduct } from "../../../prepare-product.js";

import { hasVerifiedPublishedEditorialLoadConflict } from "./prepared-editorial-load-consistency.js";

import { controlledGamForklift, controlledGomarizForklift, controlledGomarizPlatform, controlledMercaelevaForklift } from "../../core/editorial-contract-records.js";

const issue = "Descripción comercial contradictoria: capacidad de carga";

test("medidas coherentes de las tres fuentes no generan un bloqueo editorial", () => {
  for (const source of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const prepared = prepareSourceProduct(source);
    assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, prepared.product), false, source.providerId);
    assert.ok(!prepared.issues.includes(issue), source.providerId);
  }
});


test("la reclasificación de una capacidad de cesta conserva el control de contradicciones", () => {
  const source = { ...controlledGomarizPlatform(), url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/marca-modelo10/",
    specs: { Capacidad: "230 kg" } };
  const prepared = prepareSourceProduct(source).product;
  const base = { ...prepared, spec: { "Capacidad de la cesta": "230 kg" }, title: "Capacidad de carga de 300 kg" };
  assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, base), true);
  assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, { ...base, title: "Capacidad de carga de 230 kg",
    description: null, description_general: null }), false);
});


test("la capacidad de cesta GAM conserva el control de contradicciones tras reclasificar", () => {
  const source = { ...controlledGamForklift(), specs: { "Capacidad de carga (kg)": "230 kg" } };
  const prepared = prepareSourceProduct(source).product;
  const base = { ...prepared, spec: { "Capacidad de la cesta": "230 kg" }, title: "Capacidad de carga de 300 kg" };
  assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, base), true);
  assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, { ...base, title: "Capacidad de carga de 230 kg", description: null, description_general: null }), false);
});


test("el alias de carga de origen conserva las contradicciones solo en su ámbito acreditado", () => {
  const origin = controlledGomarizPlatform();
  const source: ProductRecord = { ...origin, providerId: "manain", title: "MODELO10",
    url: "https://manain.com/producto/venta-elevacion-tijera-marca-modelo10/",
    specs: { "Capacidad carga": "230 kg" } };
  const prepared = prepareSourceProduct(origin).product;
  const published = { ...prepared, providerId: source.providerId, sourceUrl: source.url,
    spec: { "Capacidad de la cesta": "230 kg" }, title: "Capacidad de carga de 300 kg",
    description: null, description_general: null };
  assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, published), true);
  assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, { ...published, title: "Capacidad de carga de 230 kg" }), false);
  assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, { ...published, providerId: "gomariz" }), false);
  assert.equal(hasVerifiedPublishedEditorialLoadConflict({ ...source, providerId: "gomariz" },
    { ...published, providerId: "gomariz" }), false);
  assert.equal(hasVerifiedPublishedEditorialLoadConflict({ ...source, specs: { ...source.specs, Capacidad: "320 kg" } }, published), false);
  assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, { ...published, spec: { "Capacidad de la cesta": "320 kg" } }), false);
});
