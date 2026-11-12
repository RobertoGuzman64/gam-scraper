import assert from "node:assert/strict";
import test from "node:test";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import {
  controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaPlatform
} from "./editorial-contract-records.js";

test("las máquinas con conceptos equivalentes comparten el dominio, no los textos de unidad", () => {
  const first = controlledGomarizPlatform();
  const second = controlledMercaelevaPlatform();
  assert.equal(resolveEditorialFacts(first)?.workingHeightM, 10);
  assert.equal(resolveEditorialFacts(second)?.workingHeightM, 10);
  assert.equal(resolveReusableEditorial(first).short?.includes("10 m"), true);
  assert.equal(resolveReusableEditorial(second).short?.includes("10 m"), true);
  assert.doesNotMatch(resolveReusableEditorial(second).general ?? "", /450 kg/u);
});

test("los horómetros pertenecen a cada unidad y no al modelo compartido", () => {
  const source = controlledGamForklift();
  const withHours = { ...source, horometer: "1616 horas" };
  const another = { ...source, reference: "CONTROL-OTRA", url: "https://online.gamrentals.com/es/carretillas/CONTROL-OTRA-carretilla-elevadora", horometer: "500 horas" };
  assert.equal(resolveReusableEditorial(withHours).short, resolveReusableEditorial(another).short);
  assert.match(resolveReusableEditorial(withHours).general ?? "", /1\.616 horas/u);
  assert.match(resolveReusableEditorial(another).general ?? "", /500 horas/u);
  assert.doesNotMatch(resolveReusableEditorial(another).general ?? "", /1\.616 horas/u);
});

test("las variantes semánticas incompatibles no atraviesan el motor", () => {
  const source = controlledGomarizPlatform();
  for (const record of [
    { ...source, providerId: "mercaeleva" },
    { ...source, model: "OTRA-VARIANTE" },
    { ...source, url: "https://example.invalid/producto/marca-modelo10/" },
    { ...source, specs: { ...source.specs, "Altura de trabajo": "10 kg" } }
  ]) {
    assert.equal(resolveEditorialFacts(record), null);
    assert.deepEqual(resolveReusableEditorial(record), { short: null, general: null });
  }
});

test("la preparación no altera identidad o datos de origen", () => {
  const source = controlledGamForklift();
  const initial = JSON.stringify(source);
  const result = prepareSourceProduct(source);
  assert.equal(result.product.reference, source.reference);
  assert.equal(result.product.sourceUrl, source.url);
  assert.equal(JSON.stringify(source), initial);
});
