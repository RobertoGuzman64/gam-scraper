import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSpecsObject } from "../normalize-specs.js";
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
  assert.equal(normalizeOriginalEnergyPresentation({ Potencia: "4x120 W" }, { Potencia: "4x120 W" }).Potencia, "4x120 W");
});
