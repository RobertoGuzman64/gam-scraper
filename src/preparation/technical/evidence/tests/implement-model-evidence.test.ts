import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { matchesTechnicalDocumentVerification } from "../../../../contracts/technical-provenance.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { recoverReviewedModelTechnicalSpecs } from "../documented-technical-evidence.js";

const pressure = "Presión de aceite de trabajo del modelo";
const diameter = "Diámetro nominal de herramienta compatible";
const source = (model = "KM 55"): ProductRecord => ({
  providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta",
  url: `https://manain.com/producto/venta-movimiento-tierra-martillo-miniex-kubota-${model.toLowerCase().replace(/ /gu, "-")}/`,
  title: model, reference: "CONTROL-IMPLEMENTO", brand: "KUBOTA", model, year: "2019",
  shortDescription: null, longDescription: null, condition: "Segunda mano", price: null,
  location: null, country: null, horometer: null, serialNumber: null, image: null,
  specs: { Marca: "KUBOTA", Modelo: model, Maquina: "mini excavadora", Enganche: "acoplamiento de prueba", "Nueva o usada": "usada" }
});
const recover = (record: ProductRecord) => recoverReviewedModelTechnicalSpecs(record, record.specs ?? {});

test("acredita parámetros nominales del implemento para modelos identificados sin atribuir accesorios instalados", () => {
  for (const [model, value] of [["KM 55", "40 mm"], ["KM 105", "45 mm"], ["KM 155", "50 mm"], ["KM 205", "65 mm"]] as const) {
    const record = source(model);
    const before = structuredClone(record);
    const result = recover(record);
    assert.deepEqual(result, { ...record.specs, [pressure]: "100–150 bar", [diameter]: value });
    assert.deepEqual(record, before);
    assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[pressure], "100–150 bar");
    assert.equal(prepared.product.spec[diameter], value);
    for (const field of [pressure, diameter]) {
      const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
      assert.ok(entry && entry.scope === "model-document");
      assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
    }
  }
});

test("reutiliza la evidencia con otra unidad sin depender de referencia, horas o peso", () => {
  const record = source();
  const other = { ...record, reference: "OTRO-IMPLEMENTO", url: record.url.replace(/\/$/u, "-2/"),
    year: "2018", horometer: "20", specs: { ...record.specs, Peso: "54 kg", Horas: "20" } };
  assert.equal(recover(other)[diameter], "40 mm");
  assert.equal(recover(other).Peso, "54 kg");
});

test("rechaza identidad, familia, condición, año y descripción incompatibles", () => {
  const record = source();
  for (const invalid of [
    { ...record, model: "KM 55 X" }, { ...record, title: "KM 105" },
    { ...record, url: record.url.replace("km-55", "km-105") },
    { ...record, url: record.url.replace("martillo-miniex", "miniexcavadora") },
    { ...record, brand: null }, { ...record, year: null }, { ...record, year: "2010" },
    { ...record, condition: "Nuevo" as const }, { ...record, specs: { ...record.specs, "Nueva o usada": "nueva" } },
    { ...record, specs: { ...record.specs, Maquina: "excavadora" } },
    { ...record, longDescription: "Martillo modificado con otra herramienta." },
    { ...record, providerId: "gam" }
  ]) assert.equal(recover(invalid), invalid.specs);
});

test("conserva datos originales o equivalentes y no completa prestaciones con evidencia conflictiva", () => {
  const record = source();
  for (const specs of [
    { ...record.specs, "Presión hidráulica": "120 bar" },
    { ...record.specs, "Diametro de puntero": "45 mm" },
    { ...record.specs, Observaciones: "Martillo modificado" }
  ]) assert.equal(recover({ ...record, specs }), specs);
  const existing = { ...record.specs, [diameter]: "45 mm" };
  assert.equal(recoverReviewedModelTechnicalSpecs(record, existing), existing);
});

test("recupera los parámetros de diseño del martillo Epiroc y del pisón Husqvarna", () => {
  const breaker: ProductRecord = { ...source(), brand: "EPIROC", model: "SB 202", title: "SB 202", year: "2022",
    url: "https://manain.com/producto/venta-movimiento-tierra-martillo-miniex-epiroc-sb-202/",
    specs: { Marca: "EPIROC", Modelo: "SB 202", Peso: "200 kg", Maquina: "miniexcavadora", Enganche: "acoplamiento de prueba", "Nueva o usada": "usada" } };
  const rammer: ProductRecord = { ...source(), brand: "HUSQVARNA", model: "LT 6005", title: "LT 6005", year: "2021",
    url: "https://manain.com/producto/venta-pequena-maquinaria-compactacion-husqvarna-lt-6005/",
    specs: { Marca: "HUSQVARNA", Modelo: "LT 6005", "Ancho bandeja": "230 mm", Motor: "Gasolina", "Nueva o usada": "usada" } };
  for (const [record, facts] of [[breaker, { [pressure]: "100–150 bar", [diameter]: "65 mm", "Caudal de aceite del modelo": "35–65 l/min" }],
    [rammer, { "Frecuencia de vibración del modelo": "11,9 Hz", "Amplitud nominal de vibración": "67,7 mm" }]] as const) {
    const result = recover(record);
    assert.deepEqual(result, { ...record.specs, ...facts });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
    const prepared = prepareSourceProduct(record);
    for (const field of Object.keys(facts)) {
      const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
      assert.ok(entry && entry.scope === "model-document");
      assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
    }
    const invalid = { ...record, year: "2010" };
    assert.equal(recover(invalid), invalid.specs);
  }
  const altered = { ...rammer, specs: { ...rammer.specs, Amplitud: "50 mm" } };
  assert.equal(recover(altered), altered.specs);
});
