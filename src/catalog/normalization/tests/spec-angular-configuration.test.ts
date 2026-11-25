import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSpecsObject } from "../normalize-specs.js";
import { parseExplicitAngularPresentation } from "../spec-parsers.js";
import { normalizeOriginalRotationPresentation } from "../../../preparation/technical/technical-presentation.js";

test("las magnitudes angulares explícitas conservan todos los términos y las condiciones", () => {
  for (const [raw, expected] of [
    ["700º", "700°"], ["± 320º", "±320°"], ["90º+60°", "90° + 60°"],
    ["60.5 º + 60,5º", "60,5° + 60,5°"], ["90º a cada lado", "90° a cada lado"],
    ["360º (continua)", "360° (continua)"]
  ] as const) {
    assert.equal(parseExplicitAngularPresentation(raw), expected);
    assert.equal(parseExplicitAngularPresentation(expected), expected);
    const input = { "Rotación de la cesta": raw };
    assert.equal(normalizeSpecsObject(input).normalized["Rotación de la cesta"], expected);
    assert.equal(normalizeOriginalRotationPresentation(input, input)["Rotación de la cesta"], expected);
    assert.equal(normalizeOriginalRotationPresentation(input, {}), input);
  }
  for (const raw of ["90", "90 rad", "90/60°", "90° opcional", "±90° + 60°", "1.200°", "-90°", "90° + 60° + 30°", ["90°", "60°"]]) {
    assert.equal(parseExplicitAngularPresentation(raw), null);
    assert.equal(normalizeSpecsObject({ "Rotación de la cesta": raw }).normalized["Rotación de la cesta"], undefined);
  }
});

test("la rotación de elementos distintos no se fusiona ni transforma en un ángulo total", () => {
  const input = { "Rotación de torre": "700º", "Rotación de torreta": "320°", "Rotación de cesta": "90° a cada lado",
    "Rotación de la cesta": "90º+90º", "Rotación hidráulica de cesta": "60°", "Rotación del cabezal trilateral": "180°",
    "Rotación de bidón": "360°", "Rotación": "400º" };
  const expected = { ...input, "Rotación de torre": "700°", "Rotación de la cesta": "90° + 90°", "Rotación": "400°" };
  assert.deepEqual(normalizeSpecsObject(input).normalized, expected);
  assert.deepEqual(normalizeSpecsObject(expected).normalized, expected);
  assert.deepEqual(normalizeOriginalRotationPresentation(input, input), expected);
  assert.equal(normalizeSpecsObject({ "Rotación de torreta": "360° opcional" }).normalized["Rotación de torreta"], "360° opcional");
  assert.equal(normalizeSpecsObject({ "ROTACION DE TORRE": "700º", "Rotación de torre": "320°" }).conflictingKeys.length, 1);
});
