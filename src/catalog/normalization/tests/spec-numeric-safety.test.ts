import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGamRows } from "../../../tools/gam/normalization/normalize-rows.js";
import { parseSpecByRule } from "../../../tools/gam/seed/internal/spec.js";
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


test("las horas de uso reconocen alias y agrupaciones completas sin resolver conflictos", () => {
  for (const key of ["Horas laborales", "Horas de uso", "horas (h)", "Horómetro"]) {
    for (const raw of ["1 234 h", "1\u00a0234 horas", "1\u202f234 h"]) {
      assert.equal(normalizeSpecsObject({ [key]: raw }).normalized["Horas (h)"], 1234);
    }
  }
  for (const raw of ["12 34 h", "1 234 km", "1 234 / 2 345 h", "Horómetro sustituido", "-1 h"]) {
    assert.equal(normalizeSpecsObject({ "Horas laborales": raw }).normalized["Horas (h)"], undefined);
  }
  assert.equal(parseNumber("1 234 kg", "kg"), null);
  assert.deepEqual(normalizeSpecsObject({ "Horas laborales": "1 234 h", Horas: "1235 h" }).conflictingKeys,
    [{ key: "Horas (h)", sources: ["Horas", "Horas laborales"] }]);
});

test("los depósitos respetan la dimensión volumétrica sin mezclar masa, energía o alternativas", () => {
  for (const key of ["Depósito de combustible", "Depósito de solución", "Depósito de recuperación"]) {
    assert.equal(normalizeSpecsObject({ [key]: "15,5 litros" }).normalized[key], 15.5);
    assert.equal(normalizeSpecsObject({ [key]: 15 }).normalized[key], 15);
    for (const raw of ["15 kg", "15 kW", "15 / 20 l", "15-20 l", "15 l opcionales"])
      assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], undefined);
  }
  for (const [alias, key] of [["Capacidad del depósito de combustible", "Depósito de combustible"],
    ["Capacidad del depósito de solución", "Depósito de solución"], ["Capacidad del depósito de recuperación", "Depósito de recuperación"]] as const) {
    const result = normalizeSpecsObject({ [alias]: "15,5 litros" });
    assert.deepEqual(result.normalized, { [key]: 15.5 });
    assert.deepEqual(normalizeSpecsObject(result.normalized).normalized, result.normalized);
    assert.equal(normalizeSpecsObject({ [alias]: "15 l", [key]: "20 l" }).conflictingKeys.length, 1);
    for (const raw of ["15 kg", "15 kW", "15 / 20 l", "15-20 l", "15 l opcionales"])
      assert.deepEqual(normalizeSpecsObject({ [alias]: raw }).normalized, {});
  }
  assert.deepEqual(normalizeSpecsObject({ "Capacidad del depósito de solución": "50 l", "Capacidad del depósito de recuperación": "60 l",
    "Capacidad del depósito de combustible": "40 l", "Capacidad del depósito": "70 l" }).normalized,
    { "Depósito de solución": 50, "Depósito de recuperación": 60, "Depósito de combustible": 40, "Capacidad del depósito": 70 });
  assert.equal(normalizeSpecsObject({ "Capacidad de la tolva": "15 kg" }).normalized["Capacidad de la tolva"], 15);
});

test("interpreta configuraciones V/Ah completas sin reducir opciones a capacidades nominales", () => {
  const key = "Batería (V / Ah)";
  for (const [raw, expected] of [
    ["48V / 300Ah(V/Ah)", "48 V / 300 Ah"],
    ["48/300 V/Ah", "48 V / 300 Ah"],
    ["2 x 12/85V/Ah", "2 x 12 V / 85 Ah"],
    ["24V / 200-300Ah | Li-ion 24V / 150Ah(V/Ah)", "24 V / 200-300 Ah | Li-ion 24 V / 150 Ah"],
    ["Li-ion 51.2 V / 250,5 AH", "Li-ion 51,2 V / 250,5 Ah"]
  ]) {
    assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], expected);
  }
  for (const raw of ["48/300/400 V/Ah", "48/300", "0 x 12/85V/Ah", "2 x 12/85V/A", "48V / 300A", "48V / 300h", "48V / 300-200Ah", "48V / 0Ah", "48V / 300Ah | 400Ah", "48V / 300Ah opcional", "48V / 3.000Ah", ["48 V / 300 Ah", "24 V / 100 Ah"]]) {
    assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], undefined);
  }
  assert.equal(normalizeSpecsObject({ "Capacidad de la batería (Ah)": "48 V / 300 Ah" }).normalized["Capacidad de la batería (Ah)"], undefined);
});

test("las lecturas de kilometraje agrupadas conservan su magnitud y no aceptan horas", () => {
  for (const raw of ["12 345 km", "12\u00a0345 kilómetros", "12\u202f345 kms"]) {
    assert.equal(normalizeSpecsObject({ Kilometraje: raw }).normalized["Kilómetros (km)"], 12345);
  }
  for (const raw of ["12 34 km", "12 345 h", "12 345 / 14 000 km", "12 345 km opcionales"]) {
    assert.equal(normalizeSpecsObject({ Kilometraje: raw }).normalized["Kilómetros (km)"], undefined);
  }
});

test("los alias de tiro conservan conceptos y conflictos independientes", () => {
  const output = normalizeSpecsObject({ "Tiro a la barra nominal": "1200 N", "Máximo tiro a la barra": "2400 N" });
  assert.deepEqual(output.normalized, { "Tiro a la barra nominal (N)": 1200, "Máximo tiro a la barra (N)": 2400 });
  assert.deepEqual(normalizeSpecsObject({ "Tiro a la barra nominal": "1200 N", "Tiro a la barra nominal (N)": "1300 N" }).conflictingKeys,
    [{ key: "Tiro a la barra nominal (N)", sources: ["Tiro a la barra nominal", "Tiro a la barra nominal (N)"] }]);
  assert.equal(normalizeSpecsObject({ "Tiro a la barra nominal": "1200 kg" }).normalized["Tiro a la barra nominal (N)"], undefined);
});


test("las revoluciones del cepillo no interpretan magnitudes incompatibles", () => {
  for (const key of ["RPM cepillo", "RPM del cepillo"]) {
    assert.equal(normalizeSpecsObject({ [key]: "250 RPM" }).normalized[key], 250);
    assert.equal(normalizeSpecsObject({ [key]: "125,5" }).normalized[key], 125.5);
    for (const raw of ["250 kg", "250 kW", "250 h", "250-300 rpm", "250 rpm opcionales"])
      assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], undefined);
  }
});

test("las alternativas de anchura y pasillo AST conservan todos sus valores en orden", () => {
  assert.deepEqual(normalizeSpecsObject({ "Ancho promedio": "1150 / 1250 / 1350mm", "AST (mm)": "2200 / 2400 mm" }).normalized,
    { "Ancho promedio (mm)": [1150, 1250, 1350], "AST (mm)": [2200, 2400] });
  for (const raw of ["1200-1500 mm", "1200 / 1500 kg", "1200 / 1500 cm", "1200 / 0 mm", "1.200 / 1.500 mm", "1200 / 1500 mm opcional", "1200 / / 1500 mm"])
    assert.equal(normalizeSpecsObject({ "Ancho promedio": raw }).normalized["Ancho promedio (mm)"], undefined);
  assert.deepEqual(normalizeSpecsObject({ "Ancho promedio": "1200 / 1500", "Ancho medio": "1200 / 1600" }).conflictingKeys,
    [{ key: "Ancho promedio (mm)", sources: ["Ancho medio", "Ancho promedio"] }]);
});


test("interpreta funciones de seguridad independientes sin atribuir opciones ni confundir recuentos", () => {
  const keys = ["Control de estabilidad", "Autocargable", "Giratorio", "Descarga altura"];
  for (const key of keys) {
    const alias = key.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toUpperCase();
    assert.deepEqual(normalizeSpecsObject({ [alias]: "Sí" }).normalized, { [key]: true });
    assert.deepEqual(normalizeSpecsObject({ [key]: "False" }).normalized, { [key]: false });
    for (const raw of ["Opcional", "Sí / No", "Según configuración", "4 mm"]) {
      assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], undefined);
    }
  }
  for (const raw of ["Sí", "No", "verificar"]) {
    const result = normalizeSpecsObject({ "Certificación CE": raw });
    assert.deepEqual(result.normalized, {});
    assert.deepEqual(result.unknownKeys, ["Certificación CE"]);
    assert.deepEqual(result.discardedSpecs, []);
  }
  assert.deepEqual(normalizeSpecsObject({ "Control de estabilidad": true, "Sistema antivuelco ACS": false,
    Estabilizadores: false, "Estabilizadores hidráulicos": true }).normalized, {
    "Control de estabilidad": true, "Sistema antivuelco ACS": false, Estabilizadores: false
  });
  for (const key of ["Polos", "Número de ruedas", "Número de estabilizadores hidráulicos"]) {
    assert.equal(normalizeSpecsObject({ [key]: "4,00" }).normalized[key], 4);
    for (const raw of ["4 kg", "4 V", "4.000", 4.5, "4/6", -4]) {
      assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], undefined);
    }
  }
});

test("interpreta magnitudes eléctricas y de almacenamiento con unidades propias", () => {
  for (const [key, raw, expected, invalid] of [
    ["Frecuencia nominal", "60 Hz", 60, "60 V"],
    ["Corriente del cargador", "25 A", 25, "25 Ah"],
    ["Voltaje del cargador", "48 V", 48, "48 A"],
    ["Potencia absorbida", "750 W", 750, "750 kVA"],
    ["Régimen nominal del motor", "1800 rpm", 1800, "1800 Hz"],
    ["Anchura de bandeja", "2,4 m", 2400, "2400 kg"],
    ["Anchura exterior del almacén", "300 cm", 3000, "300 kg"],
    ["Profundidad de bandeja", "800 mm", 800, "800 l"],
    ["Paso de almacenamiento de bandejas", "2 cm", 20, "2 kg"],
    ["Carga neta por bandeja", "300 kg", 300, "300 l"],
    ["Masa máxima autorizada del vehículo", "4.200 kg", 4200, "4200 mm"]
  ] as const) {
    assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], expected);
    assert.equal(normalizeSpecsObject({ [key]: invalid }).normalized[key], undefined);
  }
  assert.equal(normalizeSpecsObject({ "Factor de potencia nominal": "0.875" }).normalized["Factor de potencia nominal"], 0.875);
  for (const raw of ["0,8 kW", "80 %", "1,2", "0,8 / 1", -0.5]) {
    assert.equal(normalizeSpecsObject({ "Factor de potencia nominal": raw }).normalized["Factor de potencia nominal"], undefined);
  }
  assert.deepEqual(normalizeSpecsObject({ "Voltaje del cargador": "48 V", "Voltaje batería (V)": "24 V",
    "Corriente del cargador": "25 A", "Capacidad de la batería (Ah)": "500 Ah" }).normalized, {
    "Voltaje del cargador": 48, "Voltaje batería (V)": 24, "Corriente del cargador": 25, "Capacidad de la batería (Ah)": [500]
  });
});

test("interpreta cotas independientes de implementos, cesta y transporte sin fusionarlas", () => {
  const millimeterFields = ["Cazo 1 limpieza", "Cazo 2", "Cazo 3", "Largo horquillas", "Ancho horquillas",
    "Grosor horquillas", "Longitud de tenedor", "Diámetro nominal de herramienta compatible"];
  for (const key of millimeterFields) {
    assert.equal(normalizeSpecsObject({ [key]: "25 cm" }).normalized[key], 250);
    assert.equal(normalizeSpecsObject({ [key]: "0,25 m" }).normalized[key], 250);
    for (const raw of ["250 kg", "250 l", "250-350 mm", "250 mm opcional", "-250 mm", "250 x 350 mm"]) {
      assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], undefined);
    }
  }
  for (const key of ["Alto cesta", "Ancho cesta", "Longitud cesta", "Altura transporte", "Longitud al tablero", "Longitud de cable de alimentación"]) {
    assert.equal(normalizeSpecsObject({ [key]: "250 cm" }).normalized[key], 2.5);
    assert.equal(normalizeSpecsObject({ [key]: "2500 mm" }).normalized[key], 2.5);
    assert.equal(normalizeSpecsObject({ [key]: "2500 kg" }).normalized[key], undefined);
    assert.equal(normalizeSpecsObject({ [key]: "2,5/3 m" }).normalized[key], undefined);
  }
  assert.deepEqual(normalizeSpecsObject({ "Cazo 1 limpieza": "1 m", "Cazo 2": "50 cm", "Cazo 3": "300 mm",
    "Largo horquillas": "1200 mm", "Ancho horquillas": "100 mm", "Grosor horquillas": "40 mm" }).normalized,
  { "Cazo 1 limpieza": 1000, "Cazo 2": 500, "Cazo 3": 300, "Largo horquillas": 1200, "Ancho horquillas": 100, "Grosor horquillas": 40 });
});

test("separa capacidad de depósito, tensiones declaradas y potencia máxima del equipo", () => {
  const fields = [
    ["Capacidad depósito", "75 litros", 75, "75 kg"],
    ["Capacidad del depósito", "30 l", 30, "30 Ah"],
    ["Voltaje de la batería", "24 V", 24, "24 A"],
    ["Tensión nominal de batería", "48 V", 48, "48 Ah"],
    ["Potencia eléctrica máxima del equipo", "900 W", 900, "900 kVA"]
  ] as const;
  for (const [key, raw, expected, invalid] of fields) {
    assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], expected);
    assert.equal(normalizeSpecsObject({ [key]: invalid }).normalized[key], undefined);
    assert.equal(normalizeSpecsObject({ [key]: "24 / 48 V" }).normalized[key], undefined);
  }
  const input = { "Capacidad depósito": "75 l", "Depósito de combustible": "50 l", "Voltaje de la batería": "24 V",
    "Tensión nominal de batería": "48 V", "Voltaje del cargador": "36 V", "Potencia eléctrica máxima del equipo": "900 W" };
  const normalized = normalizeSpecsObject(input).normalized;
  assert.deepEqual(normalized, { "Capacidad depósito": 75, "Depósito de combustible": 50, "Voltaje de la batería": 24,
    "Tensión nominal de batería": 48, "Voltaje del cargador": 36, "Potencia eléctrica máxima del equipo": 900 });
  assert.deepEqual(normalizeSpecsObject(normalized).normalized, normalized);
});


test("las capacidades canónicas conservan su magnitud al normalizar el CSV y consumirlo en el seed", async () => {
  const keys = ["Capacidad de la cesta", "Capacidad de plataforma", "Capacidad nominal de carga", "Capacidad de plataforma sin restricciones"];
  const raw = Object.fromEntries(keys.map((key) => [key, "230,5 kg"]));
  const first = normalizeSpecsObject(raw).normalized;
  assert.deepEqual(first, Object.fromEntries(keys.map((key) => [key, 230.5])));
  assert.deepEqual(normalizeSpecsObject(first).normalized, first);
  const rows = [{ reference: "CONTROL", specJson: JSON.stringify(raw) }];
  const options = { expandSpecColumns: false, maxValuesPerKey: 50 };
  await normalizeGamRows(rows, ["reference", "specJson"], options, async () => {});
  assert.deepEqual(JSON.parse(rows[0]?.specJson ?? "{}"), first);
  await normalizeGamRows(rows, ["reference", "specJson"], options, async () => {});
  assert.deepEqual(JSON.parse(rows[0]?.specJson ?? "{}"), first);
  for (const key of keys) {
    assert.equal(parseSpecByRule(key, first[key]), 230.5);
    for (const invalid of ["230", "230 L", "230/300 kg", -1, Infinity, NaN, true]) {
      assert.equal(normalizeSpecsObject({ [key]: invalid }).normalized[key], undefined);
    }
    assert.equal(normalizeSpecsObject({ [key.toLowerCase()]: 230 }).normalized[key], undefined);
  }
});

test("la geometría normalizada conserva sus ejes sin aceptar estructuras ambiguas", () => {
  const basket = "Dimensiones cesta (mm)";
  const forks = "Dimensiones horquillas (mm)";
  for (const raw of [
    { [basket]: "1830 x 760 mm", [forks]: "1185 mm" },
    { [basket]: "1,83 x 0,76 m", [forks]: "1200 x 100 x 40 mm" },
    { [forks]: "1200 x 100 mm" }
  ]) {
    const first = normalizeSpecsObject(raw).normalized;
    assert.equal(Object.keys(first).length, Object.keys(raw).length);
    assert.deepEqual(normalizeSpecsObject(first).normalized, first);
  }
  for (const invalid of [
    { ancho: 760, largo: null }, { ancho: 760, largo: 1830, grosor: 30 },
    { ancho: "760", largo: 1830 }, { ancho: 0, largo: 1830 }, { ancho: 760, largo: 20001 },
    { ancho: 760.0001, largo: 1830 }, { ancho: 760, largo: Infinity }
  ]) assert.equal(normalizeSpecsObject({ [basket]: invalid }).normalized[basket], undefined);
  for (const invalid of [
    { largo: 1185, ancho: null, grosor: 30 }, { largo: 1185, ancho: null },
    { largo: 1185, ancho: 0, grosor: null }, { largo: 1185, ancho: 100, grosor: -1 },
    { largo: 1185, ancho: 100, grosor: null, unidad: "cm" }
  ]) assert.equal(normalizeSpecsObject({ [forks]: invalid }).normalized[forks], undefined);
});


test("las unidades de longitud repetidas solo se interpretan cuando son equivalentes", async () => {
  for (const [key, raw, target, expected] of [
    ["Centro de carga", "500mm mm", "Centro de carga (mm)", 500],
    ["Alcance lateral", "8,5 m metros", "Alcance lateral", 8.5],
    ["Longitud (m)", "4,5 metros m", "Longitud (mm)", 4500],
    ["Anchura", "80 cm CM", "Anchura (mm)", 800]
  ] as const) {
    const first = normalizeSpecsObject({ [key]: raw });
    assert.deepEqual(first.normalized, { [target]: expected });
    assert.deepEqual(first.discardedSpecs, []);
    assert.equal(parseSpecByRule(key, raw), expected);
    assert.deepEqual(normalizeSpecsObject(first.normalized).normalized, first.normalized);
    const row: Record<string, string> = { reference: "SINTETICA", specJson: JSON.stringify({ [key]: raw }) };
    await normalizeGamRows([row], ["reference", "specJson"], { expandSpecColumns: true, maxValuesPerKey: 10 }, async () => {});
    assert.deepEqual(JSON.parse(row.specJson ?? "{}"), first.normalized);
  }
  for (const [key, raw] of [
    ["Centro de carga", "500 mm m"], ["Longitud (m)", "500 mm mm"],
    ["Altura Plataforma", "6085mm metros"], ["Alcance lateral", "2.168 m metros"],
    ["Anchura", "800 mm mm mm"], ["Anchura", "800 / 900 mm mm"], ["Anchura", "800 kg kg"]
  ] as const) {
    assert.deepEqual(normalizeSpecsObject({ [key]: raw }).normalized, {}, raw);
    assert.equal(parseSpecByRule(key, raw), null, raw);
  }
  assert.deepEqual(normalizeSpecsObject({ "Centro de carga": "500mm mm", "Centro de carga (mm)": "600 mm" }).conflictingKeys,
    [{ key: "Centro de carga (mm)", sources: ["Centro de carga", "Centro de carga (mm)"] }]);
});


test("las masas específicas conservan su significado, unidad y valor entre normalizador, CSV y seed", async () => {
  const keys = ["Peso maquina", "Peso operativo", "Peso sin carga", "Peso de servicio", "Peso con batería",
    "Peso en orden de marcha del modelo", "Peso neto del portapaneles"];
  const input = Object.fromEntries(keys.map((key, index) => [key, `${1000 + index},5 kg`]));
  const expected = Object.fromEntries(keys.map((key, index) => [key, 1000.5 + index]));
  const raw = { ...input, Peso: "800 kg" };
  const normalized = { ...expected, "Peso (kg)": 800 };
  const result = normalizeSpecsObject(raw);
  assert.deepEqual(result.normalized, normalized);
  assert.deepEqual(result.conflictingKeys, []);
  assert.deepEqual(result.discardedSpecs, []);
  assert.deepEqual(normalizeSpecsObject(normalized).normalized, normalized);
  const row: Record<string, string> = { reference: "CONTROL", specJson: JSON.stringify(raw) };
  await normalizeGamRows([row], ["reference", "specJson"], { expandSpecColumns: true, maxValuesPerKey: 10 }, async () => {});
  assert.deepEqual(JSON.parse(row.specJson ?? "{}"), normalized);
  for (const key of keys) {
    assert.equal(parseSpecByRule(key, row[`spec__${key}`]), expected[key]);
    for (const value of ["1000", "1000 L", "1000 mm", "1000/1200 kg", "1000 kg opcional", "kg", -1, true]) {
      assert.equal(normalizeSpecsObject({ [key]: value }).normalized[key], undefined);
    }
  }
  assert.deepEqual(normalizeSpecsObject({ "Peso operativo": "1000 kg", "PESO OPERATIVO": "1200 kg" }).conflictingKeys.map(({ key }) => key), ["Peso operativo"]);
});


test("la anchura de limpieza se interpreta como anchura de trabajo sin mezclar anchuras exteriores", () => {
  for (const key of ["Anchura limpieza", "Ancho de limpieza"]) {
    const normalized = normalizeSpecsObject({ [key]: "0,93 m", Anchura: "1250 mm" }).normalized;
    assert.deepEqual(normalized, { "Anchura trabajo (mm)": 930, "Anchura (mm)": 1250 });
    assert.deepEqual(normalizeSpecsObject(normalized).normalized, normalized);
    assert.equal(parseSpecByRule(key, "93 cm"), 930);
    for (const value of ["93 kg", "93/110 cm", "93 cm opcional"]) {
      assert.deepEqual(normalizeSpecsObject({ [key]: value }).normalized, {});
    }
    assert.equal(normalizeSpecsObject({ [key]: "93 cm", "Anchura de trabajo": "1100 mm" }).conflictingKeys.length, 1);
  }
});


test("normaliza alias geométricos explícitos sin mezclar condiciones ni perder ejes", () => {
  for (const [alias, canonical, raw, expected] of [
    ["Longitud de horquillas", "Largo horquillas", "1,2 m", 1200],
    ["Longitud de transporte", "Longitud transporte", "2980 mm", 2.98],
    ["Alcance horizontal máximo", "Alcance horizontal max.", "12,5 m", 12.5],
    ["Dimensiones de cesta", "Dimensiones cesta (mm)", "1,4 x 0,7 x 1,1 m", "1400 x 700 x 1100 mm"],
    ["Dimensiones de la cesta", "Dimensiones cesta (mm)", "1400 x 700 x 1100 mm", "1400 x 700 x 1100 mm"]
  ] as const) {
    const result = normalizeSpecsObject({ [alias]: raw });
    assert.deepEqual(result.normalized, { [canonical]: expected });
    assert.deepEqual(normalizeSpecsObject(result.normalized).normalized, result.normalized);
    assert.equal(parseSpecByRule(alias, raw), expected);
    for (const invalid of ["1200 kg", "1–2 m", "Opcional"]) {
      assert.equal(normalizeSpecsObject({ [alias]: invalid }).normalized[canonical], undefined);
    }
  }
  assert.deepEqual(normalizeSpecsObject({ "Dimensiones de la cesta": "2,4 x 0,9 m" }).normalized,
    { "Dimensiones cesta (mm)": { ancho: 2400, largo: 900 } });
  assert.deepEqual(normalizeSpecsObject({ "Longitud de transporte": "2,98 m", Longitud: "4 m", "Longitud sin horquillas": "3 m" }).normalized,
    { "Longitud transporte": 2.98, "Longitud (mm)": 4000, "Longitud sin horquillas": 3000 });
  assert.equal(normalizeSpecsObject({ "Longitud de horquillas": "1200 mm", "Largo horquillas": "1500 mm" }).conflictingKeys.length, 1);
  assert.equal(normalizeSpecsObject({ "Alcance horizontal máximo": "8 m", "Alcance lateral": "6 m" }).normalized["Alcance lateral"], 6);
});


test("las prestaciones de limpieza conservan la dimensión y el alcance funcional", () => {
  const result = normalizeSpecsObject({
    "Caudal de aire de aspiración": "55,6 l/s",
    "Anchura del cepillo principal": "81 cm",
    "Anchura del cepillo lateral": "510 mm",
    "Anchura de barrido con cepillo principal": "0,7 m",
    "Anchura máxima de fregado con escobilla lateral": "1,37 m"
  });
  assert.deepEqual(result.normalized, {
    "Caudal de aire de aspiración (l/s)": 55.6,
    "Anchura del cepillo principal (mm)": 810,
    "Anchura del cepillo lateral (mm)": 510,
    "Anchura de barrido con cepillo principal": 700,
    "Anchura máxima de fregado con cepillo lateral": 1370
  });
  assert.deepEqual(normalizeSpecsObject(result.normalized).normalized, result.normalized);
  for (const raw of ["55,6 l", "55,6 l/min", "55,6 m³/h", "40–60 l/s", "55 l/s opcional"]) {
    assert.equal(normalizeSpecsObject({ "Caudal de aire de aspiración": raw }).normalized["Caudal de aire de aspiración (l/s)"], undefined, raw);
  }
  for (const raw of ["500 kg", "500/600 mm", "500 mm opcional"]) {
    assert.equal(normalizeSpecsObject({ "Anchura del cepillo principal": raw }).normalized["Anchura del cepillo principal (mm)"], undefined, raw);
  }
  assert.equal(normalizeSpecsObject({ "Anchura máxima de fregado con escobilla lateral": "1,37 m",
    "Anchura máxima de fregado con cepillo lateral": "1200 mm" }).conflictingKeys.length, 1);
  assert.equal(normalizeSpecsObject({ "Medida del cepillo lateral de barrido": "530 mm" }).unknownKeys.length, 1);
});


test("conserva los rangos hidráulicos de diseño sin confundir presión y caudal", () => {
  const pressure = "Presión de aceite de trabajo del modelo";
  const flow = "Caudal de aceite del modelo";
  const expected = { [pressure]: "80-120 bar", [flow]: "25,5-40 l/min" };
  assert.deepEqual(normalizeSpecsObject({ [pressure]: "80–120 BAR", [flow]: "25.5 – 40 L/min" }).normalized, expected);
  assert.deepEqual(normalizeSpecsObject(expected).normalized, expected);
  for (const value of ["120-80 bar", "0-120 bar", "80-120", "80-120 l/min", "80/120 bar", "80-120 bar opcional", "1.234-120 bar", ["80-120 bar"]]) {
    assert.equal(normalizeSpecsObject({ [pressure]: value }).normalized[pressure], undefined);
  }
  for (const value of ["40-25 l/min", "25-40 l/s", "25-40 bar", "25-40 l", "25-40 l/min según modelo"]) {
    assert.equal(normalizeSpecsObject({ [flow]: value }).normalized[flow], undefined);
  }
  assert.deepEqual(normalizeSpecsObject({ "Presión hidráulica": "80-120 bar", "Caudal nominal": "25-40 l/min" }).normalized, {});
});


test("los rangos dimensionales admitidos conservan los extremos y las condiciones de la prestación", () => {
  for (const key of ["Altura de trabajo con caja inclinada", "Anchura de caja admitida", "Diámetro admitido de bidón"]) {
    const normalized = { [key]: "300-600 mm" };
    assert.deepEqual(normalizeSpecsObject({ [key]: "300–600 mm" }).normalized, normalized);
    assert.deepEqual(normalizeSpecsObject(normalized).normalized, normalized);
    assert.equal(parseSpecByRule(key, "300–600 mm"), "300-600 mm");
    for (const invalid of ["600-300 mm", "0-300 mm", "300/600 mm", "300-600 kg", "300-600", "300-600 mm opcional", ["300-600 mm"]]) {
      assert.equal(normalizeSpecsObject({ [key]: invalid }).normalized[key], undefined);
    }
  }
  const key = "Recorrido de elevación";
  assert.deepEqual(normalizeSpecsObject({ [key]: "0,8 m", "Altura de elevación (mm)": "1050 mm" }).normalized,
    { [key]: 800, "Altura de elevación (mm)": 1050 });
  assert.equal(parseSpecByRule(key, "80 cm"), 800);
  assert.equal(normalizeSpecsObject({ [key]: 800 }).normalized[key], 800);
  for (const invalid of ["300-600 mm", "300 kg", "300/600 mm"]) {
    assert.equal(normalizeSpecsObject({ [key]: invalid }).normalized[key], undefined);
  }
});
