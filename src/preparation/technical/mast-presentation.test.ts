import assert from "node:assert/strict";
import test from "node:test";
import type { SpecsMap } from "../../contracts/catalog.js";
import { normalizeOriginalTechnicalPresentation, normalizeTechnicalPresentation } from "./technical-presentation.js";


test("el tipo de mástil explícito utiliza la clave compartida sin cambiar su configuración", () => {
  for (const [key, raw, expected] of [
    ["Tipo mastil", "triplex", "Tríplex"], ["Tipo de mástil", "DUPLEX", "Dúplex"],
    ["Tipo de mastil", "simplex", "Simple"], ["TIPO MÁSTIL", "cuadruplex", "Cuádruplex"]
  ] as const) {
    const original: SpecsMap = { [key]: raw, "Altura mástil replegado": "2100 mm" };
    const current = normalizeTechnicalPresentation(original);
    const changes: string[] = [];
    const result = normalizeOriginalTechnicalPresentation(current, original, (_before, _after, _mechanism, field) => {
      if (typeof field === "object") changes.push(field.spec);
    });
    assert.deepEqual(result, { "Altura mástil replegado": "2100 mm", "Tipo Mástil": expected });
    assert.deepEqual(changes, [key]);
    assert.equal(normalizeOriginalTechnicalPresentation(result, original), result);
    assert.equal(original[key], raw);
  }
});

test("el tipo de mástil conserva variantes, opciones, conflictos y cambios de autoridad", () => {
  for (const raw of ["Dúplex/estándar", "Dúplex / Tríplex", "Mástil opcional", "desconocido", "Tríplex opcional", ["Tríplex"]]) {
    const original: SpecsMap = { "Tipo mastil": raw };
    assert.equal(normalizeOriginalTechnicalPresentation(original, original), original);
  }
  const original: SpecsMap = { "Tipo mastil": "triplex" };
  const conflicting: SpecsMap = { ...original, "Tipo de mástil": "Dúplex" };
  assert.equal(normalizeOriginalTechnicalPresentation(conflicting, original), conflicting);
  assert.equal(normalizeOriginalTechnicalPresentation(original, conflicting), original);
  const recovered: SpecsMap = { "Tipo mastil": "Dúplex" };
  assert.equal(normalizeOriginalTechnicalPresentation(recovered, original), recovered);
  assert.equal(normalizeOriginalTechnicalPresentation(original, {}), original);
});
