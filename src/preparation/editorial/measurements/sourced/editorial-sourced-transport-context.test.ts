import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveSourcedOperationalSpecs } from "../../source/details/editorial-sourced-operational-specs.js";
import { controlledGamForklift } from "../../core/editorial-contract-records.js";

const semitrailer = (): ProductRecord => ({
  ...controlledGamForklift(),
  title: "Semiremolque góndola NOOTEBOOM MC0-4803",
  shortDescription: "Semiremolque góndola NOOTEBOOM MC0-4803",
  longDescription: "· 2 últimos ejes direccionales y el primero elevable · Piso móvil · Todas las zapatas y tambores cambiados en el 2024 · Pintada en el 2021 · Equipo matriculado, Itv al dia",
  brand: "NOOTEBOOM",
  model: "MC0-4803",
  reference: "6623",
  year: "2007",
  specs: { "Matrícula": "R-5319-BDK", "Año de fabricación": "2007" }
});

const platform = (): ProductRecord => ({
  ...controlledGamForklift(),
  title: "Platafora 4 ejes NOTEBOOM MCO",
  shortDescription: "Platafora 4 ejes NOTEBOOM MCO",
  longDescription: "· Equipo matriculado, ITV vigente hasta mayo 2026",
  brand: "NOOTEBOOM",
  model: "MCO",
  reference: "5710",
  year: "1999",
  specs: {
    Longitud: "17600 mm", Anchura: "2720 mm", Altura: "2550 mm", Peso: "21400 KG",
    "Matrícula": "BI-15494-VE", "Año de fabricación": "1999"
  }
});

test("recupera datos del semirremolque sin acreditar la ITV vigente", () => {
  const source = semitrailer();
  const snapshot = JSON.stringify(source);
  const result = resolveSourcedOperationalSpecs(source, source, source.longDescription, true) ?? "";
  assert.match(result, /R-5319-BDK/u);
  assert.match(result, /2007/u);
  assert.match(result, /comprobar su vigencia/u);
  assert.equal(JSON.stringify(source), snapshot);
});

test("recupera las medidas y la matrícula de la plataforma de cuatro ejes", () => {
  const source = platform();
  const result = resolveSourcedOperationalSpecs(source, source, source.longDescription, true) ?? "";
  assert.match(result, /longitud de 17,6 m/u);
  assert.match(result, /anchura de 2,72 m/u);
  assert.match(result, /altura de 2,55 m/u);
  assert.match(result, /peso declarado de 21\.400 kg/u);
  assert.match(result, /BI-15494-VE/u);
  assert.match(result, /1999/u);
  assert.match(result, /comprobar su vigencia/u);
});

test("rechaza datos de otras unidades, fuentes y variantes", () => {
  const source = platform();
  const otherRecords: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, reference: "6623" },
    { ...source, model: "MC0-4803" },
    { ...source, url: "https://online.gamrentals.com/es/otro-equipo" },
    { ...source, specs: { ...source.specs, "Matrícula": "R-5319-BDK" } },
    { ...source, specs: { ...source.specs, Longitud: "18000 mm" } },
    { ...source, condition: "Nuevo" }
  ];
  for (const prepared of otherRecords) {
    assert.equal(resolveSourcedOperationalSpecs(source, prepared, source.longDescription,
      prepared.providerId === source.providerId), null);
  }
  assert.equal(resolveSourcedOperationalSpecs(source, source, source.longDescription, false), null);
  assert.equal(resolveSourcedOperationalSpecs(source, source, "Anuncio ajeno a esta unidad.", true), null);
  assert.equal(resolveSourcedOperationalSpecs({ ...source, longDescription: "Equipo sin datos verificables." },
    source, source.longDescription, true), null);
});

test("atribuye el historial de transporte a una identidad corroborada sin certificar su vigencia", () => {
  const source: ProductRecord = {
    ...controlledGamForklift(),
    title: "Semiremolque MARCA MODELO10",
    shortDescription: "Semiremolque MARCA MODELO10",
    longDescription: "· Equipo matriculado, ITV indicada por el vendedor",
    year: "2015",
    specs: { "Matrícula": "CONTROL-TEST", "Año de fabricación": "2015" }
  };
  const result = resolveSourcedOperationalSpecs(source, source, source.longDescription, true) ?? "";
  assert.match(result, /El anuncio de MARCA MODELO10 registra matrícula/u);
  assert.match(result, /comprobar su vigencia/u);
  const uncertain: ProductRecord = { ...source, model: "MODELO11" };
  const unverified = resolveSourcedOperationalSpecs(uncertain, uncertain, uncertain.longDescription, true) ?? "";
  assert.match(unverified, /El anuncio registra matrícula/u);
  assert.doesNotMatch(unverified, /MODELO11/u);
});


test("conserva la configuración de ejes declarada sin atribuir carga útil ni vigencia documental", () => {
  const source: ProductRecord = {
    ...controlledGamForklift(),
    title: "Plataforma 4 ejes MARCA MODELO10", shortDescription: "Plataforma 4 ejes MARCA MODELO10",
    longDescription: "· Equipo matriculado, ITV indicada por el vendedor", year: "2015",
    specs: { Longitud: "12000 mm", Anchura: "2500 mm", Peso: "8000 kg", "Matrícula": "CONTROL-TEST", "Año de fabricación": "2015" }
  };
  const result = resolveSourcedOperationalSpecs(source, source, source.longDescription, true) ?? "";
  assert.match(result, /El título del vendedor identifica una plataforma de cuatro ejes/u);
  assert.doesNotMatch(result, /carga útil/u);
  const mentioned = resolveSourcedOperationalSpecs(source, source, `${source.longDescription} Plataforma de cuatro ejes.`, true) ?? "";
  assert.doesNotMatch(mentioned, /El título del vendedor identifica/u);
  assert.equal(resolveSourcedOperationalSpecs(source, { ...source, reference: "OTRA" }, source.longDescription, true), null);
});
