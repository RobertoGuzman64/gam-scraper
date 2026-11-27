import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { matchesTechnicalDocumentVerification } from "../../../../contracts/technical-provenance.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { recoverReviewedModelTechnicalSpecs } from "../documented-technical-evidence.js";
import { documentedPlatform, recoverDocumented } from "./reviewed-model-fixtures.js";

test("reutiliza geometría documental acreditada sin depender de la referencia comercial", () => {
  const record = documentedPlatform();
  const before = structuredClone(record);
  const output = recoverDocumented(record);
  assert.deepEqual(output, { ...record.specs, "Longitud de plataforma": "2,79 m",
    "Anchura de plataforma": "1,6 m", "Extensión de plataforma": "1,52 m", "Distancia entre ejes (mm)": "2290 mm", "Radio de giro exterior del modelo": "4750 mm" });
  assert.deepEqual(recoverDocumented({ ...record, reference: "CONTROL-02" }), output);
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  assert.deepEqual(record, before);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec["Extensión de plataforma"], "1,52 m");
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === "Extensión de plataforma");
  assert.equal(entry?.scope, "model-document");
  assert.ok(entry?.document && entry.verification);
  assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
  assert.match(prepared.product.description_general ?? "", /altura de trabajo de 11,7 m/u);
  assert.match(prepared.product.description_general ?? "", /verificar la capacidad de cesta/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /documentación técnica del modelo|prestaciones de referencia del modelo/iu);
});

test("reutiliza evidencia entre proveedores sin duplicar alias de origen", () => {
  const record: ProductRecord = { ...documentedPlatform(), providerId: "manain", reference: "CONTROL-03",
    url: "https://manain.com/producto/venta-elevacion-tijera-lgmg-sr1018d/", title: "SR1018D",
    specs: { Marca: "LGMG", Modelo: "SR1018D", Motor: "Diésel", "Altura trabajo": "11,7 m",
      "Capacidad carga": "454 kg", "Longitud total": "3,76 m", "Ancho total": "1,79 m",
      "Nueva o usada": "usada", "Longitud plataforma": "2,79 m", "Ancho plataforma": "1,60 m" } };
  const output = recoverDocumented(record);
  assert.deepEqual(output, { ...record.specs, "Altura de plataforma": "9,7 m", "Extensión de plataforma": "1,52 m", "Distancia entre ejes (mm)": "2290 mm", "Radio de giro exterior del modelo": "4750 mm" });
});

test("rechaza identidad, configuración o magnitudes incompatibles con el documento", () => {
  const record = documentedPlatform();
  for (const invalid of [
    { ...record, model: "SR1018D-2" },
    { ...record, title: "Plataforma de tijera diésel LGMG SR1018D-LI" },
    { ...record, title: "Plataforma de tijera diésel", url: "https://www.gomarizrent.com/producto/equipo/" },
    { ...record, specs: { ...record.specs, Motor: "Eléctrico" } },
    { ...record, specs: { ...record.specs, Capacidad: "450 kg" } },
    { ...record, specs: { ...record.specs, Anchura: "1,80 m" } },
    { ...record, specs: { ...record.specs, Longitud: "" } },
    { ...record, specs: { ...record.specs, "Ancho plataforma": "1,5 m" } },
    { ...record, longDescription: "Longitud de plataforma de 3 m." },
    { ...record, longDescription: "Sin extensión de plataforma." },
    { ...record, longDescription: "Extensión de plataforma opcional." },
    { ...record, longDescription: "Plataforma modificada." }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  const declared = { ...record, specs: { ...record.specs, "Longitud extensión": "1,52 m" } };
  assert.equal(recoverDocumented(declared)["Extensión de plataforma"], undefined);
});

test("reutiliza evidencia en rutas genéricas solo con identidad y familia corroboradas", () => {
  const record: ProductRecord = { ...documentedPlatform(), title: "LGMG SR1018D",
    longDescription: "Las Tijeras Diésel permiten trabajos en altura." };
  assert.equal(recoverDocumented(record)["Longitud de plataforma"], "2,79 m");
  for (const invalid of [
    { ...record, longDescription: "Equipo para trabajos en altura." },
    { ...record, longDescription: "Las Articuladas Diésel permiten trabajos en altura." },
    { ...record, shortDescription: "Plataforma articulada LGMG SR1018D" },
    { ...record, url: "https://www.gomarizrent.com/producto/lgmg-sr1018d-otro/" },
    { ...record, specs: { ...record.specs, Motor: "Eléctrico" } },
    { ...record, specs: { ...record.specs, Anchura: "1,80 m" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});

test("admite motorización declarada en el encabezado sin inferirla de la marca o del modelo", () => {
  const record: ProductRecord = { ...documentedPlatform(), brand: "LGMG", model: "AS0607WE",
    title: "LGMG AS0607WE", url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-as0607we/",
    longDescription: "Las Tijeras Eléctricas permiten trabajos en altura.",
    specs: { "Altura de trabajo": "7,8 m", "Altura de plataforma": "5,8 m", Capacidad: "230 kg",
      Longitud: "1,86 m", Anchura: "0,81 m" } };
  const output = recoverDocumented(record);
  assert.deepEqual(output, { ...record.specs, "Longitud de plataforma": "1,63 m",
    "Anchura de plataforma": "0,74 m", "Extensión de plataforma": "0,9 m", "Distancia entre ejes (mm)": "1350 mm",
    "Radio de giro exterior del modelo": "1750 mm", "Pendiente superable del modelo con plataforma bajada": "25 %" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  for (const invalid of [
    { ...record, longDescription: "Las tijeras de elevación permiten trabajos en altura." },
    { ...record, longDescription: "Las Tijeras Diésel permiten trabajos en altura." },
    { ...record, longDescription: `${record.longDescription} Motor diésel.` },
    { ...record, longDescription: `${record.longDescription} Sin motor eléctrico.` },
    { ...record, specs: { ...record.specs, Motor: "Desconocido" } },
    { ...record, specs: { ...record.specs, Combustible: "Desconocido" } },
    { ...record, specs: { ...record.specs, Longitud: "1,83 m" } },
    { ...record, specs: { ...record.specs, "Ancho plataforma": "0,73 m" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});

test("recupera la distancia entre ejes del modelo compatible sin sustituir datos de unidad", () => {
  const record: ProductRecord = { ...documentedPlatform(), model: "AS1012E",
    title: "Plataforma de tijera eléctrica LGMG AS1012E",
    url: "https://www.gomarizrent.com/producto/lgmg-as1012e/",
    specs: { "Altura de trabajo": "12 m", Capacidad: "320 kg", Motor: "Eléctrico", Longitud: "2,47 m", Anchura: "1,18 m" } };
  const output = recoverDocumented(record);
  assert.equal(output["Distancia entre ejes (mm)"], "1850 mm");
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec["Distancia entre ejes (mm)"], "1850 mm");
  assert.equal(prepared.technicalProvenance?.entries.find((entry) => entry.field === "Distancia entre ejes (mm)")?.scope, "model-document");
  for (const key of ["Distancia entre ejes", "Batalla", "Wheelbase"]) {
    const original = { ...record, specs: { ...record.specs, [key]: "1,7 m" } };
    const result = recoverDocumented(original);
    assert.equal(result[key], "1,7 m");
    assert.equal(result["Distancia entre ejes (mm)"], undefined);
    assert.equal(result["Longitud de plataforma"], "2,26 m");
  }
  for (const longDescription of ["Chasis modificado.", "Distancia entre ejes de 1,7 m."]) {
    const result = recoverDocumented({ ...record, longDescription });
    assert.equal(result["Distancia entre ejes (mm)"], undefined);
  }
  assert.equal(recoverDocumented({ ...record, model: "AS1012E-2" })["Distancia entre ejes (mm)"], undefined);
});


test("recupera el radio exterior del modelo y conserva datos de giro y configuraciones de origen", () => {
  const record: ProductRecord = { ...documentedPlatform(), model: "AS1012E",
    title: "Plataforma de tijera eléctrica LGMG AS1012E",
    url: "https://www.gomarizrent.com/producto/lgmg-as1012e/",
    specs: { "Altura de trabajo": "12 m", Capacidad: "320 kg", Motor: "Eléctrico", Longitud: "2,47 m", Anchura: "1,18 m" } };
  const field = "Radio de giro exterior del modelo";
  const output = recoverDocumented(record);
  assert.equal(output[field], "2300 mm");
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec[field], "2300 mm");
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
  assert.equal(entry?.scope, "model-document");
  assert.ok(entry?.document && entry.verification);
  assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
  for (const key of ["Radio de giro (mm)", "Radio de giro interior", "Diámetro de giro", "Turning radius", field]) {
    const original = { ...record, specs: { ...record.specs, [key]: "1900 mm" } };
    const result = recoverDocumented(original);
    assert.equal(result[key], "1900 mm");
    assert.equal(result[field], key === field ? "1900 mm" : undefined);
    assert.equal(result["Distancia entre ejes (mm)"], "1850 mm");
  }
  for (const longDescription of ["Radio de giro de 1,9 m.", "Neumáticos sustituidos.", "Dirección modificada.", "Chasis modificado."]) {
    assert.equal(recoverDocumented({ ...record, longDescription })[field], undefined);
  }
  assert.equal(recoverDocumented({ ...record, model: "AS1012E-2" })[field], undefined);
});

test("acredita el radio exterior en plataformas articuladas de geometría corroborada", () => {
  const field = "Radio de giro exterior del modelo";
  const record: ProductRecord = { ...documentedPlatform(), model: "AR16J",
    title: "Plataforma articulada diésel LGMG AR16J",
    url: "https://www.gomarizrent.com/producto/lgmg-ar16j/",
    specs: { "Altura de trabajo": "17,7 m", Capacidad: "230 kg", Motor: "Diésel", Longitud: "7,56 m", Anchura: "2,31 m" } };
  const output = recoverDocumented(record);
  assert.equal(output[field], "4410 mm");
  assert.equal(output["Rotación de torreta"], "355°");
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec[field], "4410 mm");
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
  assert.equal(entry?.scope, "model-document");
  assert.ok(entry?.document && entry.verification);
  assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
  const other: ProductRecord = { ...record, providerId: "manain", reference: "CONTROL-02",
    title: "AR16J", categoryKey: "venta", categoryName: "Maquinaria en venta",
    url: "https://manain.com/producto/venda-elevacio-bracos-articulats-lgmg-ar16j/",
    specs: { Marca: "LGMG", Modelo: "AR16J", Motor: "Diésel", "Altura trabajo": "17,7 m",
      "Capacidad carga": "230 kg", "Longitud total": "7,56 m", "Ancho total": "2,31 m", "Nueva o usada": "usada" } };
  assert.equal(recoverDocumented(other)[field], "4410 mm");
  for (const invalid of [
    { ...record, model: "AR16J-2" },
    { ...record, specs: { ...record.specs, Anchura: "2 m" } },
    { ...record, specs: { ...record.specs, "Radio de giro interior": "1900 mm" } },
    { ...record, longDescription: "Dirección modificada." }
  ]) assert.equal(recoverDocumented(invalid)[field], undefined);
});


test("acredita la pendiente nominal con plataforma bajada sin atribuir inclinación de trabajo", () => {
  const record: ProductRecord = { ...documentedPlatform(), model: "AS1012E",
    title: "Plataforma de tijera eléctrica LGMG AS1012E",
    url: "https://www.gomarizrent.com/producto/lgmg-as1012e/",
    specs: { "Altura de trabajo": "12 m", Capacidad: "320 kg", Motor: "Eléctrico", Longitud: "2,47 m", Anchura: "1,18 m" } };
  const field = "Pendiente superable del modelo con plataforma bajada";
  const output = recoverDocumented(record);
  assert.equal(output[field], "25 %");
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec[field], "25 %");
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
  assert.equal(entry?.scope, "model-document");
  assert.ok(entry?.document && entry.verification);
  assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
  for (const key of ["Pendiente máxima", "Gradeability", "Inclinación admisible", field]) {
    const original = { ...record, specs: { ...record.specs, [key]: "20 %" } };
    const result = recoverDocumented(original);
    assert.equal(result[key], "20 %");
    assert.equal(result[field], key === field ? "20 %" : undefined);
  }
  for (const longDescription of ["Pendiente superable del 20 %.", "Neumáticos sustituidos.", "Tracción modificada.", "Motor sustituido."]) {
    assert.equal(recoverDocumented({ ...record, longDescription })[field], undefined);
  }
  assert.equal(recoverDocumented({ ...record, specs: { ...record.specs, Tracción: "4x4" } })[field], undefined);
  assert.equal(recoverDocumented({ ...record, specs: { ...record.specs, Tracción: "4×2" } })[field], "25 %");
  assert.equal(recoverDocumented({ ...record, model: "AS1012E-2" })[field], undefined);
});

test("acredita pendientes de tijeras eléctricas con cotas e identidad compatibles", () => {
  const field = "Pendiente superable del modelo con plataforma bajada";
  for (const [model, height, capacity, length, width] of [
    ["SS0507E", "6,3 m", "230 kg", "1,53 m", "0,81 m"],
    ["S0812II", "10 m", "450 kg", "2,49 m", "1,18 m"]
  ] as const) {
    const record: ProductRecord = { ...documentedPlatform(), model, title: `Plataforma de tijera eléctrica LGMG ${model}`,
      url: `https://www.gomarizrent.com/producto/lgmg-${model.toLowerCase()}/`,
      specs: { "Altura de trabajo": height, Capacidad: capacity, Motor: "Eléctrico", Longitud: length, Anchura: width } };
    const result = recoverDocumented(record);
    assert.equal(result[field], "25 %");
    assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[field], "25 %");
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
    assert.equal(entry?.scope, "model-document");
    assert.ok(entry?.document && entry.verification);
    assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
    for (const invalid of [
      { ...record, model: `${model}-2` },
      { ...record, specs: { ...record.specs, Tracción: "4x4" } },
      { ...record, specs: { ...record.specs, "Pendiente máxima": "20 %" } },
      { ...record, longDescription: "Motor sustituido." }
    ]) assert.equal(recoverDocumented(invalid)[field], undefined);
  }
});
