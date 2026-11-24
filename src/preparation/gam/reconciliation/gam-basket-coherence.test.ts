import assert from "node:assert/strict";

import test from "node:test";

import { normalizeSpecsObject } from "../../../catalog/normalization/normalize-specs.js";

test("el normalizador no inventa decimales ni acepta dimensiones deformadas", () => {
  const examples = [
    ["1,83 x 0,76 metros", { ancho: 1830, largo: 760 }],
    ["2,27 x 1,12 m metros", { ancho: 2270, largo: 1120 }],
    ["1400x700 mm metros", { ancho: 1400, largo: 700 }],
    ["1.400 x 700 mm", { ancho: 1400, largo: 700 }],
    ["1 76 83X0 metros", null],
    ["1400x700x1100 metros", null],
    ["1400x700 metros", null],
    ["1,83 x 0,76", null]
  ] as const;
  for (const [value, expected] of examples) {
    const result = normalizeSpecsObject({ "Dimensiones Cesta": value });
    assert.deepEqual(result.normalized["Dimensiones cesta (mm)"] ?? null, expected, value);
  }
});
