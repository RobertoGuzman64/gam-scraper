import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift,
  controlledGomarizPlatform, controlledMercaelevaPlatform
} from "./editorial-contract-records.js";

test("el mismo contrato de carretilla funciona en tres proveedores sin identificadores reales", () => {
  const sources = [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()];
  for (const source of sources) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "carretilla-elevadora", source.providerId);
    assert.equal(facts?.loadCapacityKg, 2500, source.providerId);
    assert.match(resolveReusableEditorial(source).short ?? "", /capacidad de carga de 2\.500 kg/u);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("alturas de trabajo y elevación no se mezclan", () => {
  const work = resolveEditorialFacts(controlledGomarizPlatform());
  const lifting = resolveEditorialFacts(controlledGamForklift());
  assert.equal(work?.workingHeightM, 10);
  assert.equal(work?.liftingHeightM, null);
  assert.equal(lifting?.workingHeightM, null);
  assert.equal(lifting?.liftingHeightM, 4.5);
  assert.doesNotMatch(resolveReusableEditorial(controlledGomarizPlatform()).short ?? "", /altura de elevación/u);
  assert.doesNotMatch(resolveReusableEditorial(controlledGamForklift()).short ?? "", /altura de trabajo/u);
});

test("dos proveedores con la misma familia no comparten datos ausentes de la otra fuente", () => {
  const complete = controlledGomarizPlatform();
  const partial = controlledMercaelevaPlatform();
  assert.equal(resolveEditorialFacts(complete)?.family, "plataforma-tijera");
  assert.equal(resolveEditorialFacts(partial)?.family, "plataforma-tijera");
  assert.match(resolveReusableEditorial(complete).short ?? "", /capacidad de 450 kg/u);
  assert.doesNotMatch(resolveReusableEditorial(partial).short ?? "", /450 kg/u);
});

test("las fuentes incompatibles no propagan texto a otras variantes", () => {
  const source = controlledGamForklift();
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, model: "MODELO99" },
    { ...source, url: "https://example.invalid/es/carretillas/CONTROL-03-carretilla-elevadora" },
    { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "2500 litros" } },
    { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "3500 kg" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveEditorialFacts(variant), null, String(index));
    assert.deepEqual(resolveReusableEditorial(variant), { short: null, general: null });
  }
});
