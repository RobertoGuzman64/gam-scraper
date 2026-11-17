import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveHeaderOnlyEditorialGeneral } from "../domain/editorial-header-only-general.js";
import { controlledGamForklift } from "./editorial-contract-records.js";

const sourceRecord = (): ProductRecord => ({
  ...controlledGamForklift(),
  url: "https://online.gamrentals.com/es/equipos/CONTROL-03-equipo-mastil",
  title: "Equipo elevador MARCA MODELO10",
  shortDescription: "Equipo elevador con accionamiento eléctrico y elevación por mástil descrito para el trabajo con cargas en altura.",
  longDescription: "Equipamiento Estándar:",
  specs: {
    Marca: "MARCA", Modelo: "MODELO10", "Altura de trabajo (m)": "4,5 metros",
    "Capacidad de carga (kg)": "400 kg", Longitud: "3600 mm", Anchura: "1650 mm",
    Peso: "3375 kg", "Dimensiones Cesta": "2,20x1,60 metros"
  }
});

test("el encabezado sin desglose recupera exclusivamente texto y medidas de su original", () => {
  const original = sourceRecord();
  const snapshot = JSON.stringify(original);
  const general = resolveHeaderOnlyEditorialGeneral(original, original) ?? "";
  assert.match(general, /400 kg/u);
  assert.match(general, /4,5 m/u);
  assert.match(general, /2,2 × 1,6 m/u);
  assert.match(general, /no se atribuye equipamiento adicional no documentado/u);
  assert.equal(JSON.stringify(original), snapshot);
  assert.match(prepareSourceProduct(original).product.description_general ?? "", /400 kg/u);
});

test("el origen con modelo acreditado conserva los datos sin inventar fabricante", () => {
  const original = sourceRecord();
  const withoutBrand: ProductRecord = {
    ...original,
    brand: null,
    title: "Equipo elevador MODELO10",
    specs: {
      Modelo: "MODELO10", "Altura de trabajo (m)": "4,5 metros",
      "Capacidad de carga (kg)": "400 kg", Longitud: "3600 mm", Anchura: "1650 mm",
      Peso: "3375 kg", "Dimensiones Cesta": "2,20x1,60 metros"
    }
  };
  const general = resolveHeaderOnlyEditorialGeneral(withoutBrand, withoutBrand) ?? "";
  assert.match(general, /Equipo elevador MODELO10/u);
  assert.doesNotMatch(general, /MARCA/u);
});

test("no recupera texto ante cambios de unidad, modelo, procedencia o fichas sin desglose técnico", () => {
  const original = sourceRecord();
  for (const changed of [
    { ...original, reference: "CONTROL-99" },
    { ...original, url: "https://online.gamrentals.com/es/equipos/CONTROL-99-equipo-mastil" },
    { ...original, model: "MODELO11", title: "Equipo elevador MARCA MODELO11" },
    { ...original, condition: "Nuevo" as const },
    { ...original, specs: { ...original.specs, "Capacidad de carga (kg)": "500 kg" } }
  ]) assert.equal(resolveHeaderOnlyEditorialGeneral(original, changed), null);
  for (const changed of [
    { ...original, longDescription: "Equipamiento Estándar: Horquillas especiales." },
    { ...original, shortDescription: null },
    { ...original, specs: { ...original.specs, Modelo: "OTRO" } },
    { ...original, specs: { Marca: "MARCA", Modelo: "MODELO10", Peso: "3375 kg" } }
  ]) assert.equal(resolveHeaderOnlyEditorialGeneral(changed, changed), null);
});
