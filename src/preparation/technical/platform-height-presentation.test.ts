import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { preparedTechnicalConsistencyIssues } from "./technical-consistency.js";
import { normalizeSpecsObject } from "../../catalog/normalization/normalize-specs.js";
import { normalizeOriginalTechnicalPresentation, normalizeOriginalPlatformHeightPresentation, normalizeOriginalPlatformAxisPresentation } from "./technical-presentation.js";

test("la altura de plataforma explícita en metros utiliza el campo compartido sin alterar la altura de trabajo", () => {
  const original: SpecsMap = { "Altura Plataforma": "12.40 m", "Altura de trabajo": "14.40 m", "Altura almacenaje": "2,4 m" };
  const expected = { "Altura de plataforma": "12,40 m", "Altura de trabajo": "14,40 m", "Altura almacenaje": "2,4 m" };
  const output = normalizeOriginalTechnicalPresentation(original, original);
  assert.deepEqual(output, expected);
  assert.equal(normalizeOriginalTechnicalPresentation(output, original), output);
  assert.deepEqual(original, { "Altura Plataforma": "12.40 m", "Altura de trabajo": "14.40 m", "Altura almacenaje": "2,4 m" });
  assert.equal(normalizeSpecsObject(output).normalized["Altura de plataforma"], 12.4);
});

test("la altura de plataforma conserva milímetros, unidades ausentes, rangos, contradicciones y precedencias", () => {
  for (const raw of ["12400 mm", "12,4", "12/14 m", "2.168 metros", "12,4 m opcional", "0 m", "12,4 m mm"]) {
    const specs: SpecsMap = { "Altura plataforma": raw };
    assert.equal(normalizeOriginalPlatformHeightPresentation(specs, specs), specs);
  }
  const original: SpecsMap = { "Altura plataforma": "12 m" };
  const reconciled: SpecsMap = { "Altura plataforma": "14 m" };
  assert.equal(normalizeOriginalPlatformHeightPresentation(reconciled, original), reconciled);
  for (const other of ["Altura de plataforma", "Altura plataforma (mm)", "Altura plataforma (m)"]) {
    const conflicting: SpecsMap = { ...original, [other]: "14 m" };
    assert.equal(normalizeOriginalPlatformHeightPresentation(conflicting, conflicting), conflicting);
    assert.equal(normalizeOriginalPlatformHeightPresentation(original, conflicting), original);
  }
});

test("las denominaciones máximas de elevación reconocen la magnitud sin equiparar alturas distintas", () => {
  assert.equal(normalizeSpecsObject({ "Altura de elevacion max": "14 m" }).normalized["Altura máxima de elevación"], 14000);
  assert.equal(normalizeSpecsObject({ "Altura de elevacion max": "14/15 m" }).normalized["Altura máxima de elevación"], undefined);
  assert.deepEqual(normalizeSpecsObject({ "Altura elevacion max": "10,5 m" }).unknownKeys, ["Altura elevacion max"]);
  const result = normalizeSpecsObject({ "Altura de elevacion max": "14 m", "Altura de trabajo": "16 m", "Altura de plataforma": "12 m", "Alcance maximo": "15 m" });
  assert.deepEqual(result.normalized, { "Altura máxima de elevación": 14000, "Altura de trabajo (mm)": 16000, "Altura de plataforma": 12 });
  assert.deepEqual(result.unknownKeys, ["Alcance maximo"]);
});

test("la altura de plataforma conserva la procedencia de unidad durante la preparación", () => {
  const record: ProductRecord = {
    providerId: "gam", categoryKey: "prueba", categoryName: "Maquinaria",
    url: "https://example.com/producto/demo", title: "Equipo DEMO", shortDescription: null,
    longDescription: null, price: null, reference: "PRUEBA-1", brand: "EQUIPTEST", model: "DEMO",
    year: null, location: null, country: null, horometer: null, serialNumber: null, image: null,
    specs: { "Altura Plataforma": "12.40 m" }
  };
  const result = prepareSourceProduct(record);
  assert.equal(result.product.spec["Altura Plataforma"], undefined);
  assert.equal(result.product.spec["Altura de plataforma"], "12,40 m");
  assert.deepEqual(result.technicalProvenance?.entries.find((entry) => entry.field === "Altura de plataforma"), {
    field: "Altura de plataforma", value: "12,40 m", scope: "unit", sourceField: "Altura Plataforma",
    sourceValue: "12.40 m", mechanism: "src/preparation/technical/technical-presentation.ts"
  });
  assert.deepEqual(record.specs, { "Altura Plataforma": "12.40 m" });
});


test("las medidas de plataforma usan denominaciones compartidas, preservando sus ejes y procedencia", () => {
  const original: SpecsMap = { "Longitud plataforma": "2,40 m", "Ancho plataforma": "0,85 m", "Extensión plataforma": "0,5 m", Longitud: "3 m", Anchura: "1 m" };
  const changes: string[] = [];
  const output = normalizeOriginalPlatformAxisPresentation(original, original, (_before, _after, _mechanism, field) => {
    if (typeof field === "object") changes.push(field.spec);
  });
  assert.deepEqual(output, { "Longitud de plataforma": "2,40 m", "Anchura de plataforma": "0,85 m", "Extensión de plataforma": "0,5 m", Longitud: "3 m", Anchura: "1 m" });
  assert.deepEqual(changes, ["Longitud plataforma", "Ancho plataforma", "Extensión plataforma"]);
  assert.equal(normalizeOriginalPlatformAxisPresentation(output, original), output);
  assert.equal(original["Longitud plataforma"], "2,40 m");
  assert.deepEqual(normalizeSpecsObject(output).normalized, normalizeSpecsObject(original).normalized);
});

test("las medidas de plataforma conservan conflictos, condiciones, unidades incompatibles y valores recuperados", () => {
  for (const raw of ["2/3 m", "0 m", "2,4", "2,4 kg", "2,4 m opcional", "2.400 m", "2400 mm"]) {
    const original: SpecsMap = { "Longitud plataforma": raw };
    assert.equal(normalizeOriginalPlatformAxisPresentation(original, original), original);
  }
  const incompatible: SpecsMap = { "Longitud plataforma (mm)": "2,4 m" };
  assert.equal(normalizeOriginalPlatformAxisPresentation(incompatible, incompatible), incompatible);
  const original: SpecsMap = { "Longitud plataforma": "2,4 m" };
  const recovered: SpecsMap = { "Longitud plataforma": "2,5 m" };
  const conflicting: SpecsMap = { ...original, "Longitud de plataforma": "2,5 m" };
  assert.equal(normalizeOriginalPlatformAxisPresentation(recovered, original), recovered);
  assert.equal(normalizeOriginalPlatformAxisPresentation(conflicting, conflicting), conflicting);
  assert.equal(normalizeOriginalPlatformAxisPresentation(original, conflicting), original);
});

test("la anchura total conserva el alcance de la medida y las cotas de plataforma", () => {
  const original: SpecsMap = { "Ancho total": "1,25 m", "Anchura de plataforma": "0,8 m" };
  const output = normalizeOriginalTechnicalPresentation(original, original);
  assert.deepEqual(output, { "Anchura total": "1,25 m", "Anchura de plataforma": "0,8 m" });
  assert.equal(normalizeOriginalTechnicalPresentation(output, original), output);
  for (const specs of [
    { "Ancho total": "1,25 m", Anchura: "1,2 m" },
    { "Ancho total": "1,25 m", "Anchura total": "1,25 m" },
    { "Ancho total": "1,25 / 1,4 m" }, { "Ancho total": "1,25 kg" }, { "Ancho total": "1,25 m opcional" }
  ]) {
    assert.equal(normalizeOriginalTechnicalPresentation(specs, specs), specs);
  }
  const corrected: SpecsMap = { "Ancho total": "1,5 m" };
  assert.equal(normalizeOriginalTechnicalPresentation(corrected, original), corrected);
});


test("las cotas condicionadas conservan la condición, los ejes y la medida original", () => {
  const original: SpecsMap = { "Altura barandilla bajada": "1,8 m", "Altura articulacion": "6 m",
    "Longitud transporte": "4,5 m", "Altura transporte": "2,8 m", "Altura replegada": "2 m", Longitud: "6 m" };
  const expected: SpecsMap = { "Altura con barandillas bajadas": "1,8 m", "Altura de articulación": "6 m",
    "Longitud transporte": "4,5 m", "Altura de transporte": "2,8 m", "Altura replegada": "2 m", Longitud: "6 m" };
  const output = normalizeOriginalTechnicalPresentation(original, original);
  assert.deepEqual(output, expected);
  assert.deepEqual(normalizeSpecsObject(output).normalized, normalizeSpecsObject(original).normalized);
  assert.equal(normalizeOriginalTechnicalPresentation(output, original), output);
  for (const input of [{ "Altura articulacion": "6/7 m" }, { "Altura articulacion": "6 kg" },
    { "Altura articulacion": "6 m", "Altura de articulación": "7 m" }, { "Longitud transporte": "6 m opcional" },
    { "Altura transporte": "2800 mm" }, { "Altura barandilla bajada": "1,8" }]) {
    assert.equal(normalizeOriginalTechnicalPresentation(input, input), input);
  }
  const recovered = { "Altura articulacion": "5 m" };
  assert.equal(normalizeOriginalTechnicalPresentation(recovered, original), recovered);
});

test("las alturas máximas y recogidas y la anchura con ejes recogidos no se fusionan", () => {
  const original = { "Altura max. replegada": "2485 mm", "Altura máxima de plataforma": "20 m",
    "Altura de plataforma recogida": "150 mm", "Anchura con ejes recogidos": "2,49 m",
    "Altura replegada": "2 m", "Altura de plataforma": "18 m", Anchura: "3 m" };
  const normalized = normalizeSpecsObject(original);
  assert.deepEqual(normalized.normalized, { "Altura máxima replegada": 2.485, "Altura máxima de plataforma": 20,
    "Altura de plataforma recogida": 0.15, "Anchura con ejes recogidos": 2.49,
    "Altura replegada": 2, "Altura de plataforma": 18, "Anchura (mm)": 3000 });
  assert.deepEqual(normalizeSpecsObject(normalized.normalized).normalized, normalized.normalized);
  for (const key of ["Altura máxima replegada", "Altura máxima de plataforma", "Altura de plataforma recogida", "Anchura con ejes recogidos"]) {
    for (const value of ["3", "3 m mm", "3/4 m", "3 kg", "3 m opcional"]) {
      assert.equal(normalizeSpecsObject({ [key]: value }).normalized[key], undefined);
    }
  }
  assert.equal(normalizeSpecsObject({ "Altura max. replegada": "2 m", "Altura máxima replegada": "3 m" }).conflictingKeys.length, 1);
});


test("la coherencia de alturas de Gomariz evalúa ambas denominaciones sin ocultar contradicciones", () => {
  const record: ProductRecord = {
    providerId: "gomariz", categoryKey: "prueba", categoryName: "Maquinaria",
    url: "https://example.com/producto/demo", title: "Equipo DEMO", shortDescription: null,
    longDescription: null, price: null, reference: "PRUEBA-1", brand: "EQUIPTEST", model: "DEMO",
    year: null, location: null, country: null, horometer: null, serialNumber: null, image: null, specs: {}
  };
  const work = { "Altura de trabajo": "10 m" };
  for (const key of ["Altura plataforma", "Altura de plataforma"]) {
    assert.equal(preparedTechnicalConsistencyIssues(record, { ...work, [key]: "11 m" }).length, 1);
    assert.equal(preparedTechnicalConsistencyIssues(record, { ...work, [key]: "10 m" }).length, 1);
    for (const value of ["8 m", "12/14 m", "11000 mm", "11 kg"]) {
      assert.deepEqual(preparedTechnicalConsistencyIssues(record, { ...work, [key]: value }), []);
    }
  }
  assert.equal(preparedTechnicalConsistencyIssues(record, { ...work, "Altura plataforma": "8 m", "Altura de plataforma": "11 m" }).length, 1);
  assert.equal(preparedTechnicalConsistencyIssues(record, { ...work, "Altura plataforma": "11 m", "Altura de plataforma": "8 m" }).length, 1);
  assert.deepEqual(preparedTechnicalConsistencyIssues(record, { "Altura de plataforma": "11 m" }), []);
});


test("la presentación separa disponibilidad de elevación libre de una magnitud sin inventar una altura", () => {
  const key = "Elevación libre";
  const target = "Elevación libre disponible";
  for (const [raw, expected] of [["SI", true], ["No", false], ["Yes", true]] as const) {
    const original: SpecsMap = { [key]: raw };
    const current: SpecsMap = { [key]: raw === "SI" ? "Sí" : raw };
    const changes: string[] = [];
    const output = normalizeOriginalTechnicalPresentation(current, original, (_before, _after, _mechanism, field) => {
      if (typeof field === "object") changes.push(field.spec);
    });
    assert.deepEqual(output, { [target]: expected });
    assert.deepEqual(changes, [key]);
    assert.deepEqual(normalizeSpecsObject(output).normalized, { [target]: expected });
    assert.equal(normalizeOriginalTechnicalPresentation(output, original), output);
  }
  for (const raw of ["1600 mm", "1", "Sí / No", "Opcional", "Sí mm", true]) {
    const specs: SpecsMap = { [key]: raw };
    assert.equal(normalizeOriginalTechnicalPresentation(specs, specs), specs);
  }
  const original: SpecsMap = { [key]: "Sí" };
  for (const other of [{ [key]: "No" }, { ...original, [target]: true },
    { ...original, "Elevacion libre": "1500 mm" }, { ...original, "Elevación libre (mm)": "1500 mm" }]) {
    assert.equal(normalizeOriginalTechnicalPresentation(other, original), other);
    assert.equal(normalizeOriginalTechnicalPresentation(original, other), original);
  }
});
