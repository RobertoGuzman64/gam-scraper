import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveSourcedUnitMeasuresGeneral } from "../domain/editorial-sourced-unit-measures.js";
import { controlledGamForklift, controlledGomarizForklift } from "./editorial-contract-records.js";

const original = (): ProductRecord => ({
  ...controlledGomarizForklift(),
  longDescription: "Equipo para las tareas de almacén y el transporte interno de cargas.",
  specs: {
    Capacidad: "2500 kg", "Altura de trabajo": "4,8 m", Longitud: "2,4 m",
    Anchura: "1,2 m", Peso: "3880 kg", Motor: "Eléctrico"
  }
});

test("la ficha breve recupera medidas propias corroboradas, sin alterar el origen", () => {
  const source = original();
  const before = JSON.stringify(source);
  const result = resolveSourcedUnitMeasuresGeneral(source, source, source.longDescription, true) ?? "";
  assert.match(result, /capacidad declarada de 2\.500 kg/u);
  assert.match(result, /longitud de 2,4 m/u);
  assert.match(result, /anchura de 1,2 m/u);
  assert.match(result, /peso declarado de 3\.880 kg/u);
  assert.match(result, /esta misma referencia/u);
  assert.equal(JSON.stringify(source), before);
  assert.match(prepareSourceProduct(source).product.description_general ?? "", /3\.880 kg/u);
});

test("la regla se aplica a otro proveedor compatible y no depende de referencias concretas", () => {
  const source: ProductRecord = {
    ...controlledGamForklift(),
    longDescription: "Equipo indicado para el transporte interno de mercancías.",
    specs: { Longitud: "2400 mm", Anchura: "1200 mm", Peso: "3880 kg" }
  };
  const description = resolveSourcedUnitMeasuresGeneral(source, source, source.longDescription, true) ?? "";
  assert.match(description, /longitud de 2,4 m/u);
  assert.match(description, /peso declarado de 3\.880 kg/u);
});

test("no añade medidas de otra unidad, proveedor, modelo o estado", () => {
  const source = original();
  const changed: readonly ProductRecord[] = [
    { ...source, reference: "CONTROL-OTRA" },
    { ...source, url: "https://www.gomarizrent.com/producto/otra-unidad/" },
    { ...source, providerId: "gam" },
    { ...source, model: "MODELO11", title: "Carretilla elevadora MARCA MODELO11" },
    { ...source, condition: "Nuevo" },
    { ...source, specs: { ...source.specs, Capacidad: "2000 kg" } }
  ];
  for (const candidate of changed) assert.equal(
    resolveSourcedUnitMeasuresGeneral(source, candidate, source.longDescription, source.providerId === candidate.providerId), null);
  assert.equal(resolveSourcedUnitMeasuresGeneral({ ...source, shortDescription: "Anuncio específico" },
    source, source.longDescription, true), null);
});

test("las medidas ambiguas, sin unidad o insuficientes no se completan por analogía", () => {
  const source = original();
  const invalid: readonly ProductRecord[] = [
    { ...source, specs: { Longitud: "variable", Anchura: "1,2 m", Peso: "1 kg" } },
    { ...source, specs: { Longitud: "2,4 m", Anchura: "1,2 metros opcional" } },
    { ...source, specs: { "Altura de trabajo": "4,8", Capacidad: "2500" } },
    { ...source, brand: "OTRA" }
  ];
  for (const candidate of invalid) assert.equal(
    resolveSourcedUnitMeasuresGeneral(candidate, candidate, candidate.longDescription, true), null);
  assert.equal(resolveSourcedUnitMeasuresGeneral({ ...source, longDescription: null }, source, source.longDescription, true), null);
});
