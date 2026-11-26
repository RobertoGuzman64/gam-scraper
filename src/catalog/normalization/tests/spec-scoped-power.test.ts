import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSpecsObject } from "../normalize-specs.js";
import { parseSpecByRule } from "../../../tools/gam/seed/internal/spec.js";

test("interpreta potencia activa específica sin perder condiciones ni ámbito", () => {
  const fields = ["Potencia nominal del motor", "Potencia continua del generador",
    "Potencia de motor publicada para la unidad", "Potencia del motor de elevación",
    "Potencia del motor de elevación anunciada", "Potencia del motor de tracción",
    "Potencia del motor de tracción (S2 60 min)", "Potencia del motor de tracción anunciada"];
  for (const field of fields) {
    const alias = field.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toUpperCase();
    assert.deepEqual(normalizeSpecsObject({ [alias]: "11,5 kW" }).normalized, { [field]: 11.5 });
    assert.equal(parseSpecByRule(field, "11,5 kW"), 11.5);
    assert.deepEqual(normalizeSpecsObject({ [field]: 11.5 }).normalized, { [field]: 11.5 });
    for (const raw of ["11,5", "11,5 kVA", "11500 W", "11,5 CV", "11,5/12 kW", "2 x 11,5 kW", "11,5 kW opcional", "-11,5 kW"]) {
      assert.equal(normalizeSpecsObject({ [field]: raw }).normalized[field], undefined);
    }
    assert.equal(normalizeSpecsObject({ [alias]: "11,5 kW", [field]: "12 kW" }).conflictingKeys.length, 1);
  }
  const input = { "Potencia nominal del motor": "15 kW", "Potencia del motor de tracción": "12 kW",
    "Potencia del motor de tracción (S2 60 min)": "9 kW", "Potencia del motor de elevación anunciada": "3 kW",
    "Potencia continua del generador": "5 kW", "Potencia (kW)": "20 kW" };
  const expected = { "Potencia nominal del motor": 15, "Potencia del motor de tracción": 12,
    "Potencia del motor de tracción (S2 60 min)": 9, "Potencia del motor de elevación anunciada": 3,
    "Potencia continua del generador": 5, "Potencia (kW)": [20] };
  assert.deepEqual(normalizeSpecsObject(input).normalized, expected);
  assert.deepEqual(normalizeSpecsObject(expected).normalized, expected);
});
