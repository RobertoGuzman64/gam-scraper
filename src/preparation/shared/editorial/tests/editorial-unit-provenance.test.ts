import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { sameEditorialUnit } from "../domain/editorial-source-contract.js";
import { verifiedEditorialUnitPair } from "../domain/editorial-unit-provenance.js";
import { resolveVerifiedTechnicalBrief } from "../domain/editorial-technical-brief.js";
import { resolveVerifiedEditorialUnitContext } from "../domain/editorial-unit-context.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { resolveAssertedBatteryVoltage } from "../domain/editorial-battery-claims.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift
} from "./editorial-contract-records.js";

const factories = [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift];
const general = "La ficha técnica identifica las prestaciones verificables del equipo.";

const sourced = (record: ProductRecord): ProductRecord => ({
  ...record,
  location: "Madrid",
  serialNumber: "SN012345",
  longDescription: `La carretilla ${record.brand} ${record.model} declara parada de emergencia y batería de 48 V.`,
  specs: {
    ...record.specs,
    Ubicación: "Madrid",
    "Nº de serie": "SN012345",
    Peso: "2400 kg",
    Longitud: "2,8 m",
    "Voltaje de la batería": "48 V",
    "Parada de emergencia": true
  }
});

test("las tres procedencias autorizan solo la unidad exacta con evidencia técnica", () => {
  for (const factory of factories) {
    const source = sourced(factory());
    const original = JSON.stringify(source);
    assert.equal(sameEditorialUnit(source, source), true, source.providerId);
    assert.equal(verifiedEditorialUnitPair(source, source), true, source.providerId);
    assert.match(resolveVerifiedTechnicalBrief(source, source) ?? "", /peso declarado de 2\.400 kg/u, source.providerId);
    assert.match(resolveVerifiedEditorialUnitContext(source, general) ?? "", /Número de serie declarado para esta unidad: SN012345/u);
    assert.match(resolveSourceEditorialClaims(source, source, general) ?? "", /declara parada de emergencia/u);
    assert.match(resolveAssertedBatteryVoltage(source, source, general) ?? "", /48 V/u);
    assert.equal(JSON.stringify(source), original);
  }
});

test("ninguna capacidad reaprovecha un proveedor, referencia, condición o variante ajenos", () => {
  for (const factory of factories) {
    const source = sourced(factory());
    const different: readonly ProductRecord[] = [
      { ...source, providerId: source.providerId === "gam" ? "gomariz" : "gam" },
      { ...source, reference: "OTRA-UNIDAD" },
      { ...source, reference: "" },
      { ...source, reference: null },
      { ...source, url: `${source.url}?referencia=otra` },
      { ...source, model: "MODELO100" },
      { ...source, brand: "OTRA-MARCA" },
      { ...source, condition: source.condition === "Nuevo" ? "Segunda mano" : "Nuevo" }
    ];
    for (const [index, prepared] of different.entries()) {
      assert.equal(verifiedEditorialUnitPair(source, prepared), false, `${source.providerId}:${index}`);
      assert.equal(resolveVerifiedTechnicalBrief(source, prepared), null, `${source.providerId}:${index}`);
      assert.equal(resolveVerifiedEditorialUnitContext(source, general, prepared), general, `${source.providerId}:${index}`);
      assert.equal(resolveSourceEditorialClaims(source, prepared, general), general, `${source.providerId}:${index}`);
      assert.equal(resolveAssertedBatteryVoltage(source, prepared, general), null, `${source.providerId}:${index}`);
    }
  }
});

test("la autenticidad se verifica también en la ficha reconciliada y no solo en el origen", () => {
  for (const factory of factories) {
    const source = sourced(factory());
    const unauthorized = { ...source, title: "Carretilla OTRA-MARCA MODELO100" };
    assert.equal(verifiedEditorialUnitPair(source, unauthorized), false, source.providerId);
    assert.equal(resolveVerifiedEditorialUnitContext(source, general, unauthorized), general);
    assert.equal(resolveVerifiedTechnicalBrief(source, unauthorized), null);
    const divergentMeasures = { ...source, specs: { ...source.specs, Peso: "2500 kg", "Voltaje de la batería": "72 V" } };
    assert.equal(verifiedEditorialUnitPair(source, divergentMeasures), true);
    assert.equal(resolveVerifiedTechnicalBrief(source, divergentMeasures), null);
    assert.equal(resolveAssertedBatteryVoltage(source, divergentMeasures, general), null);
  }
});
