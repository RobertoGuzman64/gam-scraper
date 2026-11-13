import assert from "node:assert/strict";
import test from "node:test";
import { resolveGomarizEditorialDomainSource } from "../../../gomariz/editorial/mapping/domain-source.js";
import { sourceEditorialMeasurement } from "../domain/source-measurement.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { controlledGomarizPlatform, controlledMercaelevaPlatform } from "./editorial-contract-records.js";

test("el compositor preserva solo magnitudes acreditadas de cada fuente", () => {
  const detailed = controlledGomarizPlatform();
  const partial = controlledMercaelevaPlatform();
  assert.equal(resolveEditorialFacts(detailed)?.family, "plataforma-tijera");
  assert.equal(resolveEditorialFacts(partial)?.family, "plataforma-tijera");
  assert.match(resolveReusableEditorial(detailed).short ?? "", /450 kg/u);
  assert.doesNotMatch(resolveReusableEditorial(partial).short ?? "", /450 kg/u);
  const invalid = { ...detailed, specs: { ...detailed.specs, Capacidad: "450 litros" } };
  assert.equal(resolveEditorialFacts(invalid), null);
});

test("la interpretación de ruta del proveedor permanece separada del compositor", () => {
  const base = controlledGomarizPlatform();
  const fromCategory = { ...base, url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/brazo-articulado/marca-modelo10/" };
  const resolved = resolveGomarizEditorialDomainSource(fromCategory);
  if (!resolved) throw new Error("Origen Gomariz incompatible con el contrato editorial");
  assert.match(resolved.familyClues, /brazo-articulado/u);
  assert.ok(resolveGomarizEditorialDomainSource(base));
  assert.equal(resolveGomarizEditorialDomainSource({ ...fromCategory, providerId: "gam" }), null);
  assert.equal(resolveGomarizEditorialDomainSource({ ...fromCategory, url: "https://example.invalid/venta/elevacion-y-trabajos-en-altura/brazo-articulado/marca-modelo10/" }), null);
});

test("parser único de magnitudes rechaza unidades, cifras y precisión incompatibles", () => {
  assert.equal(sourceEditorialMeasurement("12.30 m", "m"), "12,30");
  assert.equal(sourceEditorialMeasurement("450 kg", "kg"), "450");
  assert.equal(sourceEditorialMeasurement("15 kVA", "kVA"), "15");
  assert.equal(sourceEditorialMeasurement("220 V", "V"), "220");
  for (const value of ["0 m", "12 kg", "12.300 m", "12m extra", "NaN m", "-1 m", 12]) {
    assert.equal(sourceEditorialMeasurement(value, "m"), null);
  }
});
