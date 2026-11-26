import assert from "node:assert/strict";
import test from "node:test";
import type { SpecsMap } from "../../../contracts/catalog.js";
import { normalizeSpecsObject, reconcileSourceBatteryConfiguration } from "../normalize-specs.js";
import { normalizeBatteryChemistryLabel, parseExplicitPowerPresentation } from "../spec-parsers.js";
import { normalizeOriginalEnergyPresentation } from "../../../preparation/technical/technical-presentation.js";

test("la tensión genérica conserva su significado sin atribuirla a la batería", () => {
  const input = { Voltios: "400/230 v", Voltaje: "230 V", "Voltaje batería (V)": "48 V" };
  const normalized = normalizeSpecsObject(input).normalized;
  assert.deepEqual(normalized, { Voltios: [400, 230], Voltaje: [230], "Voltaje batería (V)": 48 });
  assert.deepEqual(normalizeSpecsObject(normalized).normalized, normalized);
  assert.deepEqual(normalizeOriginalEnergyPresentation(input, input), { ...input, Voltios: "400 / 230 V" });
  for (const raw of ["400/230 A", "400/230 V opcional", "400-230 V", "400/0 V", "400/230/120 V", "400/230 v v"]) {
    assert.equal(normalizeSpecsObject({ Voltios: raw }).normalized.Voltios, undefined);
  }
});

test("la química explícita no convierte denominaciones generales en tecnologías más específicas", () => {
  for (const [raw, expected] of [["Batería de plomo", "Plomo"], ["Plomo-ácido", "Plomo-ácido"], ["Batería de litio", "Litio"], ["Li-ion", "Ion-litio"], ["Baterías AGM", "AGM"]] as const) {
    const input = { "Tipo de batería": raw };
    assert.equal(normalizeBatteryChemistryLabel(raw), expected);
    assert.equal(normalizeSpecsObject(input).normalized["Tipo de batería"], expected);
    assert.equal(normalizeOriginalEnergyPresentation(input, input)["Tipo de batería"], expected);
    assert.equal(normalizeBatteryChemistryLabel(expected), expected);
  }
  for (const raw of ["Plomo / litio", "Litio opcional", "Li-ion 48 V 15 Ah", "Sin baterías", "Plomo o AGM"]) {
    assert.equal(normalizeBatteryChemistryLabel(raw), raw);
  }
  assert.equal(normalizeOriginalEnergyPresentation({ "Tipo de batería": "Batería de plomo" }, {})["Tipo de batería"], "Batería de plomo");
});

test("la potencia explícita mantiene unidad y multiplicidad sin calcular totales", () => {
  for (const [raw, expected] of [["35kva", "35 kVA"], ["4x120 W", "4 x 120 W"], ["4 x 2.5kW", "4 x 2,5 kW"], ["3,5 cv", "3,5 CV"]] as const) {
    assert.equal(parseExplicitPowerPresentation(raw), expected);
    assert.equal(normalizeSpecsObject({ Potencia: raw }).normalized.Potencia, expected);
    assert.equal(parseExplicitPowerPresentation(expected), expected);
  }
  for (const raw of ["35", "35 A", "35 kW kVA", "35 / 40 kVA", "4 x 2 x 3 W", "4 x 2.500 W", "-35 kW", "150kva kva"]) {
    assert.equal(normalizeSpecsObject({ Potencia: raw }).normalized.Potencia, undefined);
  }
  assert.equal(normalizeOriginalEnergyPresentation({ Potencia: "4x120 W" }, { Potencia: "4x120 W" }).Potencia, "4 x 120 W");
});


test("la potencia declarada conserva multiplicidades y pares sin elegir ni calcular un total", () => {
  const key = "Potencia (kW)";
  for (const [raw, expected] of [["2x4,3", "2 x 4,3 kW"], ["2 × 6.5 kW", "2 x 6,5 kW"], ["62.17 / 56.37", "62,17 / 56,37 kW"]] as const) {
    const normalized = normalizeSpecsObject({ "Potencia Motor (KW)": raw }).normalized;
    assert.deepEqual(normalized, { [key]: expected });
    assert.deepEqual(normalizeSpecsObject(normalized).normalized, normalized);
    assert.equal(normalizeOriginalEnergyPresentation({ [key]: raw }, { [key]: raw })[key], expected);
  }
  for (const raw of ["2x12x5", "2x4,3 kVA", "30 / 40 CV", "2x4,3 / 2x6,5", "0x10", "2x4.300", "30 opcional"]) {
    assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], undefined);
    assert.equal(normalizeOriginalEnergyPresentation({ [key]: raw }, { [key]: raw })[key], raw);
  }
  assert.deepEqual(normalizeSpecsObject({ [key]: "25 kW" }).normalized[key], [25]);
  assert.deepEqual(normalizeSpecsObject({ [key]: "2x4,3", "Potencia Motor (KW)": "8,6" }).conflictingKeys.map(({ key }) => key), [key]);
});


test("las categorías de energía inequívocas son comparables sin fusionar campos ni alternativas", () => {
  const input = { "Tipo de motor": "DIESEL", "Tipo motor": "LPG", Motorización: "Gasoil", Combustible: "GASOLINA" };
  const expected = { "Tipo de motor": "Diésel", "Tipo motor": "GLP", Motorización: "Diésel", Combustible: "Gasolina" };
  assert.deepEqual(normalizeSpecsObject(input).normalized, expected);
  assert.deepEqual(normalizeSpecsObject(expected).normalized, expected);
  assert.deepEqual(normalizeOriginalEnergyPresentation(input, input), expected);
  assert.deepEqual(normalizeSpecsObject({ "Tipo de motor": "Diesel / GLP", "Tipo motor": "Kubota Diesel", Combustible: "Gasolina opcional" }).normalized,
    { "Tipo de motor": "Diesel / GLP", "Tipo motor": "Kubota Diesel", Combustible: "Gasolina opcional" });
  assert.deepEqual(normalizeSpecsObject({ "Tipo de motor": "Diesel", "TIPO DE MOTOR": "Diésel" }).conflictingKeys, []);
  assert.equal(normalizeSpecsObject({ "Tipo de motor": "Diesel", "TIPO DE MOTOR": "GLP" }).conflictingKeys.length, 1);
});

test("el estado y la sustitución de baterías son independientes de su capacidad y autonomía", () => {
  const input = { "Estado de las baterías": "80%", "Baterias nuevas": "SIN BATERÍAS", "Capacidad de la batería (Ah)": "735–875 Ah" };
  const expected = { "Estado baterías": "80 %", "Baterías nuevas": "Sin baterías", "Capacidad de la batería (Ah)": "735-875 Ah" };
  assert.deepEqual(normalizeSpecsObject(input).normalized, expected);
  assert.deepEqual(normalizeSpecsObject(expected).normalized, expected);
  for (const value of ["101%", "80-90%", "80 Ah", "80% opcional"]) {
    assert.equal(normalizeSpecsObject({ "Estado baterías": value }).normalized["Estado baterías"], value);
  }
  for (const value of ["875-735 Ah", "0-875 Ah", "735-875 A", "735-875", "735-875 Ah opcional"]) {
    assert.equal(normalizeSpecsObject({ "Capacidad de la batería (Ah)": value }).normalized["Capacidad de la batería (Ah)"], undefined);
  }
  assert.equal(normalizeSpecsObject({ "Baterias nuevas": "No" }).normalized["Baterías nuevas"], "No");
  assert.equal(normalizeSpecsObject({ "Baterias nuevas": "Sí / No" }).normalized["Baterías nuevas"], "Sí / No");
});

test("el fabricante y año de batería no sustituyen los del equipo ni la potencia ESP a la nominal", () => {
  const input = { Marca: "Equipo", Año: "2012", "Marca de la batería": "Fabricante A", "Marca del cargador": "Fabricante B", "Año de fabricación de la batería": "2024", "Potencia de emergencia ESP": "45 kva", "Potencia (kW)": "32 kW" };
  const expected = { ...input, Año: 2012, "Año de fabricación de la batería": 2024, "Potencia de emergencia ESP": "45 kVA", "Potencia (kW)": [32] };
  assert.deepEqual(normalizeSpecsObject(input).normalized, expected);
  assert.deepEqual(normalizeSpecsObject(expected).normalized, expected);
  assert.equal(normalizeSpecsObject({ "Año de fabricación de la batería": "2024/2025" }).normalized["Año de fabricación de la batería"], undefined);
  assert.equal(normalizeSpecsObject({ "Potencia de emergencia ESP": "45 Ah" }).normalized["Potencia de emergencia ESP"], undefined);
});


test("la reconciliación de configuración de batería exige la misma evidencia y ausencia de datos competidores", () => {
  const source = { "Capacidad de la batería": "24 V / 315-375 Ah" };
  const target = "Batería (V / Ah)";
  const expected = { [target]: "24 V / 315-375 Ah" };
  assert.deepEqual(reconcileSourceBatteryConfiguration(source, source), {
    specs: expected, rename: { from: "Capacidad de la batería", to: target }
  });
  assert.deepEqual(normalizeOriginalEnergyPresentation(source, source), expected);
  assert.deepEqual(reconcileSourceBatteryConfiguration(source, {}).specs, source);
  assert.deepEqual(reconcileSourceBatteryConfiguration(source, { "Capacidad de la batería": "24 V / 300 Ah" }).specs, source);
  for (const conflicting of [
    { ...source, [target]: "24 V / 300 Ah" },
    { ...source, "Capacidad batería (Ah)": "300 Ah" },
    { ...source, Batería: "48 V / 500 Ah" },
    { ...source, "Capacidad bateria": "24 V / 400 Ah" }
  ]) {
    assert.deepEqual(reconcileSourceBatteryConfiguration(conflicting, conflicting), { specs: conflicting, rename: null });
    assert.deepEqual(reconcileSourceBatteryConfiguration(source, conflicting), { specs: source, rename: null });
  }
  const explicitCapacity = { "Capacidad de la batería (Ah)": "24 V / 315 Ah" };
  assert.deepEqual(reconcileSourceBatteryConfiguration(explicitCapacity, explicitCapacity), { specs: explicitCapacity, rename: null });
});


test("la química de batería acreditada adopta la clave común sin confundir tecnologías", () => {
  for (const [key, raw, expected] of [["Tipo de Batería", "Li-ion", "Ion-litio"],
    ["Tipo bateria", "Plomo-ácido", "Plomo-ácido"], ["TIPO DE BATERIA", "Gel", "Gel"],
    ["Tipo de Batería", "Batería de litio", "Litio"]] as const) {
    const original: SpecsMap = { [key]: raw, "Voltaje del cargador": "24 V" };
    const changes: string[] = [];
    const result = normalizeOriginalEnergyPresentation(original, original, (_before, _after, _mechanism, field) => {
      if (typeof field === "object") changes.push(field.spec);
    });
    assert.deepEqual(result, { "Voltaje del cargador": "24 V", "Tipo de batería": expected });
    assert.deepEqual(changes, [key]);
    assert.equal(normalizeOriginalEnergyPresentation(result, original), result);
    assert.equal(original[key], raw);
  }
});

test("la química de batería no renombra opciones, conflictos ni valores sin respaldo de origen", () => {
  for (const raw of ["Plomo / litio", "Litio opcional", "Sin baterías", "Li-ion 48 V 15 Ah"]) {
    const input = { "Tipo de Batería": raw };
    assert.equal(normalizeOriginalEnergyPresentation(input, input), input);
  }
  const original = { "Tipo de Batería": "Li-ion" };
  const conflict = { ...original, "Tipo de batería": "Gel" };
  assert.deepEqual(normalizeOriginalEnergyPresentation(conflict, original), { ...conflict, "Tipo de Batería": "Ion-litio" });
  assert.deepEqual(normalizeOriginalEnergyPresentation(original, conflict), { "Tipo de Batería": "Ion-litio" });
  const recovered = { "Tipo de Batería": "Gel" };
  assert.equal(normalizeOriginalEnergyPresentation(recovered, original), recovered);
  assert.equal(normalizeOriginalEnergyPresentation(original, {}), original);
});
