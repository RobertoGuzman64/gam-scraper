import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { controlledGomarizPlatform } from "../../editorial/core/editorial-contract-records.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { hasGamAssertedSourceSafetyControl, recoverGamSourceSafetyControls } from "./source-safety-controls-evidence.js";

const source = (claim: string): ProductRecord => ({
  ...controlledGomarizPlatform(), providerId: "gam", categoryKey: "elevacion-nueva", categoryName: "Elevación",
  condition: "Nuevo", reference: "999999999", url: "https://online.gamrentals.com/es/plataformas-tijera/999999999-marca-modelo10",
  shortDescription: "Plataforma de tijera MARCA MODELO10", longDescription: `La plataforma MARCA MODELO10 es eléctrica. ${claim}`,
  specs: { Marca: "MARCA", Modelo: "MODELO10", "Altura de elevación (m)": "10 m", "Capacidad de carga (kg)": "450 kg", "Tipo motor": "Eléctrico" }
});

const recover = (record: ProductRecord) => recoverGamSourceSafetyControls(record, record.specs ?? {});

test("recupera las formas equivalentes de frenado automático en la clave existente", () => {
  for (const claim of ["Dispone de freno automático.", "Incorpora frenos automáticos.", "Cuenta con frenado automático."]) {
    const record = source(claim);
    const snapshot = structuredClone(record);
    const result = recover(record);
    assert.equal(result["Frenado automático"], true);
    assert.equal(hasGamAssertedSourceSafetyControl(record, "Frenado automático"), true);
    assert.equal(recoverGamSourceSafetyControls(record, result), result);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Frenado automático"], true);
    const provenance = prepared.technicalProvenance?.entries.find((entry) => entry.field === "Frenado automático");
    assert.equal(provenance?.scope, "unit");
    assert.equal(provenance?.sourceField, "longDescription");
    assert.equal(provenance?.sourceValue, record.longDescription);
    assert.deepEqual(record, snapshot);
  }
});

test("rechaza freno opcional, negado, desactivado, comparativo o sin identidad corroborada", () => {
  for (const claim of ["Puede equipar freno automático.", "No incluye freno automático.", "Carece de freno automático.",
    "Freno automático opcional.", "Freno automático desactivado.", "Otros modelos disponen de frenos automáticos.", "La MARCA MODELO20 dispone de freno automático.",
    "Dispone de freno automático. No lleva freno automático.", "Dispone de frenos manuales."]) {
    const record = source(claim);
    assert.equal(recover(record), record.specs);
    assert.equal(hasGamAssertedSourceSafetyControl(record, "Frenado automático"), false);
  }
  const record = source("Dispone de freno automático.");
  for (const invalid of [
    { ...record, shortDescription: "MARCA MODELO10 sin freno automático." },
    { ...record, shortDescription: "MARCA MODELO20" },
    { ...record, longDescription: "La plataforma MARCA MODELO20 dispone de freno automático." },
    { ...record, url: record.url.replace("modelo10", "modelo20") },
    { ...record, specs: { ...record.specs, "Frenado automático": false } },
    { ...record, specs: { ...record.specs, "Sistema de frenos": "Manual" } }
  ]) assert.equal(recover(invalid), invalid.specs);
});

const curveSource = (claim: string): ProductRecord => ({
  ...source(claim), categoryKey: "apiladores-nuevos", categoryName: "Manutención",
  title: "Apilador eléctrico MARCA MODELO10", shortDescription: "Apilador eléctrico MARCA MODELO10",
  url: "https://online.gamrentals.com/es/apiladores/999999999-marca-modelo10",
  longDescription: `El apilador eléctrico MARCA MODELO10. ${claim}`
});

test("recupera la reducción de velocidad en curvas declarada en manutención", () => {
  const key = "Reducción de velocidad en curvas";
  for (const claim of ["Dispone de un sistema de velocidad reducida en las curvas.",
    "Incorpora reducción de velocidad en curvas.", "Cuenta con reducción automática de velocidad en curvas."]) {
    const record = curveSource(claim);
    const snapshot = structuredClone(record);
    const result = recover(record);
    assert.equal(result[key], true);
    assert.equal(hasGamAssertedSourceSafetyControl(record, key), true);
    assert.equal(recoverGamSourceSafetyControls(record, result), result);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[key], true);
    const provenance = prepared.technicalProvenance?.entries.find((entry) => entry.field === key);
    assert.equal(provenance?.scope, "unit");
    assert.equal(provenance?.sourceField, "longDescription");
    assert.equal(provenance?.sourceValue, record.longDescription);
    assert.deepEqual(record, snapshot);
  }
});

test("no recupera la reducción en curvas opcional, negada, contradictoria o de otra variante", () => {
  const key = "Reducción de velocidad en curvas";
  for (const claim of ["Puede incorporar reducción de velocidad en curvas.", "No dispone de reducción de velocidad en curvas.",
    "Reducción de velocidad en curvas opcional.", "Reducción de velocidad en curvas desactivada.",
    "Otros modelos disponen de reducción de velocidad en curvas.", "La MARCA MODELO20 dispone de reducción de velocidad en curvas.",
    "Dispone de reducción de velocidad en curvas. Carece de reducción de velocidad en curvas.",
    "Según configuración incorpora reducción de velocidad en curvas.", "Velocidad máxima de 8 km/h."]) {
    const record = curveSource(claim);
    assert.equal(recover(record), record.specs);
    assert.equal(hasGamAssertedSourceSafetyControl(record, key), false);
  }
  const record = curveSource("Dispone de reducción de velocidad en curvas.");
  for (const invalid of [
    { ...record, shortDescription: "MARCA MODELO10 sin reducción de velocidad en curvas." },
    { ...record, shortDescription: "MARCA MODELO20" },
    { ...record, categoryKey: "elevacion-nueva" },
    { ...record, specs: { ...record.specs, [key]: false } },
    { ...record, specs: { ...record.specs, "Velocidad reducida en curvas": false } }
  ]) assert.equal(recover(invalid), invalid.specs);
});
