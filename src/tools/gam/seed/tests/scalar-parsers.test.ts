import assert from "node:assert/strict";
import test from "node:test";
import { parseScalar } from "../internal/category-path-scalar.js";
import { parseUrlSpecScalar } from "../internal/url-spec-scalar.js";

const cases: readonly { name: string; values: readonly { input: unknown; expected: string | number | boolean }[] }[] = [
  {
    name: "booleanos y texto",
    values: [
      { input: true, expected: true },
      { input: false, expected: false },
      { input: "true", expected: true },
      { input: " FALSE ", expected: false },
      { input: "TrUe", expected: true },
      { input: "sí", expected: "sí" },
      { input: " true extra ", expected: "true extra" }
    ]
  },
  {
    name: "identificadores y separadores sin contexto de magnitud",
    values: [
      { input: 0, expected: 0 },
      { input: -8.5, expected: -8.5 },
      { input: Number.NaN, expected: Number.NaN },
      { input: Number.POSITIVE_INFINITY, expected: Number.POSITIVE_INFINITY },
      { input: "000023", expected: "000023" },
      { input: "1.200", expected: "1.200" },
      { input: "1,5", expected: "1,5" },
      { input: "1.234,50", expected: "1.234,50" },
      { input: "23.75", expected: "23.75" },
      { input: "0.5", expected: "0.5" },
      { input: "1.5 m", expected: "1.5 m" },
      { input: "14.8 km/h", expected: "14.8 km/h" },
      { input: "-1", expected: "-1" },
      { input: "+1", expected: "+1" },
      { input: "1e3", expected: "1e3" }
    ]
  },
  {
    name: "unidades que requieren reglas técnicas explícitas",
    values: [
      { input: "1.200 kg", expected: "1.200 kg" },
      { input: "1,5 m", expected: "1,5 m" },
      { input: "12 mm", expected: "12 mm" },
      { input: "15 cm", expected: "15 cm" },
      { input: "25 kW", expected: "25 kW" },
      { input: "9 W", expected: "9 W" },
      { input: "20 %", expected: "20 %" },
      { input: "9 h", expected: "9 h" },
      { input: "8 horas", expected: "8 horas" },
      { input: "1.234,50 mm", expected: "1.234,50 mm" },
      { input: "12 kg extra", expected: "12 kg extra" },
      { input: "3 kW extra", expected: "3 kW extra" },
      { input: "80 V", expected: "80 V" },
      { input: "80 rpm", expected: "80 rpm" },
      { input: "-1 kg", expected: "-1 kg" }
    ]
  },
  {
    name: "ausentes, tipos no escalares y espacios",
    values: [
      { input: null, expected: "null" },
      { input: undefined, expected: "undefined" },
      { input: {}, expected: "[object Object]" },
      { input: [1, 2], expected: "1,2" },
      { input: "", expected: "" },
      { input: "   \t  ", expected: "" },
      { input: "  motor   eléctrico  ", expected: "motor eléctrico" },
      { input: "\t 12 \n kg ", expected: "12 kg" }
    ]
  }
];

for (const { name, values } of cases) {
  test(`escalares GAM por categoría y por URL conservan ${name}`, () => {
    for (const { input, expected } of values) {
      assert.deepEqual(parseScalar(input), expected);
      assert.deepEqual(parseUrlSpecScalar(input), expected);
    }
  });
}
