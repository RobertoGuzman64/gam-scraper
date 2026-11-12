import assert from "node:assert/strict";
import test from "node:test";
import { recoverMercaelevaDescriptionSpecs } from "../../../../../scraping/providers/mercaeleva/technical-description.js";

test("Mercaeleva: recupera mástil explícito único y rechaza configuraciones alternativas", () => {
  const specs: Record<string, string> = {};
  recoverMercaelevaDescriptionSpecs(specs, "Ref. MER0604 CARRETILLA DIESEL MÁSTIL TRÍPLEX ALTURA DE TRABAJO 5.400 mm", "CARRETILLA DIESEL");
  assert.equal(specs["Tipo de mástil"], "TRÍPLEX");
  const multi: Record<string, string> = {};
  recoverMercaelevaDescriptionSpecs(multi, "CARRETILLA MÁSTIL DÚPLEX O TRÍPLEX", "CARRETILLA ELEVADORA");
  assert.equal(multi["Tipo de mástil"], undefined);
  const existing: Record<string, string> = { "Tipo de mástil": "Dúplex" };
  recoverMercaelevaDescriptionSpecs(existing, "CARRETILLA MÁSTIL TRÍPLEX", "CARRETILLA ELEVADORA");
  assert.equal(existing["Tipo de mástil"], "Dúplex");
});

test("Mercaeleva: acepta capacidad única concordante sin reemplazar datos ni pesos", () => {
  const correct: Record<string, string> = {};
  recoverMercaelevaDescriptionSpecs(correct, "TRANSPALET CAPACIDAD DE CARGA 2.000 KG", "TRANSPALET ELECTRICO 2000 KG");
  assert.equal(correct["Capacidad de carga"], "2.000 kg");
  const conflict: Record<string, string> = {};
  recoverMercaelevaDescriptionSpecs(conflict, "CARRETILLA CAPACIDAD 2500 KG", "CARRETILLA ELEVADORA 3000 KG");
  assert.equal(conflict["Capacidad de carga"], undefined);
  const options: Record<string, string> = {};
  recoverMercaelevaDescriptionSpecs(options, "CARRETILLA CAPACIDAD 2500 KG O 3000 KG", "CARRETILLA ELEVADORA");
  assert.equal(options["Capacidad de carga"], undefined);
  const existing: Record<string, string> = { "Capacidad máxima de elevación": "2500 kg" };
  recoverMercaelevaDescriptionSpecs(existing, "CARRETILLA CAPACIDAD 3000 KG", "CARRETILLA ELEVADORA 3000 KG");
  assert.equal(existing["Capacidad de carga"], undefined);
  assert.equal(existing["Capacidad máxima de elevación"], "2500 kg");
});
