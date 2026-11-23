import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGamRows } from "../../../tools/gam/normalization/normalize-rows.js";
import { normalizeSpecsObject } from "../normalize-specs.js";
import { SPEC_RULES } from "../spec-rules.js";
import { parseBattery, parseMeasuredLength, parseNumber, parseNumberArray } from "../spec-parsers.js";

test("N01 no concatena pesos alternativos ni extrae identificadores como horas", () => {
  for (const raw of ["1200 - 1500 KG", "1200/1500 kg", "2 x 1200 kg"]) {
    const result = normalizeSpecsObject({ Peso: raw });
    assert.equal(result.normalized["Peso (kg)"], undefined, raw);
    assert.equal(result.droppedNullLikeKeys.includes("Peso (kg)"), true, raw);
  }
  const invalidHours = "NA V72309090022 horas";
  assert.equal(normalizeSpecsObject({ Horómetro: invalidHours }).normalized["Horas (h)"], undefined);
  for (const raw of ["1200-1500 kg", "1e3 kg", "12,34,56 kg", "ABC123 kg", "NA", "1200/1500 kg", "2 x 1200 kg"]) {
    assert.equal(parseNumber(raw, "kg"), null, raw);
  }
  assert.equal(parseNumber("1.200 kg", "kg"), 1200);
  assert.equal(parseNumber("1.200,5 kg", "kg"), 1200.5);
  assert.equal(parseNumber("0,368", "kg"), 0.368);
  assert.equal(parseNumber(null), null);
});

test("N05 separa unidades compatibles de masa, potencia, voltaje y otras magnitudes", () => {
  for (const [key, invalid] of [
    ["Peso (kg)", "1.5 t"],
    ["Peso (kg)", "5000 libras"],
    ["Potencia (kW)", "15 kVA"],
    ["Voltaje batería (V)", "24/48 V"],
    ["Capacidad de la batería (Ah)", "48V / 500Ah"],
    ["Velocidad (km/h)", "14 km"],
    ["Par motor (Nm)", "120 N"]
  ] as const) {
    assert.equal(normalizeSpecsObject({ [key]: invalid }).normalized[key], undefined, `${key}: ${invalid}`);
  }
  assert.equal(normalizeSpecsObject({ "Peso (kg)": "5000 kg" }).normalized["Peso (kg)"], 5000);
  assert.deepEqual(normalizeSpecsObject({ "Potencia (kW)": "15 kW" }).normalized["Potencia (kW)"], [15]);
  assert.equal(normalizeSpecsObject({ "Voltaje batería (V)": "48 V" }).normalized["Voltaje batería (V)"], 48);
  assert.deepEqual(normalizeSpecsObject({ "Capacidad de la batería (Ah)": "500 Ah" }).normalized["Capacidad de la batería (Ah)"], [500]);
  assert.equal(normalizeSpecsObject({ "Horas (h)": "145 horas" }).normalized["Horas (h)"], 145);
});

test("N06 no aplana factores, rangos o signos, y solo acepta pares con/sin carga explícitos", () => {
  for (const raw of ["2 x 15 kW", "24/48 kW", "2x4,3 kW", "15 - 20 kW", "12,34,56 kW"]) {
    assert.equal(parseNumberArray(raw, "kW"), null, raw);
  }
  assert.deepEqual(parseNumberArray("-5 kW", "kW"), [-5]);
  assert.equal(normalizeSpecsObject({ "Potencia (kW)": "-5 kW" }).normalized["Potencia (kW)"], undefined);
  assert.deepEqual(parseNumberArray("0,368", "kW"), [0.368]);
  assert.deepEqual(parseNumberArray(["14,8", "15,7"], "km/h"), [14.8, 15.7]);
  assert.equal(parseNumberArray(["14,8", "código"], "km/h"), null);
  assert.deepEqual(normalizeSpecsObject({ "Velocidad de desplazamiento con/sin carga (km/h)": "14,8 / 15,7 km/h" }).normalized["Velocidad de desplazamiento con/sin carga (km/h)"], [14.8, 15.7]);
  assert.equal(normalizeSpecsObject({ "Velocidad (km/h)": "14,8 / 15,7 km/h" }).normalized["Velocidad (km/h)"], undefined);
  assert.equal(normalizeSpecsObject({ "Capacidad de carga (kg)": "1500 / 2000 KG" }).normalized["Capacidad de carga (kg)"], undefined);
  for (const [sourceKey, raw, expectedKey] of [
    ["Potencia Motor (KW)", "12 - 25 kW", "Potencia (kW)"],
    ["Capacidad de carga (kg)", "1500 / 2000 KG", "Capacidad de carga (kg)"],
    ["Capacidad de la batería", "24/48 V", "Capacidad de la batería (Ah)"],
    ["Ancho promedio", "24V / 735-875Ah(V/Ah)", "Ancho promedio (mm)"]
  ] as const) {
    assert.equal(normalizeSpecsObject({ [sourceKey]: raw }).normalized[expectedKey], undefined, sourceKey);
  }
});

test("la normalización de filas no publica magnitudes fabricadas ni altera valores originales", async () => {
  const rows = [
    { reference: "CONTROL-PESO-INVALIDO", specJson: JSON.stringify({ Peso: "1200-1500 kg" }) },
    { reference: "CONTROL-PESO-VALIDO", specJson: JSON.stringify({ Peso: "6322 kg" }) }
  ];
  await normalizeGamRows(rows, ["reference", "specJson"], { expandSpecColumns: false, maxValuesPerKey: 50 }, async () => {});
  const invalidWeight = normalizeSpecsObject(JSON.parse(rows[0]?.specJson ?? "{}")).normalized;
  const validWeight = normalizeSpecsObject(JSON.parse(rows[1]?.specJson ?? "{}")).normalized;
  assert.equal(invalidWeight["Peso (kg)"], undefined);
  assert.equal(validWeight["Peso (kg)"], 6322);
  assert.equal(parseMeasuredLength("4,5 m", "Longitud (m)", "mm"), 4500);
  assert.equal(parseMeasuredLength("81 cm", "Anchura", "mm"), 810);
  assert.equal(parseMeasuredLength("500 kg", "Longitud (mm)", "mm"), null);
});

test("la batería no atribuye voltajes únicos a alternativas ni pierde decimales", () => {
  for (const [raw, voltage, capacity] of [
    ["Li-ion 48,5 V 500,5 Ah", 48.5, [500.5]],
    ["48 V / 500 Ah", 48, [500]],
    ["24/48 V", null, null],
    ["24 / 48 V", null, null],
    ["48 V / 24 V", null, null],
    ["2 x 48 V", null, null],
    ["500/600 Ah", null, null],
    ["Sin dato verificable", null, null]
  ] as const) {
    const result = parseBattery(raw);
    assert.ok(result);
    assert.equal(result.voltaje, voltage, raw);
    assert.deepEqual(result.capacidadAh, capacity, raw);
    assert.equal(result.raw, raw);
  }
  assert.equal(parseBattery(null), null);
  assert.equal(Object.values(SPEC_RULES).includes("battery"), false);
  assert.equal(normalizeSpecsObject({ Batería: "24/48 V" }).normalized.Batería, "24/48 V");
});
