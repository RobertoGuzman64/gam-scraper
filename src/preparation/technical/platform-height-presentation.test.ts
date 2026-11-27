import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { reconcileGomarizRedundantWorkingHeight, reconcileGomarizRoundedWorkingHeight } from "../gomariz/technical/gomariz.js";
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
    "Longitud de transporte": "4,5 m", "Altura de transporte": "2,8 m", "Altura replegada": "2 m", Longitud: "6 m" };
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


test("la altura de trabajo explícita utiliza la denominación compartida sin mezclar cotas", () => {
  const source: SpecsMap = { "Altura trabajo": "12.40 m", "Altura de plataforma": "10,4 m", "Altura replegada": "2 m", Altura: "3 m" };
  const observed: string[] = [];
  const output = normalizeOriginalTechnicalPresentation(source, source, (_before, _after, _mechanism, field) => {
    if (typeof field === "object") observed.push(field.spec);
  });
  assert.deepEqual(output, { "Altura de trabajo": "12,40 m", "Altura de plataforma": "10,4 m", "Altura replegada": "2 m", Altura: "3 m" });
  assert.deepEqual(observed, ["Altura trabajo"]);
  assert.deepEqual(normalizeSpecsObject(output).normalized, normalizeSpecsObject(source).normalized);
  assert.equal(normalizeOriginalTechnicalPresentation(output, source), output);
  assert.equal(source["Altura trabajo"], "12.40 m");
  assert.deepEqual(normalizeOriginalTechnicalPresentation({ "Altura trabajo": "12/14 m" }, { "Altura trabajo": "12/14 m" }),
    { "Altura trabajo": "12 / 14 m" });
  for (const raw of ["0 m", "12400 mm", "12,4", "12,4 kg", "12,4 m opcional"]) {
    const invalid: SpecsMap = { "Altura trabajo": raw };
    assert.equal(normalizeOriginalTechnicalPresentation(invalid, invalid), invalid);
  }
  const original: SpecsMap = { "Altura trabajo": "12 m" };
  const altered: SpecsMap = { "Altura trabajo": "14 m" };
  assert.equal(normalizeOriginalTechnicalPresentation(altered, original), altered);
  for (const key of ["Altura de trabajo", "Altura de trabajo (m)", "Altura de trabajo (mm)"]) {
    const conflict: SpecsMap = { ...original, [key]: "14 m" };
    assert.equal(normalizeOriginalTechnicalPresentation(conflict, conflict), conflict);
    assert.equal(normalizeOriginalTechnicalPresentation(original, conflict), original);
  }
});


test("las cotas de transporte y el alcance máximo mantienen su significado y su evidencia", () => {
  const original: SpecsMap = { "Longitud transporte": "4,5 m", "Alcance horizontal max.": "8.2 m",
    "Longitud total": "6 m", "Alcance horizontal": "7 m", "Alcance lateral": "6 m" };
  const changes: string[] = [];
  const result = normalizeOriginalTechnicalPresentation(original, original, (_before, _after, _mechanism, field) => {
    if (typeof field === "object") changes.push(field.spec);
  });
  assert.deepEqual(result, { "Longitud de transporte": "4,5 m", "Alcance horizontal máximo": "8,2 m",
    "Longitud total": "6 m", "Alcance horizontal": "7 m", "Alcance lateral": "6 m" });
  assert.deepEqual(changes, ["Longitud transporte", "Alcance horizontal max."]);
  assert.deepEqual(normalizeSpecsObject(result).normalized, normalizeSpecsObject(original).normalized);
  assert.equal(normalizeOriginalTechnicalPresentation(result, original), result);
  for (const [alias, canonical] of [["Longitud transporte", "Longitud de transporte"],
    ["Alcance horizontal max.", "Alcance horizontal máximo"]] as const) {
    for (const value of ["0 m", "4,5", "4500 mm", "4,5 kg", "4,5 m opcional"]) {
      const invalid: SpecsMap = { [alias]: value };
      assert.equal(normalizeOriginalTechnicalPresentation(invalid, invalid), invalid);
    }
    const source: SpecsMap = { [alias]: "4,5 m" };
    const conflict: SpecsMap = { ...source, [canonical]: "5 m" };
    const altered: SpecsMap = { [alias]: "5 m" };
    assert.equal(normalizeOriginalTechnicalPresentation(conflict, conflict), conflict);
    assert.equal(normalizeOriginalTechnicalPresentation(source, conflict), source);
    assert.equal(normalizeOriginalTechnicalPresentation(altered, source), altered);
  }
});


test("la anchura explícita en milímetros comparte denominación sin confundir cotas condicionadas", () => {
  const original: SpecsMap = { Ancho: "1250 mm", "Anchura de plataforma": "0,8 m", "Anchura trabajo": "900 mm" };
  const observed: string[] = [];
  const result = normalizeOriginalTechnicalPresentation(original, original, (_before, _after, _mechanism, field) => {
    if (typeof field === "object") observed.push(field.spec);
  });
  assert.deepEqual(result, { Anchura: "1250 mm", "Anchura de plataforma": "0,8 m", "Anchura trabajo": "900 mm" });
  assert.deepEqual(observed, ["Ancho"]);
  assert.deepEqual(normalizeSpecsObject(result).normalized, normalizeSpecsObject(original).normalized);
  assert.equal(normalizeOriginalTechnicalPresentation(result, original), result);
  assert.equal(original.Ancho, "1250 mm");
});

test("la anchura conserva las alternativas, las unidades ambiguas y las medidas en conflicto", () => {
  for (const value of ["1250", "0 mm", "1250/1400 mm", "1250 mm opcional", "1,25 m", "1250 kg", "1250 mm mm"]) {
    const original = { Ancho: value };
    assert.equal(normalizeOriginalTechnicalPresentation(original, original), original);
  }
  const original = { Ancho: "1250 mm" };
  const altered = { Ancho: "1400 mm" };
  assert.equal(normalizeOriginalTechnicalPresentation(altered, original), altered);
  for (const key of ["Anchura", "Anchura total", "Ancho total", "Anchura (mm)"]) {
    const conflict = { ...original, [key]: "1400 mm" };
    assert.equal(normalizeOriginalTechnicalPresentation(conflict, conflict), conflict);
    assert.equal(normalizeOriginalTechnicalPresentation(original, conflict), original);
    assert.equal(normalizeOriginalTechnicalPresentation(conflict, original), conflict);
  }
  assert.equal(normalizeOriginalTechnicalPresentation(original, {}), original);
});


test("las dimensiones explícitas de cesta comparten denominación sin modificar sus ejes", () => {
  const original: SpecsMap = { "Dimensiones Cesta": "2,4X1,17 metros", "Anchura de plataforma": "1,17 m" };
  const observed: string[] = [];
  const result = normalizeOriginalTechnicalPresentation(original, original, (_before, _after, _mechanism, field) => {
    if (typeof field === "object") observed.push(field.spec);
  });
  assert.deepEqual(result, { "Dimensiones de cesta": "2,4 x 1,17 m", "Anchura de plataforma": "1,17 m" });
  assert.deepEqual(observed, ["Dimensiones Cesta"]);
  assert.deepEqual(normalizeSpecsObject(result).normalized, normalizeSpecsObject(original).normalized);
  assert.equal(normalizeOriginalTechnicalPresentation(result, original), result);
  assert.equal(original["Dimensiones Cesta"], "2,4X1,17 metros");
});

test("las dimensiones de cesta ambiguas, compuestas o contradictorias conservan sus claves", () => {
  for (const value of ["2 x 1", "2 x 1 x 1 m", "2 x 1 m metros", "2 x 0 m", "2 x 1 m opcional", "2 x 1 kg"]) {
    const original = { "Dimensiones Cesta": value };
    assert.equal(normalizeOriginalTechnicalPresentation(original, original)["Dimensiones de cesta"], undefined);
  }
  const original = { "Dimensiones Cesta": "2 x 1 m" };
  const changed = { "Dimensiones Cesta": "3 x 1 m" };
  assert.equal(normalizeOriginalTechnicalPresentation(changed, original), changed);
  for (const key of ["Dimensiones de cesta", "Dimensiones de la cesta", "Dimensiones cesta (mm)"]) {
    const conflict = { ...original, [key]: "3 x 1 m" };
    assert.equal(normalizeOriginalTechnicalPresentation(conflict, conflict), conflict);
    assert.equal(normalizeOriginalTechnicalPresentation(original, conflict), original);
    assert.equal(normalizeOriginalTechnicalPresentation(conflict, original), conflict);
  }
  assert.equal(normalizeOriginalTechnicalPresentation(original, {}), original);
});


test("las dimensiones de horquillas explícitas en milímetros conservan todos los ejes y su procedencia", () => {
  for (const [raw, formatted] of [["1200 mm", "1200 mm"], ["1200X150 mm", "1200 x 150 mm"],
    ["1200X150X45 mm", "1200 x 150 x 45 mm"]] as const) {
    const original: SpecsMap = { "Dimensiones Horquillas": raw, "Dimensiones de cesta": "2 x 1 m" };
    const observed: string[] = [];
    const result = normalizeOriginalTechnicalPresentation(original, original, (_before, _after, _mechanism, field) => {
      if (typeof field === "object") observed.push(field.spec);
    });
    assert.deepEqual(result, { "Dimensiones horquillas (mm)": formatted, "Dimensiones de cesta": "2 x 1 m" });
    assert.deepEqual(observed, ["Dimensiones Horquillas"]);
    assert.deepEqual(normalizeSpecsObject(result).normalized, normalizeSpecsObject(original).normalized);
    assert.equal(normalizeOriginalTechnicalPresentation(result, original), result);
    assert.equal(original["Dimensiones Horquillas"], raw);
  }
});

test("las dimensiones de horquillas conservan unidades ambiguas, alternativas y conflictos", () => {
  for (const value of ["1200", "1200 x 0 mm", "1200 x 150 x 45 x 30 mm", "1,2 m", "1200/1300 mm", "1200 mm opcional", "1200 kg"]) {
    const original = { "Dimensiones Horquillas": value };
    assert.equal(normalizeOriginalTechnicalPresentation(original, original)["Dimensiones horquillas (mm)"], undefined);
  }
  const original = { "Dimensiones Horquillas": "1200 mm" };
  const changed = { "Dimensiones Horquillas": "1300 mm" };
  assert.equal(normalizeOriginalTechnicalPresentation(changed, original), changed);
  for (const key of ["Dimensiones horquillas (mm)", "Medidas horquillas", "Horquillas"]) {
    const conflict = { ...original, [key]: "1300 mm" };
    assert.equal(normalizeOriginalTechnicalPresentation(conflict, conflict), conflict);
    assert.equal(normalizeOriginalTechnicalPresentation(original, conflict), original);
    assert.equal(normalizeOriginalTechnicalPresentation(conflict, original), conflict);
  }
  assert.equal(normalizeOriginalTechnicalPresentation(original, {}), original);
});

test("la pendiente superable explícita conserva su porcentaje y acredita la clave compartida", () => {
  const original: SpecsMap = { "Pendiente superable": "25%", "Pendiente superable con carga (%)": "12 %" };
  const changes: string[] = [];
  const result = normalizeOriginalTechnicalPresentation(original, original, (_before, _after, _mechanism, field) => {
    if (typeof field === "object") changes.push(field.spec);
  });
  assert.deepEqual(result, { "Pendiente superable (%)": "25 %", "Pendiente superable con carga (%)": "12 %" });
  assert.deepEqual(changes, ["Pendiente superable"]);
  assert.equal(normalizeOriginalTechnicalPresentation(result, original), result);
  assert.equal(original["Pendiente superable"], "25%");
});

test("la pendiente superable no convierte grados, condiciones, rangos ni conflictos de autoridad", () => {
  for (const raw of ["25", "25 grados", "25-30%", "25% con carga", "25% / 40%", 25]) {
    const original: SpecsMap = { "Pendiente superable": raw };
    assert.deepEqual(normalizeOriginalTechnicalPresentation(original, original), original);
  }
  const original: SpecsMap = { "Pendiente superable": "25 %" };
  const conflict: SpecsMap = { ...original, "Pendiente superable (%)": "40 %" };
  assert.deepEqual(normalizeOriginalTechnicalPresentation(conflict, original), conflict);
  assert.deepEqual(normalizeOriginalTechnicalPresentation(original, conflict), original);
  const changed: SpecsMap = { "Pendiente superable": "40 %" };
  assert.deepEqual(normalizeOriginalTechnicalPresentation(changed, original), changed);
});

const gomarizHeightSource: ProductRecord = {
  providerId: "gam",
  categoryKey: "prueba",
  categoryName: "Maquinaria",
  url: "https://example.com/producto/demo",
  title: "Equipo DEMO",
  shortDescription: null,
  longDescription: null,
  price: null,
  reference: "PRUEBA-1",
  brand: "EQUIPTEST",
  model: "DEMO",
  year: null,
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  image: null
};

test("una altura nominal redundante no se presenta como dimensión exterior de una plataforma Gomariz", () => {
  const original: ProductRecord = { ...gomarizHeightSource, providerId: "gomariz", categoryKey: "venta",
    condition: "Segunda mano", url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/equiptest-demo/",
    title: "EQUIPTEST DEMO", specs: { Altura: "12 metros", "Altura de trabajo": "12 m",
      "Altura plataforma": "10 m", "Altura almacenaje": "2.10 m" } };
  const prepared: SpecsMap = { Altura: "12 m", "Altura de trabajo": "12 m", "Altura de plataforma": "10 m", "Altura almacenaje": "2,10 m" };
  const expected: SpecsMap = { "Altura de trabajo": "12 m", "Altura de plataforma": "10 m", "Altura almacenaje": "2,10 m" };
  assert.deepEqual(reconcileGomarizRedundantWorkingHeight(original, prepared), expected);
  assert.equal(reconcileGomarizRedundantWorkingHeight(original, expected), expected);
  assert.equal(prepared.Altura, "12 m");
  assert.equal(original.specs?.Altura, "12 metros");
  for (const record of [ { ...original, providerId: "gam" }, { ...original, model: "OTRO" },
    { ...original, url: original.url.replace("elevador-tijera", "carretilla-industrial") },
    { ...original, specs: { ...original.specs, Altura: "11 metros" } },
    { ...original, specs: { ...original.specs, "Altura almacenaje": "12 m" } },
    { ...original, specs: { ...original.specs, Altura: ["12 metros", "11 metros"] } } ]) {
    assert.equal(reconcileGomarizRedundantWorkingHeight(record, prepared), prepared);
  }
  const conflict: SpecsMap = { ...prepared, "Altura de plataforma": "9 m" };
  assert.equal(reconcileGomarizRedundantWorkingHeight(original, conflict), conflict);
});


test("la clase redondeada conserva su valor sin presentarse como altura exterior ni sustituir la cota de trabajo", () => {
  const original: ProductRecord = { ...gomarizHeightSource, providerId: "gomariz", categoryKey: "venta",
    condition: "Segunda mano", url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/equiptest-demo/",
    title: "EQUIPTEST DEMO", specs: { Altura: "12 metros", "Altura de trabajo": "11.68 m",
      "Altura plataforma": "9.68 m", "Altura almacenaje": "2.10 m" } };
  const prepared: SpecsMap = { Altura: "12 m", "Altura de trabajo": "11,68 m", "Altura de plataforma": "9,68 m", "Altura almacenaje": "2,10 m" };
  const expected: SpecsMap = { "Altura de trabajo redondeada": "12 m", "Altura de trabajo": "11,68 m", "Altura de plataforma": "9,68 m", "Altura almacenaje": "2,10 m" };
  assert.deepEqual(reconcileGomarizRoundedWorkingHeight(original, prepared), expected);
  assert.equal(reconcileGomarizRoundedWorkingHeight(original, expected), expected);
  assert.equal(reconcileGomarizRedundantWorkingHeight(original, prepared), prepared);
  assert.equal(prepared.Altura, "12 m");
  assert.equal(original.specs?.Altura, "12 metros");
  for (const record of [{ ...original, providerId: "gam" }, { ...original, model: "OTRO" },
    { ...original, url: original.url.replace("elevador-tijera", "carretilla-industrial") },
    { ...original, specs: { ...original.specs, Altura: "12 m" } },
    { ...original, specs: { ...original.specs, "Altura de trabajo redondeada": "13 m" } }]) {
    assert.equal(reconcileGomarizRoundedWorkingHeight(record, prepared), prepared);
  }
  for (const working of ["11,5 m", "11,2 m", "12 m", "11,68 mm"]) {
    const record: ProductRecord = { ...original, specs: { ...original.specs, "Altura de trabajo": working } };
    const values = { ...prepared, "Altura de trabajo": working };
    assert.equal(reconcileGomarizRoundedWorkingHeight(record, values), values);
  }
  for (const values of [{ ...prepared, "Altura de trabajo redondeada": "13 m" },
    { ...prepared, "Altura de plataforma": "9 m" }, { ...prepared, "Altura almacenaje": "3 m" },
    { ...prepared, Altura: "13 m" }]) {
    assert.equal(reconcileGomarizRoundedWorkingHeight(original, values), values);
  }
});
