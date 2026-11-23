import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { reconcileGamSourceTechnicalUnits, reconcileGamSpreadsheetLiftHeight } from "../../../../preparation/gam/technical/reconciliation/gam-source-technical-units.js";
import { controlledGamForklift } from "../../../../preparation/shared/editorial/tests/editorial-contract-records.js";

const source = (specs: SpecsMap): ProductRecord => ({ ...controlledGamForklift(), specs });

test("normaliza unidades técnicas duplicadas sin alterar otras especificaciones", () => {
  const record = source({
    "Centro de carga": "500mm mm",
    "Altura Plataforma": "6085mm metros",
    "Alcance Lateral": "8,5 m metros",
    "Capacidad de carga (kg)": "2500 kg"
  });
  const before = structuredClone(record);
  const normalized = reconcileGamSourceTechnicalUnits(record);
  assert.deepEqual(normalized.specs, {
    "Centro de carga": "500 mm",
    "Altura Plataforma": "6085 mm",
    "Alcance Lateral": "8,5 m",
    "Capacidad de carga (kg)": "2500 kg"
  });
  assert.deepEqual(record, before);
  assert.deepEqual(reconcileGamSourceTechnicalUnits(normalized), normalized);
});

test("preserva las alturas ambiguas y los centros de carga con unidades incompatibles", () => {
  for (const [name, value] of [
    ["Altura Plataforma", "4.8mm metros"],
    ["Altura Plataforma", "500/600/700/800mm metros"],
    ["Centro de carga", "500 mm cm"],
    ["Centro de carga", "500 kg mm"],
    ["Alcance Lateral", "8,5 m metros adicionales"]
  ] as const) {
    const record = source({ [name]: value });
    assert.strictEqual(reconcileGamSourceTechnicalUnits(record), record, `${name}: ${value}`);
  }
});

test("rechaza capacidades de batería escritas en horas y conserva únicamente el voltaje comprobable", () => {
  const record = source({ "Capacidad de la batería": "24V / 240h(V/Ah)" });
  const result = reconcileGamSourceTechnicalUnits(record);
  assert.deepEqual(result.specs, { "Voltaje batería (V)": "24 V" });
  assert.equal(record.specs?.["Capacidad de la batería"], "24V / 240h(V/Ah)");
  assert.deepEqual(reconcileGamSourceTechnicalUnits(result), result);
});

test("no sobrescribe un voltaje existente contradictorio", () => {
  const record = source({
    "Capacidad de la batería": "24V / 240h(V/Ah)",
    "Voltaje batería (V)": "48 V"
  });
  assert.strictEqual(reconcileGamSourceTechnicalUnits(record), record);
  assert.deepEqual(reconcileGamSourceTechnicalUnits(record).specs, record.specs);
});

test("retira únicamente el sufijo duplicado en capacidades de batería expresadas en amperios-hora", () => {
  const record = source({
    "Capacidad de la batería": "24V / 465Ah(V/Ah)(V/Ah)",
    "Anchura": "1056 mm"
  });
  const normalized = reconcileGamSourceTechnicalUnits(record);
  assert.deepEqual(normalized.specs, {
    "Capacidad de la batería": "24V / 465Ah(V/Ah)",
    "Anchura": "1056 mm"
  });
  assert.deepEqual(reconcileGamSourceTechnicalUnits(normalized), normalized);
});

test("descarta errores de hoja de cálculo sin inventar medidas", () => {
  const record = source({
    "Altura de elevación (mm)": "#VALUE! mm",
    "Centro de carga": "500 mm"
  });
  const normalized = reconcileGamSpreadsheetLiftHeight(record);
  assert.deepEqual(normalized.specs, { "Centro de carga": "500 mm" });
  assert.deepEqual(record.specs?.["Altura de elevación (mm)"], "#VALUE! mm");
  for (const value of ["#VALUE! mm adicionales", "1200 mm"]) {
    const unchanged = source({ "Altura de elevación (mm)": value });
    assert.strictEqual(reconcileGamSpreadsheetLiftHeight(unchanged), unchanged);
  }
});

test("las reconciliaciones técnicas de GAM no afectan a otros proveedores", () => {
  const gam = source({
    "Centro de carga": "500mm mm",
    "Capacidad de la batería": "24V / 240h(V/Ah)"
  });
  for (const providerId of ["gomariz", "mercaeleva"]) {
    const external = { ...gam, providerId };
    assert.strictEqual(reconcileGamSourceTechnicalUnits(external), external);
  }
});
