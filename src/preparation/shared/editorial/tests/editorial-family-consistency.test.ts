import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveDocumentedFamilyTitle } from "../domain/editorial-documented-title.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveConsistentEditorialFamily } from "../domain/editorial-families.js";
import { resolveEditorialIdentitySummary } from "../domain/editorial-identity-summary.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledGomarizPlatform,
  controlledMercaelevaForklift, controlledMercaelevaPlatform
} from "./editorial-contract-records.js";

const withAdditional = (record: ProductRecord, additional: string): ProductRecord => ({
  ...record, specs: { ...record.specs, "Título adicional": additional }
});

test("una familia adicional incompatible no se convierte en prosa técnica ni resumen", () => {
  for (const source of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const before = JSON.stringify(source);
    const conflicting = withAdditional(source, "TRANSPALETA ELÉCTRICA");
    assert.equal(resolveEditorialFacts(conflicting), null, source.providerId);
    assert.equal(resolveEditorialIdentitySummary(conflicting, null), null, source.providerId);
    assert.deepEqual(resolveReusableEditorial(conflicting), { short: null, general: null });
    assert.equal(resolveEditorialFacts(source)?.family, "carretilla-elevadora");
    assert.equal(JSON.stringify(source), before);
  }
  for (const source of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const conflicting = withAdditional(source, "PLATAFORMA ARTICULADA");
    assert.equal(resolveEditorialFacts(conflicting), null);
    assert.deepEqual(resolveReusableEditorial(conflicting), { short: null, general: null });
    assert.equal(resolveEditorialFacts(source)?.family, "plataforma-tijera");
  }
});

test("el conocimiento de modelo no puede imponer una familia contradictoria", () => {
  for (const source of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    assert.equal(resolveEditorialFacts(source, "plataforma-articulada"), null);
    assert.equal(resolveEditorialIdentitySummary(source, "plataforma-articulada"), null);
    assert.equal(resolveEditorialFacts(source, "carretilla-elevadora")?.family, "carretilla-elevadora");
  }
});

test("una declaración adicional incompatible con la categoría de procedencia no acredita la composición", () => {
  const source = controlledGomarizForklift();
  const crossed: ProductRecord = {
    ...source,
    url: "https://www.gomarizrent.com/venta/energia-electrica-e-iluminacion/generador/marca-modelo10/",
    specs: { ...source.specs, "Título adicional": "CARRETILLA ELEVADORA" }
  };
  assert.equal(resolveEditorialFacts(crossed), null);
  assert.equal(resolveEditorialIdentitySummary(crossed, null), null);
  assert.deepEqual(resolveReusableEditorial(crossed), { short: null, general: null });
});

test("familias compatibles de plataforma sobre orugas y de carretilla retráctil conservan la composición", () => {
  assert.equal(resolveConsistentEditorialFamily(
    "plataforma de tijera eléctrica sobre orugas", "plataforma de tijera sobre orugas",
    "plataforma sobre orugas", "", null
  ), "plataforma-tijera");
  assert.equal(resolveConsistentEditorialFamily(
    "carretilla elevadora", "carretilla retráctil", "carretilla elevadora", "", null
  ), "carretilla-elevadora");
  assert.equal(resolveConsistentEditorialFamily(
    "plataforma de tijera", "plataforma de tijera", "plataforma telescópica", "", null
  ), null);
  assert.equal(resolveConsistentEditorialFamily(
    "plataforma de tijera", "plataforma de tijera", "plataforma de tijera", "", "plataforma-articulada"
  ), null);
});

test("los títulos documentados no sobreescriben familias adicionales incompatibles", () => {
  const source: ProductRecord = {
    ...controlledGomarizPlatform(),
    url: "https://www.gomarizrent.com/venta/energia-electrica-e-iluminacion/generador/marca-modelo10/",
    title: "MARCA MODELO10",
    longDescription: "El grupo electrógeno MARCA MODELO10 proporciona energía para trabajos de campo.",
    specs: { Marca: "MARCA", Modelo: "MODELO10" }
  };
  assert.equal(resolveDocumentedFamilyTitle(source), "Grupo electrógeno MARCA MODELO10");
  assert.equal(resolveDocumentedFamilyTitle(withAdditional(source, "PLATAFORMA ARTICULADA")), null);
});
