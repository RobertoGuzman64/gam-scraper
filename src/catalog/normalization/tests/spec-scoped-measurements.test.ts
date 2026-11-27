import assert from "node:assert/strict";
import test from "node:test";
import { explicitNumericSpecUnit, normalizeSpecsObject } from "../normalize-specs.js";
import { parseSpecByRule } from "../../../tools/gam/seed/internal/spec.js";
import { toSpecColumnString } from "../../../tools/gam/normalization/spec-scalar.js";

test("interpreta magnitudes delimitadas sin fusionar condiciones, ámbitos ni unidades", () => {
  const examples = [
    ["Ancho con ejes", "2500 mm", 2.5, "m"],
    ["Radio de giro (exterior)", "2,1 m", 2100, "mm"],
    ["Altura de elevación según texto comercial", "4.700 mm", 4700, "mm"],
    ["Altura de trabajo redondeada", "12 m", 12, "m"],
    ["Distancia del centro de gravedad", "540 mm", 540, "mm"],
    ["Capacidad de carga a más de 470 mm", "1000 kg", 1000, "kg"],
    ["Capacidad a máxima altura de elevación", "2000 kg", 2000, "kg"],
    ["Capacidad de tolva colmada", "2500 L", 2500, "l"],
    ["Capacidad de tolva rasa", "2100 l", 2100, "l"],
    ["Capacidad máxima de carga de la tolva", "70 kg", 70, "kg"],
    ["Tensión del sistema de batería", "24 V", 24, "V"],
    ["Frecuencia de vibración", "61 Hz", 61, "Hz"]
  ] as const;
  const input = Object.fromEntries(examples.map(([field, raw]) => [field, raw]));
  const expected = Object.fromEntries(examples.map(([field, , value]) => [field, value]));
  assert.deepEqual(normalizeSpecsObject(input).normalized, expected);
  assert.deepEqual(normalizeSpecsObject(expected).normalized, expected);
  for (const [field, raw, value, unit] of examples) {
    assert.equal(explicitNumericSpecUnit(field), unit);
    assert.equal(parseSpecByRule(field, raw), value);
    assert.equal(parseSpecByRule(field, toSpecColumnString(field, value)), value);
    for (const invalid of ["12", "12 / 13 " + unit, "12-13 " + unit, "12 " + unit + " opcional", "-1 " + unit, "12 rpm"]) {
      assert.equal(normalizeSpecsObject({ [field]: invalid }).normalized[field], undefined);
    }
    const alias = field.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
    assert.equal(normalizeSpecsObject({ [alias]: raw }).normalized[field], value);
    assert.equal(normalizeSpecsObject({ [alias]: value }).normalized[field], undefined);
    assert.equal(normalizeSpecsObject({ [field]: raw, [alias]: `1 ${unit}` }).conflictingKeys.length, 1);
  }
  assert.equal(parseSpecByRule("Capacidad de tolva colmada", "100 kg"), null);
  assert.equal(parseSpecByRule("Capacidad máxima de carga de la tolva", "100 l"), null);
  assert.equal(parseSpecByRule("Tensión del sistema de batería", "24 Ah"), null);
});

test("los recuentos específicos no convierten dimensiones ni configuraciones en números", () => {
  for (const key of ["Asientos cabina", "Número de estabilizadores", "Número de extensiones telescópicas",
    "Células de pesaje", "Número de plataformas de carga", "Número de plazas del modelo", "Número de ejes"]) {
    assert.equal(parseSpecByRule(key, "3"), 3);
    assert.equal(parseSpecByRule(key, 3), 3);
    for (const invalid of ["3/4", "3 kg", "3 ruedas", "3,5", "3.000", -1, "3 opcionales"]) {
      assert.equal(parseSpecByRule(key, invalid), null);
    }
  }
  assert.deepEqual(normalizeSpecsObject({ "Número de estabilizadores": "4", "Número de estabilizadores hidráulicos": "2" }).normalized,
    { "Número de estabilizadores": 4, "Número de estabilizadores hidráulicos": 2 });
});

test("interpreta velocidades, autonomía y magnitudes energéticas sin confundir condiciones", () => {
  const examples = [
    ["Velocidad máxima de desplazamiento", "9,6 km/h", 9.6, "km/h"],
    ["Velocidad máxima de asistencia", "25 km/h", 25, "km/h"],
    ["Capacidad de batería (20 h)", "70 Ah", 70, "Ah"],
    ["Par motor máximo del modelo", "109 Nm", 109, "Nm"],
    ["Esfuerzo nominal en barra de tracción", "1336 N", 1336, "N"],
    ["Pendiente superable del modelo", "38 %", 38, "%"],
    ["Pendiente superable del modelo con plataforma bajada", "25 %", 25, "%"],
    ["Precisión del sistema de pesaje", "99,95 %", 99.95, "%"],
    ["Tiempo de carga anunciado", "2,5 h", 2.5, "h"]
  ] as const;
  for (const [field, raw, value, unit] of examples) {
    assert.deepEqual(normalizeSpecsObject({ [field]: raw }).normalized, { [field]: value });
    assert.equal(parseSpecByRule(field, toSpecColumnString(field, value)), value);
    assert.equal(explicitNumericSpecUnit(field), unit);
    for (const invalid of ["12", "12/13 " + unit, "12-13 " + unit, "12 " + unit + " opcional", "12 rpm", "-12 " + unit]) {
      assert.equal(parseSpecByRule(field, invalid), null);
    }
  }
  assert.equal(parseSpecByRule("Capacidad de batería (20 h)", "70 h"), null);
  assert.equal(parseSpecByRule("Par motor máximo del modelo", "109 N"), null);
  assert.equal(parseSpecByRule("Ángulo máximo de inclinación", "75 º"), "75°");
  assert.equal(parseSpecByRule("Ángulo máximo de inclinación", "75 mm"), null);
});


test("conserva la unidad declarada en magnitudes de representación múltiple", () => {
  const examples = [
    ["Autonomía máxima anunciada en ciudad", "262km", "262 km", "262 Ah"],
    ["Autonomía anunciada por carga", "45min", "45 min", "45 V"],
    ["Capacidad nominal de batería", "14.4 kwh", "14,4 kWh", "14,4 V"],
    ["Capacidad nominal de batería", "70ah", "70 Ah", "70 h"],
    ["Potencia máxima DIN", "74.5cv", "74,5 CV", "74,5 kVA"],
    ["Potencia del motor", "250w", "250 W", "250 Nm"],
    ["Potencia aparente nominal anunciada", "37,5kva", "37,5 kVA", "37,5 kW"],
    ["Cilindrada del motor", "2598cm³", "2598 cm³", "2598 cm"],
    ["Fuerza centrífuga", "20kn", "20 kN", "20 Nm"]
  ] as const;
  for (const [field, raw, expected, incompatible] of examples) {
    assert.deepEqual(normalizeSpecsObject({ [field]: raw }).normalized, { [field]: expected });
    assert.equal(parseSpecByRule(field, toSpecColumnString(field, expected)), expected);
    for (const invalid of [12, "12", incompatible, "1.234 km", `${raw} opcional`, [raw], `2 x ${raw}`, `${raw} / ${raw}`]) {
      assert.equal(parseSpecByRule(field, invalid), null);
    }
  }
  assert.equal(parseSpecByRule("Autonomía máxima anunciada", "2 h"), "2 h");
  assert.equal(parseSpecByRule("Potencia máxima del motor", "150 kW"), "150 kW");
});

test("normaliza únicamente clasificaciones de emisiones explícitas y conserva Flex", () => {
  for (const [raw, expected] of [["v flex", "V Flex"], ["Stage IIIa", "IIIA"], ["stage iv", "IV"]] as const) {
    assert.equal(parseSpecByRule("Stage", raw), expected);
    assert.equal(parseSpecByRule("Stage", expected), expected);
  }
  for (const raw of ["2", "2a", "no emisionado", "IIIA o V", "IIA", "III Flex", "V / IV", ["V"], 5]) {
    assert.equal(parseSpecByRule("Stage", raw), null);
  }
});

test("reconoce configuraciones técnicas textuales sin inferir opciones, unidades ni equivalencias", () => {
  const cases = {
    "Tipo de tablero": "Eje pasador", "Enganche": "Gancho o bola de quinta rueda",
    "Tipos de enganche compatibles": "Pasador, gancho o bola de quinta rueda",
    "Tipo estabilizador": "H+H", "Sistema de estabilización": "Variable, según configuración",
    "Dirección": "Asistida en ambas ruedas", "Freno de servicio": "Electromagnético",
    "Configuración de ruedas": "3 ruedas", "Configuración de ruedas de carga": "Tándem",
    "Material de ejes y anclaje": "Acero inoxidable", "Material de cesta": "Fibra",
    "Plataforma de operador": "Abatible", "Conducción con timón vertical": "Permitida",
    "Controlador de tracción": "Controlador CA", "Tecnología de batería": "Iones de litio",
    "Tipo de motor de tracción": "Corriente alterna (CA)", "Velocidad de volteo": "Regulable",
    "Condición de liberación de bobina": "Solo sobre el suelo o un palé"
  } as const;
  assert.deepEqual(normalizeSpecsObject(cases).normalized, cases);
  for (const [field, value] of Object.entries(cases)) {
    assert.equal(parseSpecByRule(field, value), value);
    assert.equal(parseSpecByRule(field, toSpecColumnString(field, value)), value);
    for (const invalid of [true, 3, [value], { value }, "n/a"]) {
      assert.equal(parseSpecByRule(field, invalid), null);
    }
  }
  assert.equal(normalizeSpecsObject({ "Tipo estabilizador": "H+H", "TIPO ESTABILIZADOR": "A+A" }).conflictingKeys.length, 1);
  assert.deepEqual(normalizeSpecsObject({ "Certificación CE": "Sí", "Estabilizadores hidráulicos": "Sí", "Capacidad": "50 l" }).normalized, {});
});

test("conserva intervalos de velocidad y condiciones publicadas", () => {
  const input = { "Velocidad de barrido": "0–16 km/h", "Velocidad de avance y retroceso del modelo": "0-2 mph",
    "Velocidad de desplazamiento (km/h)": "15–16 km/h (rango publicado)" };
  const expected = { "Velocidad de barrido": "0-16 km/h", "Velocidad de avance y retroceso del modelo": "0-2 mph",
    "Velocidad de desplazamiento (km/h)": "15-16 km/h (rango publicado)" };
  assert.deepEqual(normalizeSpecsObject(input).normalized, expected);
  assert.deepEqual(normalizeSpecsObject(expected).normalized, expected);
  for (const [field, value] of Object.entries(expected)) assert.deepEqual(parseSpecByRule(field, value), value);
  for (const value of ["16-0 km/h", "0-16 mph", "0-16 km/h opcional", "0/16 km/h", "-1-16 km/h"]) {
    assert.deepEqual(normalizeSpecsObject({ "Velocidad de barrido": value }).normalized, {});
  }
  assert.deepEqual(normalizeSpecsObject({ "Presión de aceite de trabajo del modelo": "0-10 bar" }).normalized, {});
});

test("reconoce medidas y configuraciones funcionales sin inferir ejes ni alterar condiciones", () => {
  const input = { "Bomba eléctrica de emergencia": "12 V", "Caudal nominal": "9.3 l/min", "Presion max.": "185 bar",
    "Sistema antivuelco": "ACS", "Control de tracción": "TCS", "Configuración de ejes declarada": "4x2",
    "Reducción de transmisión del modelo": "2:1 por cadena", "Parada de inclinación": "Automática en posición neutra" };
  const expected = { ...input, "Caudal nominal": "9,3 l/min" };
  assert.deepEqual(normalizeSpecsObject(input).normalized, expected);
  assert.deepEqual(normalizeSpecsObject(expected).normalized, expected);
  for (const [field, value] of Object.entries(expected)) assert.equal(parseSpecByRule(field, value), value);
  assert.deepEqual(normalizeSpecsObject({ "Medida del cepillo principal": "1020 kg", "Bomba eléctrica de emergencia": "12 A",
    "Caudal nominal": "9 l", "Presion max.": "185 kW", "Control de tracción": ["TCS"], "Capacidad": "250 kg" }).normalized, {});
});


test("conserva el límite explícito y la unidad de las prestaciones condicionadas", () => {
  const input = { "Inclinación de cajas": "hasta 180º", "Nivel sonoro de desplazamiento": "inferior a 60 dB(A)",
    "Aislamiento eléctrico del brazo": "Hasta 1000 V", "Aislamiento eléctrico declarado del brazo": "Hasta 500 V",
    "Capacidad de carga anunciada, conductor incluido": "Hasta 240 kg", "Volumen de carga anunciado": "Hasta 1200 L" };
  const expected = { ...input, "Inclinación de cajas": "Hasta 180°", "Nivel sonoro de desplazamiento": "Inferior a 60 dB(A)",
    "Volumen de carga anunciado": "Hasta 1200 l" };
  assert.deepEqual(normalizeSpecsObject(input).normalized, expected);
  assert.deepEqual(normalizeSpecsObject(expected).normalized, expected);
  for (const [field, value] of Object.entries(expected)) {
    assert.equal(parseSpecByRule(field, value), value);
    for (const invalid of [value.replace(/^(Hasta|Inferior a) /u, ""), `${value} opcional`, [value], 100, "Hasta 10 kW"]) {
      assert.equal(parseSpecByRule(field, invalid), null);
    }
  }
  assert.equal(parseSpecByRule("Nivel sonoro de desplazamiento", "Hasta 60 dB(A)"), null);
  assert.equal(parseSpecByRule("Aislamiento eléctrico del brazo", "Inferior a 1000 V"), null);
});

test("conserva las dimensiones funcionales explícitas sin atribuir ejes ni perder precisión", () => {
  const cases = [
    ["Dimensiones exteriores", "1,5 x 720 mm x 111 cm", null],
    ["Dimensiones exteriores", "1,89 m x 72 cm x 1110 mm", "1890 x 720 x 1110 mm"],
    ["Dimensiones de cesta de fibra", "1,4 x 0,7 x 1,1 m", "1400 x 700 x 1100 mm"],
    ["Dimensiones del panel admitido", "1500 x 750 x 120 mm", "1500 x 750 x 120 mm"],
    ["Dimensiones de plataforma según catálogo técnico", "4,35 x 2,30 m", "4350 x 2300 mm"],
    ["Tamaño máximo del panel", "365 x 120 cm", "3650 x 1200 mm"]
  ] as const;
  for (const [field, raw, expected] of cases) {
    assert.equal(normalizeSpecsObject({ [field]: raw }).normalized[field] ?? null, expected);
    assert.equal(parseSpecByRule(field, raw), expected);
    if (expected === null) continue;
    assert.equal(parseSpecByRule(field, toSpecColumnString(field, expected)), expected);
    for (const invalid of [[raw], { raw }, "1 x 2 x 3", "1 x 2 x 3 kg", "1 x 0 mm", `${raw} opcional`]) {
      assert.equal(parseSpecByRule(field, invalid), null);
    }
  }
  assert.equal(parseSpecByRule("Dimensiones exteriores", "1 x 2 m"), null);
  assert.equal(parseSpecByRule("Tamaño máximo del panel", "1 x 2 x 3 m"), null);
  assert.equal(parseSpecByRule("Tamaño máximo del panel", "0,0000001 x 2 m"), null);
});

test("interpreta magnitudes específicas con unidad acreditada sin fusionar capacidades", () => {
  const cases = [["Capacidad nominal", "2000 kg", 2000, "2000 Ah"],
    ["Velocidad máxima", "45 km/h", 45, "45 km"],
    ["Mastil replegado", "3,39 m", 3.39, "3,39 kg"]] as const;
  for (const [field, raw, expected, invalid] of cases) {
    assert.equal(parseSpecByRule(field, raw), expected);
    assert.equal(parseSpecByRule(field, toSpecColumnString(field, expected)), expected);
    assert.equal(parseSpecByRule(field, invalid), null);
    assert.equal(parseSpecByRule(field, String(expected)), null);
  }
  assert.deepEqual(normalizeSpecsObject({ Capacidad: "45 l", "Capacidad nominal": "2000 kg" }).normalized, { "Capacidad nominal": 2000 });
});


test("interpreta disponibilidades específicas sin inferir equipamiento opcional ni magnitudes", () => {
  for (const key of ["Elevación inicial", "Elevación proporcional", "Batería extraíble", "Primer eje elevable",
    "Piso móvil", "Frenado en posición neutra del modelo", "Cargador a bordo del modelo"]) {
    for (const [raw, expected] of [["Sí", true], ["No", false], [true, true], [false, false], ["YES", true], ["false", false]] as const) {
      assert.deepEqual(normalizeSpecsObject({ [key]: raw }).normalized, { [key]: expected });
      assert.equal(parseSpecByRule(key, toSpecColumnString(key, expected)), expected);
    }
    for (const raw of [1, 0, "1", "0", "Sí/No", "Sí opcional", "Disponible bajo pedido", ["Sí"], { value: true }, "12 mm"]) {
      assert.equal(parseSpecByRule(key, raw), null);
    }
    const alias = key.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
    assert.equal(normalizeSpecsObject({ [key]: "Sí", [alias]: "No" }).conflictingKeys.length, 1);
  }
});


test("conserva condiciones de pendiente y límites de bloqueo sin convertirlos en magnitudes escalares", () => {
  const grade = "Pendiente máxima con/sin carga";
  const lock = "Bloqueo de inclinación por altura del centro de rotación";
  const input = { [grade]: "3.5%/20 %", [lock]: "por debajo de 600mm o por encima de 1200 mm" };
  const expected = { [grade]: "3,5 % / 20 %", [lock]: "Por debajo de 600 mm o por encima de 1200 mm" };
  assert.deepEqual(normalizeSpecsObject(input).normalized, expected);
  assert.deepEqual(normalizeSpecsObject(expected).normalized, expected);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(parseSpecByRule(key, toSpecColumnString(key, value)), value);
    assert.equal(parseSpecByRule(key, [value]), null);
  }
  for (const invalid of ["3 / 20 %", "3 % / 20 °", "3 %", "3 % / 20 % / 40 %", "3 % / 20 % opcional", "-3 % / 20 %"]) {
    assert.equal(parseSpecByRule(grade, invalid), null);
  }
  for (const invalid of ["Por debajo de 1200 mm o por encima de 600 mm", "Por debajo de 600 kg o por encima de 1200 mm",
    "Por debajo de 600 o por encima de 1200 mm", "Por debajo de 600 mm y por encima de 1200 mm", "600-1200 mm"]) {
    assert.equal(parseSpecByRule(lock, invalid), null);
  }
});


test("la altura redondeada no es un alias de la altura de trabajo ni de la altura exterior", () => {
  const input = { "Altura de trabajo redondeada": "12 m", "Altura de trabajo (m)": "11,68 m", Altura: "2100 mm" };
  assert.deepEqual(normalizeSpecsObject(input).normalized, { "Altura de trabajo redondeada": 12,
    "Altura de trabajo (m)": 11.68, "Altura (mm)": 2100 });
});
