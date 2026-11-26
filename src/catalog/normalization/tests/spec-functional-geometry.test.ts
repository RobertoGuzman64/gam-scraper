import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSpecsObject } from "../normalize-specs.js";
import { parseSpecByRule } from "../../../tools/gam/seed/internal/spec.js";

test("interpreta dimensiones funcionales específicas sin fusionar ejes ni ámbitos", () => {
  const fields = ["Apertura máxima de brazos", "Altura máxima de descarga", "Profundidad máxima de excavación",
    "Longitud del cepillo principal", "Anchura total del chasis", "Altura máxima de descarga de la tolva"];
  for (const field of fields) {
    const alias = field.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toUpperCase();
    assert.deepEqual(normalizeSpecsObject({ [alias]: "1,25 m" }).normalized, { [field]: 1250 });
    assert.deepEqual(normalizeSpecsObject({ [field]: 1250 }).normalized, { [field]: 1250 });
    assert.equal(normalizeSpecsObject({ [alias]: "1250 mm", [field]: "1400 mm" }).conflictingKeys.length, 1);
    for (const raw of ["1250 kg", "1200/1400 mm", "1200-1400 mm", "1250 mm opcional", "-10 mm"]) {
      assert.equal(normalizeSpecsObject({ [field]: raw }).normalized[field], undefined);
    }
  }
  const input = { "Apertura máxima de brazos": "1400 mm", "Diámetro admitido de bobina": "150–1300 mm",
    "Diámetro admitido de bidón": "300-600 mm", "Altura máxima de descarga": "2500 mm",
    "Altura máxima de descarga de la tolva": "1500 mm", "Profundidad máxima de excavación": "2100 mm",
    "Longitud del cepillo principal": "700 mm", "Anchura del cepillo principal (mm)": "200 mm" };
  const expected = { "Apertura máxima de brazos": 1400, "Diámetro admitido de bobina": "150-1300 mm",
    "Diámetro admitido de bidón": "300-600 mm", "Altura máxima de descarga": 2500,
    "Altura máxima de descarga de la tolva": 1500, "Profundidad máxima de excavación": 2100,
    "Longitud del cepillo principal": 700, "Anchura del cepillo principal (mm)": 200 };
  assert.deepEqual(normalizeSpecsObject(input).normalized, expected);
  assert.deepEqual(normalizeSpecsObject(expected).normalized, expected);
  for (const raw of ["1300-150 mm", "150-1300 kg", "150/1300 mm", "150-1300 mm opcional", "0-1300 mm"]) {
    assert.equal(parseSpecByRule("Diámetro admitido de bobina", raw), null);
  }
});
