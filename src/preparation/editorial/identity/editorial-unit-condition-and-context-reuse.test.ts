import assert from "node:assert/strict";

import test from "node:test";

import type { ProductRecord } from "../../../contracts/catalog.js";

import { resolveVerifiedEditorialCondition } from "./editorial-condition.js";

import { resolveEditorialIdentitySummary } from "./editorial-identity-summary.js";

import { resolveVerifiedTechnicalBrief } from "../measurements/editorial-technical-brief.js";

import { resolveVerifiedEditorialUnitContext } from "./editorial-unit-context.js";

import { controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift } from "../core/editorial-contract-records.js";

const general = "La ficha técnica describe exclusivamente la unidad indicada por el proveedor.";

const withConditionEvidence = (record: ProductRecord, condition: "Nuevo" | "Segunda mano"): ProductRecord => ({
  ...record,
  condition,
  specs: {
    ...record.specs,
    Estado: condition === "Nuevo" ? "Nuevo" : "Usado",
    Peso: "2400 kg",
    Longitud: "2,8 m"
  }
});

test("reutiliza la condición en nuevas unidades y descarta estados técnicos incompatibles", () => {
  for (const create of [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift]) {
    const conditions: readonly ("Nuevo" | "Segunda mano")[] = create === controlledGomarizForklift ?
      ["Segunda mano"] : ["Nuevo", "Segunda mano"];
    for (const condition of conditions) {
      const source = withConditionEvidence(create(), condition);
      const pattern = condition === "Nuevo" ? /nueva/u : /de ocasión/u;
      assert.equal(resolveVerifiedEditorialCondition(source), condition, source.providerId);
      assert.match(resolveEditorialIdentitySummary(source, null) ?? "", pattern, source.providerId);
      assert.match(resolveVerifiedTechnicalBrief(source, source) ?? "", pattern, source.providerId);
      const conflicting = {
        ...source,
        specs: { ...source.specs, Estado: condition === "Nuevo" ? "Usado" : "Nuevo" }
      };
      assert.equal(resolveVerifiedEditorialCondition(conflicting), null, source.providerId);
      assert.doesNotMatch(resolveEditorialIdentitySummary(conflicting, null) ?? "", /de ocasión|nueva/u, source.providerId);
      assert.doesNotMatch(resolveVerifiedTechnicalBrief(conflicting, conflicting) ?? "", /de ocasión|unidad nueva/u, source.providerId);
      assert.doesNotMatch(resolveVerifiedTechnicalBrief(source, conflicting) ?? "", /de ocasión|unidad nueva/u, source.providerId);
      assert.equal(resolveVerifiedEditorialCondition({ ...source, condition: null }), null, source.providerId);
    }
  }
});

test("permite unidades compatibles nuevas y bloquea datos propios de otra unidad", () => {
  const factories = [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift];
  for (const create of factories) {
    const base = create();
    const source: ProductRecord = {
      ...base,
      location: "Madrid",
      serialNumber: "UNIDAD7854",
      specs: { ...base.specs, Ubicación: "Madrid", "Nº de serie": "UNIDAD7854" }
    };
    const next: ProductRecord = {
      ...source,
      reference: "NUEVA-UNIDAD",
      url: base.url.replace(base.reference ?? "", "NUEVA-UNIDAD"),
      location: "Valencia",
      serialNumber: "UNIDAD9632",
      specs: { ...source.specs, Ubicación: "Valencia", "Nº de serie": "UNIDAD9632" }
    };
    const first = resolveVerifiedEditorialUnitContext(source, general, source) ?? "";
    const second = resolveVerifiedEditorialUnitContext(next, general, next) ?? "";
    assert.match(first, /Madrid.*UNIDAD7854/us, source.providerId);
    assert.match(second, /Valencia.*UNIDAD9632/us, source.providerId);
    assert.doesNotMatch(second, /UNIDAD7854|Madrid/u, source.providerId);
    assert.equal(resolveVerifiedEditorialUnitContext(source, general, next), general, source.providerId);
    assert.equal(resolveVerifiedEditorialUnitContext(source, general,
      { ...source, providerId: "proveedor-distinto" }), general, source.providerId);
    assert.equal(resolveVerifiedEditorialUnitContext(source, general,
      { ...source, specs: { ...source.specs, Ubicación: "Valencia", "Nº de serie": "UNIDAD9632" } }),
    general, source.providerId);
    assert.equal(resolveVerifiedEditorialUnitContext(source, general,
      { ...source, condition: "Nuevo" }), general, source.providerId);
  }
});

test("atribuye matriculación y restauración declaradas sin acreditar documentación ni trabajos", () => {
  for (const create of [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift]) {
    const source = withConditionEvidence(create(), "Segunda mano");
    const declared: ProductRecord = { ...source, specs: { ...source.specs, Matriculada: "SI", Restaurada: "Sí" } };
    const text = "La carretilla MARCA MODELO10 está destinada a la manutención.";
    const result = resolveVerifiedEditorialUnitContext(declared, text, declared) ?? "";
    assert.match(result, /unidad está matriculada; no se ha comprobado la vigencia/u);
    assert.match(result, /unidad está restaurada, sin especificar el alcance/u);
    assert.ok(result.startsWith(text));
    assert.equal(resolveVerifiedEditorialUnitContext(declared, result, declared), result);
    assert.equal(resolveVerifiedEditorialUnitContext(declared, text, { ...declared, reference: "OTRA" }), text);
    assert.equal(resolveVerifiedEditorialUnitContext(declared, text, { ...declared, providerId: "otro" }), text);
    assert.equal(resolveVerifiedEditorialUnitContext(declared, text, { ...declared, specs: { ...declared.specs, Matriculada: "No", Restaurada: "No" } }), text);
    assert.equal(resolveVerifiedEditorialUnitContext(declared, general, declared), general);
  }
});

test("no interpreta estados ambiguos, nuevas unidades o declaraciones contradictorias de historial", () => {
  const source = withConditionEvidence(controlledGamForklift(), "Segunda mano");
  const text = "La carretilla MARCA MODELO10 está destinada a la manutención.";
  const variants: readonly ProductRecord[] = [
    { ...source, specs: { ...source.specs, Matriculada: "Opcional", Restaurada: "Pendiente" } },
    { ...source, condition: "Nuevo", specs: { ...source.specs, Estado: "Nuevo", Matriculada: "Sí", Restaurada: "Sí" } },
    { ...source, longDescription: "No está matriculada ni restaurada.", specs: { ...source.specs, Matriculada: "Sí", Restaurada: "Sí" } },
    { ...source, specs: { ...source.specs, Matriculada: "Sí", "Reg. no.": "ABC-123", Restaurada: "No" } }
  ];
  for (const record of variants) assert.equal(resolveVerifiedEditorialUnitContext(record, text, record), text);
});

test("admite identidad estructurada y autenticada aunque el título de origen solo contenga el modelo", () => {
  const source: ProductRecord = {
    ...controlledGomarizForklift(),
    providerId: "manain",
    url: "https://manain.com/producto/venta-manipulacion-carretilla-marca-modelo10/",
    title: "MODELO10",
    specs: { Marca: "MARCA", Modelo: "MODELO10", "Nueva o usada": "usada", Matriculada: "SI", Restaurada: "SI" }
  };
  const text = "La carretilla MARCA MODELO10 está destinada a la manutención.";
  const result = resolveVerifiedEditorialUnitContext(source, text, source) ?? "";
  assert.match(result, /unidad está matriculada/u);
  assert.match(result, /unidad está restaurada/u);
  const other = { ...source, url: source.url.replace("modelo10", "modelo11") };
  assert.equal(resolveVerifiedEditorialUnitContext(other, text, other), text);
});

test("comunica la sustitución declarada del horómetro sin atribuir horas de uso", () => {
  const text = "La carretilla MARCA MODELO10 está destinada a la manutención.";
  for (const create of [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift]) {
    const base = withConditionEvidence(create(), "Segunda mano");
    const source: ProductRecord = { ...base, horometer: "Horometro sustituido horas",
      specs: { ...base.specs, "Horómetro": "Horometro sustituido horas" } };
    const prepared: ProductRecord = { ...source, horometer: null,
      specs: { ...source.specs, "Horómetro": "Horómetro sustituido" } };
    const result = resolveVerifiedEditorialUnitContext(source, text, prepared) ?? "";
    assert.match(result, /horómetro ha sido sustituido; no consta una lectura total de horas de uso acreditada/u);
    assert.ok(result.startsWith(text));
    assert.equal(resolveVerifiedEditorialUnitContext(source, result, prepared), result);
    assert.equal(resolveVerifiedEditorialUnitContext(source, text, { ...prepared, reference: "OTRA" }), text);
    assert.equal(resolveVerifiedEditorialUnitContext(source, text, { ...prepared, providerId: "otro" }), text);
    assert.equal(resolveVerifiedEditorialUnitContext(source, text, { ...prepared, specs: { ...prepared.specs, "Horómetro": "NA horas" } }), text);
    assert.equal(resolveVerifiedEditorialUnitContext(source, text, { ...prepared, horometer: "120" }), text);
    assert.equal(resolveVerifiedEditorialUnitContext(source, text, { ...prepared, specs: { ...prepared.specs, "Horas (h)": "120 horas" } }), text);
    assert.equal(resolveVerifiedEditorialUnitContext(source, general, prepared), general);
  }
});

test("conserva las menciones de horómetro y descarta marcadores no concluyentes", () => {
  const base = withConditionEvidence(controlledGamForklift(), "Segunda mano");
  const text = "La carretilla MARCA MODELO10 está destinada a la manutención.";
  for (const value of ["NA horas", "Horómetro pendiente de sustituir", "Horómetro no sustituido"]) {
    const source: ProductRecord = { ...base, horometer: value, specs: { ...base.specs, "Horómetro": value } };
    assert.equal(resolveVerifiedEditorialUnitContext(source, text, source), text);
  }
  const source: ProductRecord = { ...base, horometer: "Horometro sustituido horas",
    specs: { ...base.specs, "Horómetro": "Horometro sustituido horas" } };
  for (const longDescription of ["Horómetro original, sin sustitución.", "Lectura de 120 horas."]) {
    const record = { ...source, longDescription };
    assert.equal(resolveVerifiedEditorialUnitContext(record, text, record), text);
  }
  const already = `${text} El horómetro fue sustituido.`;
  assert.equal(resolveVerifiedEditorialUnitContext(source, already, source), already);
  const newUnit = { ...source, condition: "Nuevo" as const, specs: { ...source.specs, Estado: "Nuevo" } };
  assert.equal(resolveVerifiedEditorialUnitContext(newUnit, text, newUnit), text);
});


test("distingue el kilometraje declarado de autonomía y velocidad sin trasladarlo entre unidades", () => {
  const text = "El vehículo MARCA MODELO10 tiene una autonomía de hasta 90 km y una velocidad máxima de 45 km/h.";
  for (const create of [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift]) {
    const base = withConditionEvidence(create(), "Segunda mano");
    const source: ProductRecord = { ...base, title: "Vehículo MARCA MODELO10", longDescription: text,
      specs: { Marca: "MARCA", Modelo: "MODELO10", Estado: "Usado", "Kilómetros": "12345 KM" } };
    const prepared: ProductRecord = { ...source, specs: { ...source.specs, "Kilómetros": "12 345 km" } };
    const result = resolveVerifiedEditorialUnitContext(source, text, prepared) ?? "";
    assert.match(result, /kilometraje de 12\.345 km para esta unidad; no se ha verificado la lectura/u);
    assert.ok(result.startsWith(text));
    assert.equal(resolveVerifiedEditorialUnitContext(source, result, prepared), result);
    assert.equal(resolveVerifiedEditorialUnitContext(source, text, { ...prepared, reference: "OTRA" }), text);
    assert.equal(resolveVerifiedEditorialUnitContext(source, text, { ...prepared, providerId: "otro" }), text);
    assert.equal(resolveVerifiedEditorialUnitContext(source, text, { ...prepared, specs: { ...prepared.specs, "Kilómetros": "12346 km" } }), text);
    const next: ProductRecord = { ...source, reference: "NUEVA-UNIDAD",
      url: source.url.replace(source.reference ?? "", "NUEVA-UNIDAD"),
      specs: { ...source.specs, "Kilómetros (km)": "678 km", "Kilómetros": "678 KM" } };
    assert.match(resolveVerifiedEditorialUnitContext(next, text, next) ?? "", /kilometraje de 678 km/u);
  }
});

test("rechaza kilometrajes ambiguos, incompatibles y ya mencionados", () => {
  const base = withConditionEvidence(controlledGamForklift(), "Segunda mano");
  const text = "El vehículo MARCA MODELO10 tiene una autonomía de hasta 90 km.";
  const source: ProductRecord = { ...base, title: "Vehículo MARCA MODELO10", longDescription: text,
    specs: { Marca: "MARCA", Modelo: "MODELO10", Estado: "Usado", "Kilómetros": "12345 km" } };
  for (const value of ["0 km", "12345", "12.345 km", "12345 km/h", "12345-13000 km"]) {
    const record = { ...source, specs: { ...source.specs, "Kilómetros": value } };
    assert.equal(resolveVerifiedEditorialUnitContext(record, text, record), text);
  }
  for (const longDescription of ["Kilometraje pendiente de verificar.", "Recorrido de 300 km.", "12 346 km."]) {
    const record = { ...source, longDescription };
    assert.equal(resolveVerifiedEditorialUnitContext(record, text, record), text);
  }
  const conflict = { ...source, specs: { ...source.specs, "Kilómetros (km)": "12346 km" } };
  assert.equal(resolveVerifiedEditorialUnitContext(conflict, text, conflict), text);
  const newUnit: ProductRecord = { ...source, condition: "Nuevo", specs: { ...source.specs, Estado: "Nuevo" } };
  assert.equal(resolveVerifiedEditorialUnitContext(newUnit, text, newUnit), text);
  const already = `${text} El kilometraje declarado es de 12.345 km.`;
  assert.equal(resolveVerifiedEditorialUnitContext(source, already, source), already);
});

test("distingue baterías nuevas, ausencia de baterías y porcentaje declarado de la misma unidad", () => {
  const text = "La carretilla eléctrica MARCA MODELO10 se anuncia de ocasión.";
  for (const create of [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift]) {
    const base = withConditionEvidence(create(), "Segunda mano");
    const source: ProductRecord = { ...base, title: "Carretilla eléctrica MARCA MODELO10 2500 kg",
      specs: { ...base.specs, "Baterias nuevas": "SI" } };
    const prepared: ProductRecord = { ...source, specs: { ...base.specs, "Baterías nuevas": "Sí" } };
    const result = resolveVerifiedEditorialUnitContext(source, text, prepared) ?? "";
    assert.match(result, /declara baterías nuevas para esta unidad/u);
    assert.equal(resolveVerifiedEditorialUnitContext(source, result, prepared), result);
    assert.equal(resolveVerifiedEditorialUnitContext(source, text, { ...prepared, reference: "OTRA" }), text);
    const absent: ProductRecord = { ...source, specs: { ...base.specs, "Baterías nuevas": "SIN BATERÍAS" } };
    assert.match(resolveVerifiedEditorialUnitContext(absent, text, absent) ?? "", /anuncia esta unidad sin baterías/u);
    const percentage: ProductRecord = { ...source, specs: { ...base.specs, "Estado baterías": "75%" } };
    assert.match(resolveVerifiedEditorialUnitContext(percentage, text, percentage) ?? "", /indica 75 %.*no acredita capacidad residual ni autonomía/u);
    assert.equal(resolveVerifiedEditorialUnitContext(percentage, text, { ...percentage,
      specs: { ...base.specs, "Estado de baterías": "70%" } }), text);
  }
});

test("rechaza estados ambiguos de baterías y motorizaciones incompatibles", () => {
  const base = withConditionEvidence(controlledGamForklift(), "Segunda mano");
  const text = "La carretilla MARCA MODELO10 se anuncia de ocasión.";
  const source: ProductRecord = { ...base, title: "Carretilla eléctrica MARCA MODELO10 2500 kg",
    specs: { ...base.specs, "Baterías nuevas": "Sí" } };
  const variants: readonly ProductRecord[] = [
    { ...source, title: "Carretilla GLP MARCA MODELO10 2500 kg" },
    { ...source, specs: { ...source.specs, "Tipo motor": "Diésel" } },
    { ...source, longDescription: "Baterías pendientes de sustituir." },
    { ...source, specs: { ...source.specs, "Baterias nuevas": "No" } },
    { ...source, specs: { ...source.specs, "Estado baterías": "80%" } },
    { ...source, specs: { ...base.specs, "Baterías nuevas": "No" } },
    { ...source, specs: { ...base.specs, "Baterías nuevas": "SIN BATERÍAS", "Voltaje de la batería": "48 V" } },
    { ...source, specs: { ...base.specs, "Estado baterías": "80-90%" } },
    { ...source, specs: { ...base.specs, "Estado baterías": "101%" } },
    { ...source, condition: "Nuevo", specs: { ...source.specs, Estado: "Nuevo" } }
  ];
  for (const record of variants) assert.equal(resolveVerifiedEditorialUnitContext(record, text, record), text);
  const already = `${text} Se anuncian baterías nuevas.`;
  assert.equal(resolveVerifiedEditorialUnitContext(source, already, source), already);
});
