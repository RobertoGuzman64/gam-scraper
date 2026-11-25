import assert from "node:assert/strict";
import test from "node:test";
import { parseSpecByRule } from "../../../tools/gam/seed/internal/spec.js";
import { normalizeSpecsObject } from "../normalize-specs.js";
import { parseDimension, parseDimensionRect, parseYear } from "../spec-parsers.js";

test("N02 conserva modelos y valores técnicos con palabras que forman parte de la descripción", () => {
  for (const model of ["BCS S16H Descarga alto", "BCS S16L Descarga baja"]) {
    assert.equal(normalizeSpecsObject({ Modelo: model }).normalized.Modelo, model);
  }
  const charger = "Cargador externo 2A para batería de 10 Ah";
  assert.equal(normalizeSpecsObject({ "Cargador de batería": charger }).normalized["Cargador de batería"], charger);
  assert.deepEqual(normalizeSpecsObject({ Modelo: ["BCS S16H Descarga alto", "BCS S16L Descarga baja"] }).normalized.Modelo,
    "BCS S16H Descarga alto BCS S16L Descarga baja");
  for (const value of ["Modelo", "peso", "Altura (mm)", "Carga Máxima (kg)", "Cargador de batería"]) {
    assert.equal(normalizeSpecsObject({ Modelo: value }).normalized.Modelo, undefined, value);
  }
  assert.equal(normalizeSpecsObject({ Modelo: ["Modelo", "BCS S16L Descarga baja"] }).normalized.Modelo,
    "BCS S16L Descarga baja");
});

test("N07 interpreta geometría completa en milímetros sin perder decimales ni mezclar unidades", () => {
  for (const [raw, expected] of [
    ["1180x170x55 mm", { largo: 1180, ancho: 170, grosor: 55 }],
    ["1,2 x 0,1 x 0,04 m", { largo: 1200, ancho: 100, grosor: 40 }],
    ["1,2 m × 10 cm × 40 mm", { largo: 1200, ancho: 100, grosor: 40 }],
    ["120 x 10 x 4 cm", { largo: 1200, ancho: 100, grosor: 40 }],
    ["1.200 x 100 x 40 mm", { largo: 1200, ancho: 100, grosor: 40 }],
    ["1180 mm", { largo: 1180, ancho: null, grosor: null }],
    ["1200×80 mm", { largo: 1200, ancho: 80, grosor: null }]
  ] as const) {
    assert.deepEqual(parseDimension(raw), expected, raw);
    assert.deepEqual(normalizeSpecsObject({ "Dimensiones Horquillas": raw }).normalized["Dimensiones horquillas (mm)"], expected, raw);
  }
  assert.deepEqual(parseSpecByRule("Dimensiones horquillas (mm)", "1,2 x 0,1 x 0,04 m"), [1200, 100, 40]);
  assert.deepEqual(parseDimensionRect("1,2 m x 80 cm"), { ancho: 1200, largo: 800 });
  assert.deepEqual(parseDimensionRect("1,83 x 0,76 metros"), { ancho: 1830, largo: 760 });
  assert.deepEqual(parseDimensionRect("2,27 x 1,12 m metros"), { ancho: 2270, largo: 1120 });
});

test("N07 descarta medidas contaminadas, incompletas, imposibles o con unidades incompatibles", () => {
  const contaminated = "1 1,8 x 0,8 8 8 x 0 metros";
  assert.equal(normalizeSpecsObject({ "Dimensiones Cesta": contaminated }).normalized["Dimensiones cesta (mm)"], undefined);
  for (const raw of [
    "1 1,8 x 0,8 8 8 x 0 metros", "1,2 x 0,1 x 0,04 x 0,02 m",
    "1,2 m x 10 x 40 mm", "1,2 x 10 cm x 40 mm",
    "1,2 x 0,1 x 0,04 kg", "1200x100x0 mm",
    "1200-100-40 mm", "1200x100 mm y 40 mm", "22000x100x40 mm", "1200x100x40"
  ]) {
    const isValidUnitless = raw === "1200x100x40";
    assert.deepEqual(parseDimension(raw), isValidUnitless ? { largo: 1200, ancho: 100, grosor: 40 } : null, raw);
  }
  for (const raw of ["1 76 83X0 metros", "1400x700x1100 metros", "1400x700 metros", "1,83 x 0,76"]) {
    assert.equal(parseDimensionRect(raw), null, raw);
  }
});

test("N08 solo acepta años de fabricación de cuatro cifras y no infiere año de título o URL", () => {
  assert.equal(normalizeSpecsObject({ "Año de fabricación": "28" }).normalized.Año, undefined);
  assert.equal(normalizeSpecsObject({ "Año de fabricación": "28" }).droppedNullLikeKeys.includes("Año"), true);
  assert.equal(parseSpecByRule("Año", "28"), null);
  for (const valid of ["1900", "2000", "2012", "2026", 2025]) {
    assert.equal(parseYear(valid), Number(valid));
    assert.equal(normalizeSpecsObject({ "Año de fabricación": valid }).normalized.Año, Number(valid));
  }
  for (const invalid of ["28", 28, "1899", "2099", String(new Date().getUTCFullYear() + 1), "2012.0", "2012/2013", "S85 2020", "", null]) {
    assert.equal(parseYear(invalid), null, String(invalid));
    assert.equal(normalizeSpecsObject({ "Año de fabricación": invalid }).normalized.Año, undefined, String(invalid));
  }
  assert.equal(normalizeSpecsObject({ Modelo: "S85", "Año de fabricación": "28" }).normalized.Año, undefined);
  assert.equal(parseSpecByRule("Año", "2012"), 2012);
  assert.equal(parseSpecByRule("Año", "2099"), null);
});

test("normaliza equipamiento booleano sin confundir opciones, ausencia o prestaciones distintas", () => {
  for (const key of ["Reducción de velocidad en curvas", "Sistema de diagnóstico", "Asiento regulable", "Luces de trabajo"]) {
    const alias = key.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toUpperCase();
    for (const [raw, expected] of [[true, true], [false, false], ["Sí", true], ["No", false]] as const) {
      assert.equal(normalizeSpecsObject({ [alias]: raw }).normalized[key], expected);
      assert.equal(parseSpecByRule(key, raw), expected);
      assert.deepEqual(normalizeSpecsObject({ [key]: expected }).unknownKeys, []);
    }
    for (const raw of ["Opcional", "No disponible", "Según configuración", "", null]) {
      assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], undefined);
    }
    if (alias !== key) {
      const conflict = normalizeSpecsObject({ [key]: true, [alias]: false });
      assert.equal(conflict.normalized[key], undefined);
      assert.equal(conflict.conflictingKeys.length, 1);
      assert.equal(normalizeSpecsObject({ [key]: true, [alias]: "Sí" }).normalized[key], true);
    }
  }
  const distinct = normalizeSpecsObject({ "Asiento con suspensión": true, "Luces LED": true,
    "Velocidad (km/h)": "5 km/h", "Diagnóstico externo": true });
  assert.deepEqual(distinct.normalized, { "Velocidad (km/h)": [5] });
});


test("normaliza las tres dimensiones de plataforma sin confundir geometría exterior ni extensión", () => {
  for (const [alias, canonical] of [
    ["Longitud plataforma", "Longitud de plataforma"],
    ["Ancho plataforma", "Anchura de plataforma"],
    ["EXTENSIÓN DE PLATAFORMA", "Extensión de plataforma"]
  ] as const) {
    for (const [raw, expected] of [["1,25 m", 1.25], ["125 cm", 1.25], ["1250 mm", 1.25], ["1,25 metros", 1.25]] as const) {
      assert.equal(normalizeSpecsObject({ [alias]: raw }).normalized[canonical], expected);
      assert.equal(parseSpecByRule(alias, raw), expected);
    }
    assert.equal(normalizeSpecsObject({ [`${alias} (mm)`]: 1250 }).normalized[canonical], 1.25);
    assert.equal(normalizeSpecsObject({ [`${alias} (cm)`]: "125 cm" }).normalized[canonical], 1.25);
    assert.equal(normalizeSpecsObject({ [`${alias} (mm)`]: "1,25 m" }).normalized[canonical], undefined);
    for (const raw of ["1,25 kg", "1,25–1,50 m", "1,25 m opcional", "-1 m", "1,25 x 2 m"]) {
      assert.equal(normalizeSpecsObject({ [alias]: raw }).normalized[canonical], undefined, raw);
    }
    assert.equal(normalizeSpecsObject({ [alias]: "1250 mm", [canonical]: "1,25 m" }).normalized[canonical], 1.25);
    const conflict = normalizeSpecsObject({ [alias]: "1,25 m", [canonical]: "1,50 m" });
    assert.equal(conflict.normalized[canonical], undefined);
    assert.equal(conflict.conflictingKeys.length, 1);
  }
  assert.deepEqual(normalizeSpecsObject({ Longitud: "3 m", Anchura: "2 m", "Longitud plataforma": "1,25 m", "Ancho plataforma": "0,8 m", "Extensión de plataforma": "0,5 m" }).normalized, {
    "Longitud (mm)": 3000, "Anchura (mm)": 2000, "Longitud de plataforma": 1.25, "Anchura de plataforma": 0.8, "Extensión de plataforma": 0.5
  });
});


test("normaliza alturas de almacenaje y transporte conservando cada condición de medida", () => {
  const keys = ["Altura almacenaje", "Altura replegada", "Altura barandilla bajada"] as const;
  for (const key of keys) {
    for (const [raw, expected] of [["2,15 m", 2.15], ["215 cm", 2.15], ["2150 mm", 2.15], ["2,15 metros", 2.15]] as const) {
      assert.equal(normalizeSpecsObject({ [key.toUpperCase()]: raw }).normalized[key], expected);
      assert.equal(parseSpecByRule(key, raw), expected);
    }
    assert.equal(normalizeSpecsObject({ [`${key} (mm)`]: 2150 }).normalized[key], 2.15);
    assert.equal(normalizeSpecsObject({ [`${key} (cm)`]: "215 cm" }).normalized[key], 2.15);
    assert.equal(normalizeSpecsObject({ [`${key} (mm)`]: "2,15 m" }).normalized[key], undefined);
    for (const raw of ["2,15 kg", "2,15–2,50 m", "2,15 m opcional", "-2 m", "2 x 3 m"]) {
      assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], undefined, raw);
    }
    assert.equal(normalizeSpecsObject({ [key]: "2,15 m", [`${key} (mm)`]: 2150 }).normalized[key], 2.15);
    const conflict = normalizeSpecsObject({ [key]: "2,15 m", [`${key} (mm)`]: 2500 });
    assert.equal(conflict.normalized[key], undefined);
    assert.equal(conflict.conflictingKeys.length, 1);
  }
  assert.deepEqual(normalizeSpecsObject({ Altura: "3 m", "Altura almacenaje": "2,5 m", "Altura replegada": "2,2 m", "Altura barandilla bajada": "1,8 m", "Altura de trabajo (m)": "8 m" }).normalized, {
    "Altura (mm)": 3000, "Altura almacenaje": 2.5, "Altura replegada": 2.2, "Altura barandilla bajada": 1.8, "Altura de trabajo (m)": 8
  });
});


test("normaliza equipamiento y capacidades booleanas de plataforma sin atribuir opciones", () => {
  for (const [alias, canonical] of [
    ["BARRA ANTIATRAPAMIENTO", "Barra antiatrapamiento"],
    ["Trabajo en negativo", "Trabajo negativo"],
    ["ESTABILIZADORES", "Estabilizadores"],
    ["NIVELACION AUTOMATICA", "Nivelación automática"]
  ] as const) {
    for (const [raw, expected] of [["Sí", true], ["No", false], [true, true], [false, false]] as const) {
      assert.equal(normalizeSpecsObject({ [alias]: raw }).normalized[canonical], expected);
      assert.equal(parseSpecByRule(alias, raw), expected);
      assert.equal(normalizeSpecsObject({ [canonical]: expected }).normalized[canonical], expected);
    }
    for (const raw of ["Opcional", "Según configuración", "No disponible", "", null]) {
      assert.equal(normalizeSpecsObject({ [alias]: raw }).normalized[canonical], undefined);
    }
    assert.equal(normalizeSpecsObject({ [alias]: "Sí", [canonical]: true }).normalized[canonical], true);
    const conflict = normalizeSpecsObject({ [alias]: "Sí", [canonical]: false });
    assert.equal(conflict.normalized[canonical], undefined);
    assert.equal(conflict.conflictingKeys.length, 1);
  }
  const distinct = normalizeSpecsObject({ Estabilizadores: "Sí", "Estabilizadores hidráulicos": "No",
    "Nivelación automática": "No", "Nivelación manual": "Sí", "Trabajo negativo": "No", "Altura de trabajo (m)": "8 m" });
  assert.deepEqual(distinct.normalized, { Estabilizadores: true, "Nivelación automática": false,
    "Trabajo negativo": false, "Altura de trabajo (m)": 8 });
});


test("normaliza geometría de articulación, transporte y plumín sin mezclar cotas", () => {
  for (const [alias, key] of [
    ["Altura de articulación", "Altura articulacion"],
    ["LONGITUD TRANSPORTE", "Longitud transporte"],
    ["Longitud del plumín", "Longitud de plumín"]
  ] as const) {
    for (const [raw, expected] of [["2,15 m", 2.15], ["215 cm", 2.15], ["2150 mm", 2.15], ["2,15 metros", 2.15]] as const) {
      assert.equal(normalizeSpecsObject({ [alias]: raw }).normalized[key], expected);
      assert.equal(parseSpecByRule(alias, raw), expected);
    }
    assert.equal(normalizeSpecsObject({ [`${alias} (mm)`]: 2150 }).normalized[key], 2.15);
    assert.equal(normalizeSpecsObject({ [`${alias} (cm)`]: "215 cm" }).normalized[key], 2.15);
    assert.equal(normalizeSpecsObject({ [`${alias} (mm)`]: "2,15 m" }).normalized[key], undefined);
    for (const raw of ["2,15 kg", "2,15–2,50 m", "2,15 m opcional", "-2 m", "2 x 3 m"]) {
      assert.equal(normalizeSpecsObject({ [alias]: raw }).normalized[key], undefined, raw);
    }
    assert.equal(normalizeSpecsObject({ [alias]: "2150 mm", [key]: "2,15 m" }).normalized[key], 2.15);
    const conflict = normalizeSpecsObject({ [alias]: "2,15 m", [key]: "2,50 m" });
    assert.equal(conflict.normalized[key], undefined);
    assert.equal(conflict.conflictingKeys.length, 1);
  }
  assert.deepEqual(normalizeSpecsObject({ Altura: "2 m", "Altura de trabajo (m)": "12 m", "Altura de articulación": "5 m",
    Longitud: "6 m", "Longitud transporte": "5 m", "Longitud del plumín": "1,2 m" }).normalized, {
    "Altura (mm)": 2000, "Altura de trabajo (m)": 12, "Altura articulacion": 5,
    "Longitud (mm)": 6000, "Longitud transporte": 5, "Longitud de plumín": 1.2
  });
});


test("normaliza altura de plataforma y alcances declarados sin mezclar sus condiciones", () => {
  for (const key of ["Altura de plataforma", "Alcance lateral", "Alcance horizontal max."] as const) {
    for (const [raw, expected] of [["7,25 m", 7.25], ["725 cm", 7.25], ["7250 mm", 7.25], ["0 m", 0]] as const) {
      assert.equal(normalizeSpecsObject({ [key.toUpperCase()]: raw }).normalized[key], expected);
      assert.equal(parseSpecByRule(key, raw), expected);
    }
    assert.equal(normalizeSpecsObject({ [`${key} (mm)`]: 7250 }).normalized[key], 7.25);
    assert.equal(normalizeSpecsObject({ [`${key} (cm)`]: "725 cm" }).normalized[key], 7.25);
    assert.equal(normalizeSpecsObject({ [`${key} (mm)`]: "7,25 m" }).normalized[key], undefined);
    for (const raw of ["7,25 kg", "7–8 m", "7 m opcional", "-2 m", "7 x 3 m", "7.2 m, 3.40 m"]) {
      assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], undefined, raw);
    }
    assert.equal(normalizeSpecsObject({ [key]: "7,25 m", [`${key} (mm)`]: 7250 }).normalized[key], 7.25);
    const conflict = normalizeSpecsObject({ [key]: "7,25 m", [`${key} (mm)`]: 8000 });
    assert.equal(conflict.normalized[key], undefined);
    assert.equal(conflict.conflictingKeys.length, 1);
  }
  assert.deepEqual(normalizeSpecsObject({ "Altura de plataforma": "8 m", "Altura de trabajo (m)": "10 m",
    "Alcance lateral": "5 m", "Alcance horizontal max.": "6 m", "Alcance horizontal": "4 m" }).normalized, {
    "Altura de plataforma": 8, "Altura de trabajo (m)": 10, "Alcance lateral": 5,
    "Alcance horizontal max.": 6, "Alcance horizontal (m)": 4
  });
});


test("normaliza cotas nominales y condicionadas sin fusionarlas con medidas de unidad", () => {
  for (const [key, expected] of [
    ["Centro de carga nominal del modelo", 600], ["Longitud sin horquillas", 600], ["Longitud extensión", 0.6]
  ] as const) {
    for (const raw of ["600 mm", "60 cm", "0,6 m"]) {
      assert.equal(normalizeSpecsObject({ [key.toUpperCase()]: raw }).normalized[key], expected);
      assert.equal(parseSpecByRule(key, raw), expected);
    }
    assert.equal(normalizeSpecsObject({ [`${key} (mm)`]: 600 }).normalized[key], expected);
    assert.equal(normalizeSpecsObject({ [`${key} (mm)`]: "0,6 m" }).normalized[key], undefined);
    for (const raw of ["600 kg", "600–800 mm", "600 mm opcional", "-600 mm", "600 x 800 mm"]) {
      assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], undefined);
    }
    assert.equal(normalizeSpecsObject({ [key]: "60 cm", [`${key} (mm)`]: 600 }).normalized[key], expected);
    const conflict = normalizeSpecsObject({ [key]: "60 cm", [`${key} (mm)`]: 800 });
    assert.equal(conflict.normalized[key], undefined);
    assert.equal(conflict.conflictingKeys.length, 1);
  }
  assert.deepEqual(normalizeSpecsObject({ "Centro de carga": "500 mm", "Centro de carga nominal del modelo": "600 mm",
    Longitud: "3 m", "Longitud sin horquillas": "2 m", "Longitud extensión": "0,6 m", "Extensión de plataforma": "0,8 m" }).normalized, {
    "Centro de carga (mm)": 500, "Centro de carga nominal del modelo": 600, "Longitud (mm)": 3000,
    "Longitud sin horquillas": 2000, "Longitud extensión": 0.6, "Extensión de plataforma": 0.8
  });
});


test("normaliza largo, alto y altura máxima de elevación conservando sus claves y unidades", () => {
  for (const key of ["Largo", "Alto", "Altura máxima de elevación"]) {
    for (const raw of ["2500 mm", "250 cm", "2,5 m"]) {
      assert.equal(normalizeSpecsObject({ [key.toUpperCase()]: raw }).normalized[key], 2500);
      assert.equal(parseSpecByRule(key, raw), 2500);
    }
    assert.equal(normalizeSpecsObject({ [`${key} (m)`]: 2.5 }).normalized[key], 2500);
    assert.equal(normalizeSpecsObject({ [`${key} (mm)`]: "2,5 m" }).normalized[key], undefined);
    for (const raw of ["2500 kg", "2500–3000 mm", "2500 mm opcional", "-2500 mm", "2500 x 3000 mm"]) {
      assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], undefined);
    }
    const conflict = normalizeSpecsObject({ [key]: "250 cm", [`${key} (mm)`]: 3000 });
    assert.equal(conflict.normalized[key], undefined);
    assert.equal(conflict.conflictingKeys.length, 1);
  }
  assert.deepEqual(normalizeSpecsObject({ Largo: "3 m", Alto: "2 m", "Altura máxima de elevación": "6 m",
    Longitud: "3,1 m", Altura: "2,1 m", "Altura de elevación (m)": "4,5 m" }).normalized, {
    Largo: 3000, Alto: 2000, "Altura máxima de elevación": 6000,
    "Longitud (mm)": 3100, "Altura (mm)": 2100, "Altura de elevación (m)": 4.5
  });
});


test("normaliza capacidades máximas en kg sin fusionar prestaciones ni aceptar otras unidades", () => {
  for (const key of ["Capacidad máxima de plataforma", "Capacidad máxima de elevación"]) {
    for (const raw of ["2500 kg", "2500kg", "2.500 kilogramos", 2500]) {
      assert.equal(normalizeSpecsObject({ [key.toUpperCase()]: raw }).normalized[key], 2500);
      assert.equal(parseSpecByRule(key, raw), 2500);
    }
    assert.equal(normalizeSpecsObject({ [`${key} (kg)`]: "2500 kg" }).normalized[key], 2500);
    for (const raw of ["2500 l", "2500 mm", "2,5 t", "2500–3000 kg", "2500 kg opcional", "-2500 kg"]) {
      assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], undefined, raw);
    }
    assert.equal(normalizeSpecsObject({ [key]: "2500 kg", [`${key} (kg)`]: 2500 }).normalized[key], 2500);
    const conflict = normalizeSpecsObject({ [key]: "2500 kg", [`${key} (kg)`]: 3000 });
    assert.equal(conflict.normalized[key], undefined);
    assert.equal(conflict.conflictingKeys.length, 1);
  }
  assert.deepEqual(normalizeSpecsObject({ "Capacidad máxima de plataforma": "230 kg",
    "Capacidad máxima de elevación": "2500 kg", "Capacidad de carga": "2000 kg" }).normalized, {
    "Capacidad máxima de plataforma": 230, "Capacidad máxima de elevación": 2500, "Capacidad de carga (kg)": [2000]
  });
  assert.deepEqual(normalizeSpecsObject({ Capacidad: "350 l" }).unknownKeys, ["Capacidad"]);
});


test("normaliza sistemas de seguridad sin fusionar funciones ni atribuir equipamiento opcional", () => {
  for (const key of ["Detección de obstáculos", "Control de tracción TCS", "Sistema antivuelco ACS", "Parada de emergencia"]) {
    const alias = key.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toUpperCase();
    for (const [raw, expected] of [[true, true], [false, false], ["Sí", true], ["No", false]] as const) {
      assert.equal(normalizeSpecsObject({ [alias]: raw }).normalized[key], expected);
      assert.equal(parseSpecByRule(key, raw), expected);
      assert.deepEqual(normalizeSpecsObject({ [key]: raw }).unknownKeys, []);
    }
    for (const raw of ["Opcional", "Según configuración", "No disponible", "", null]) {
      assert.equal(normalizeSpecsObject({ [alias]: raw }).normalized[key], undefined);
    }
    assert.equal(normalizeSpecsObject({ [alias]: "Sí", [key]: true }).normalized[key], true);
    const conflict = normalizeSpecsObject({ [alias]: "Sí", [key]: false });
    assert.equal(conflict.normalized[key], undefined);
    assert.equal(conflict.conflictingKeys.length, 1);
  }
  assert.deepEqual(normalizeSpecsObject({ "Control de tracción TCS": true, "Tracción 4x4": false,
    "Sistema antivuelco ACS": false, "Detección de obstáculos": true, "Parada de emergencia": false,
    "Sensores de obstáculos": true, "Control de tracción": true }).normalized, {
    "Control de tracción TCS": true, "Tracción 4x4": false, "Sistema antivuelco ACS": false,
    "Detección de obstáculos": true, "Parada de emergencia": false
  });
});


test("normaliza prestaciones de conducción y tecnología sin fusionar conceptos", () => {
  const specs = {
    "Tecnología del motor": "Corriente alterna",
    "Tecnología del motor de tracción": "Corriente continua",
    "Sistema de dirección": "Eléctrica",
    "Posición de conducción": "Operador a pie",
    "Tipo de conductor": "Hombre a bordo"
  };
  for (const [key, value] of Object.entries(specs)) {
    const alias = key.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toUpperCase();
    assert.deepEqual(normalizeSpecsObject({ [alias]: ` ${value} ` }).normalized, { [key]: value });
    assert.equal(parseSpecByRule(key, value), value);
    for (const raw of [null, "", "n/a", false, 42, key]) {
      assert.equal(normalizeSpecsObject({ [key]: raw }).normalized[key], undefined);
    }
    assert.equal(normalizeSpecsObject({ [alias]: value, [key]: value }).normalized[key], value);
    const conflict = normalizeSpecsObject({ [alias]: value, [key]: "Otra configuración" });
    assert.equal(conflict.normalized[key], undefined);
    assert.equal(conflict.conflictingKeys.length, 1);
  }
  assert.deepEqual(normalizeSpecsObject({ ...specs, "Tipo motor": "Eléctrico", "Dirección asistida": false }).normalized,
    { ...specs, "Tipo motor": "Eléctrico", "Dirección asistida": false });
});

test("interpreta unidades dimensionales compactas y decimales inferiores a uno sin suponer millares", () => {
  assert.deepEqual(parseDimensionRect("1,83x0,76m"), { ancho: 1830, largo: 760 });
  assert.deepEqual(parseDimensionRect("1.4m x 0.700m"), { ancho: 1400, largo: 700 });
  assert.deepEqual(parseDimension("1200 x 100 x 0.125 mm"), { largo: 1200, ancho: 100, grosor: 0.125 });
  assert.equal(parseDimensionRect("1.200x0,7m"), null);
  assert.equal(parseDimensionRect("01.200x0,7m"), null);
  assert.equal(parseDimensionRect("1400x700"), null);
  assert.equal(parseDimensionRect("1400x700kg"), null);
});


test("interpreta configuraciones operativas independientes sin fusionar accionamiento, tracción ni cabina", () => {
  const input = {
    "Tipo de motor": "Diésel", "Tipo motor": "Eléctrico", "Propulsión": "Manual",
    "Accionamiento de elevación": "Hidráulico manual", "Tipo de cabina": "Guardia superior",
    "Posición del conductor": "Peatonal", "Tipo de tracción": "4x4 conectable", "Tipo brazo": "articulada"
  };
  const result = normalizeSpecsObject(input);
  assert.deepEqual(result.normalized, input);
  assert.deepEqual(result.unknownKeys, []);
  assert.deepEqual(result.conflictingKeys, []);
  assert.deepEqual(normalizeSpecsObject(result.normalized).normalized, input);
  assert.deepEqual(normalizeSpecsObject({ "PROPULSION": "Eléctrica", "POSICION DEL CONDUCTOR": "Plataforma opcional" }).normalized,
    { "Propulsión": "Eléctrica", "Posición del conductor": "Plataforma opcional" });
  for (const key of Object.keys(input).filter((key) => key !== "Tipo motor")) {
    for (const value of [true, 24, "", "N/A", "Modelo"]) {
      assert.equal(normalizeSpecsObject({ [key]: value }).normalized[key], undefined);
    }
  }
  const conflict = normalizeSpecsObject({ "Tipo de motor": "Diésel", "TIPO DE MOTOR": "Eléctrico" });
  assert.equal(conflict.normalized["Tipo de motor"], undefined);
  assert.equal(conflict.conflictingKeys.length, 1);
});
