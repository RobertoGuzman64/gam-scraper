import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { hasVerifiedPublishedEditorialLoadConflict } from "../mapping/prepared-editorial-load-consistency.js";
import { controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift } from "./editorial-contract-records.js";

const original = (reference: string): ProductRecord => accreditedSourceRecord("gam-original", reference);

const issue = "Descripción comercial contradictoria: capacidad de carga";

test("las descripciones de origen con capacidad nominal incompatible no llegan a ready", () => {
  for (const [reference, field] of [
    ["4739", "description_general"],
    ["4778", "description_general"],
    ["2159", "description"]
  ] as const) {
    const source = original(reference);
    const snapshot = JSON.stringify(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "review", reference);
    assert.ok(prepared.issues.includes(issue), reference);
    assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, prepared.product), true, reference);
    assert.ok(prepared.product[field], reference);
    assert.deepEqual(prepared.product.spec["Capacidad de carga (kg)"], source.specs?.["Capacidad de carga (kg)"], reference);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("los valores sometidos a restricciones no se tratan como capacidades nominales simples", () => {
  const source = original("4779");
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, prepared.product), false);
  assert.ok(!prepared.issues.includes(issue));
});

test("un conflicto ya acreditado no acumula avisos redundantes", () => {
  const source = original("2312");
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "review");
  assert.ok(prepared.issues.includes("Atributo contradictorio: Capacidad de carga"));
  assert.equal(prepared.issues.includes(issue), false);
});

test("medidas coherentes de las tres fuentes no generan un bloqueo editorial", () => {
  for (const source of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const prepared = prepareSourceProduct(source);
    assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, prepared.product), false, source.providerId);
    assert.ok(!prepared.issues.includes(issue), source.providerId);
  }
});

test("la comprobación no aplica datos de otra unidad o proveedor ni altera las especificaciones", () => {
  const source = original("4739");
  const prepared = prepareSourceProduct(source).product;
  for (const incompatible of [
    { ...source, reference: "OTRA-UNIDAD" },
    { ...source, url: "https://example.invalid/otra-unidad" },
    { ...source, providerId: "gomariz" },
    { ...source, model: "OTRO-MODELO" },
    { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "230 kg" } }
  ]) {
    assert.equal(hasVerifiedPublishedEditorialLoadConflict(incompatible, prepared), false);
  }
  assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, {
    ...prepared, spec: { ...prepared.spec, "Capacidad de carga (kg)": "230 kg" }
  }), false);
});

test("no equipara capacidades de carga con cifras de otras magnitudes", () => {
  const source = original("4739");
  const prepared = prepareSourceProduct(source).product;
  assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, {
    ...prepared,
    description: "Plataforma con peso operativo de 230 kg y altura de trabajo de 10 m.",
    description_general: "Plataforma con capacidad de cesta de 230 kg."
  }), false);
  assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, {
    ...prepared,
    description: "Plataforma con capacidad de carga de 450 kg y altura de trabajo de 10 m.",
    description_general: "La plataforma tiene capacidad de carga de 450 kg."
  }), false);
});


test("los manipuladores de contenedores del catálogo original quedan retenidos por carga incompatibles", () => {
  for (const reference of ["2190", "3189"]) {
    const source = accreditedSourceRecord("editorial-load-original", reference);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "review", reference);
    assert.deepEqual(prepared.issues, [issue], reference);
    assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, prepared.product), true, reference);
  }
});

test("el motor detecta un conflicto nominal equivalente en Gomariz y Mercaeleva", () => {
  const gomariz = accreditedSourceRecord("gomariz-original", "TE1591");
  const mercaeleva = accreditedSourceRecord("mercaeleva-original", "M011-3720");
  for (const [source, prior, incompatible] of [
    [gomariz, "capacidad de 450 kg", "capacidad de carga de 230 kg"],
    [mercaeleva, "capacidad de carga de 2.000 kg", "capacidad de carga de 2.200 kg"]
  ] as const) {
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", source.providerId);
    assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, prepared.product), false, source.providerId);
    const summary = prepared.product.description;
    if (summary === null) throw new Error(`Descripción ausente: ${source.reference}`);
    assert.ok(summary.includes(prior), source.providerId);
    const changed = {
      ...prepared.product,
      description: summary.replace(prior, incompatible)
    };
    assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, changed), true, source.providerId);
  }
});

test("una magnitud citada expresamente como interpretación rechazada no crea contradicción", () => {
  const source = accreditedSourceRecord("mercaeleva-original", "M433-5206");
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.equal(hasVerifiedPublishedEditorialLoadConflict(source, prepared.product), false);
});
