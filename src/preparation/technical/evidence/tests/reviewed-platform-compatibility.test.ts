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
    "Anchura de plataforma": "1,6 m", "Extensión de plataforma": "1,52 m" });
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
  assert.deepEqual(output, { ...record.specs, "Altura de plataforma": "9,7 m", "Extensión de plataforma": "1,52 m" });
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
    "Anchura de plataforma": "0,74 m", "Extensión de plataforma": "0,9 m" });
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
