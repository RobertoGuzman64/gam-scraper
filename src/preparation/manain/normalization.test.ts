import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { normalizeManainTechnicalSpecs } from "./normalization.js";

const record: ProductRecord = {
  providerId: "manain",
  categoryKey: "venta",
  categoryName: "Maquinaria en venta",
  url: "https://manain.com/producto/venta-elevacion-tijera-equiptest-tx2/",
  title: "TX2",
  shortDescription: null,
  longDescription: null,
  price: null,
  condition: "Segunda mano",
  reference: "PRUEBA-TX2",
  brand: "EQUIPTEST",
  model: "TX2",
  year: "2022",
  location: null,
  country: null,
  horometer: "120",
  serialNumber: null,
  image: "https://manain.com/imagen-tx2.jpg",
  specs: {
    Marca: "EQUIPTEST",
    Modelo: "TX2",
    Motor: "Eléctrico",
    "Nueva o usada": "usada",
    "Altura trabajo": "9 m",
    "Capacidad carga": "230 kg",
    Peso: "1.550 kg",
    "Peso maquina": "1550 kg",
    "Peso operativo": "1 550 kg",
    "Peso sin carga": "1.550 kg",
    "Peso carretilla en vacio": "1550"
  }
};

test("Manain: elimina únicamente medidas de peso idénticas con unidades explícitas", () => {
  const original = JSON.stringify(record);
  const sourceSpecs = record.specs!;
  const normalized = normalizeManainTechnicalSpecs(record, sourceSpecs);
  assert.equal(normalized.Peso, "1.550 kg");
  assert.equal(normalized["Peso maquina"], undefined);
  assert.equal(normalized["Peso operativo"], undefined);
  assert.equal(normalized["Peso sin carga"], undefined);
  assert.equal(normalized["Peso carretilla en vacio"], "1550");
  assert.equal(JSON.stringify(record), original);
  assert.equal(sourceSpecs["Peso maquina"], "1550 kg");
});

test("Manain: conserva discrepancias, unidades ausentes y formatos no comparables", () => {
  const conflicting: SpecsMap = {
    Peso: "4.490 kg",
    "Peso maquina": "4.200 kg",
    "Peso operativo": "kg",
    "Peso sin carga": "4490",
    "Peso carretilla en vacio": "4.290 kg"
  };
  assert.equal(normalizeManainTechnicalSpecs(record, conflicting), conflicting);
  const unsupported: SpecsMap = { Peso: "kg", "Peso maquina": "5.000 kg" };
  assert.equal(normalizeManainTechnicalSpecs(record, unsupported), unsupported);
});

test("Manain: no aplica la deduplicación técnica a otros proveedores", () => {
  const other = { ...record, providerId: "gam" };
  assert.equal(normalizeManainTechnicalSpecs(other, record.specs!), record.specs);
});

test("Manain: la preparación completa conserva la medida y el original", () => {
  const original = JSON.stringify(record);
  const result = prepareSourceProduct(record);
  assert.equal(result.status, "ready");
  assert.equal(result.product.spec.Peso, "1.550 kg");
  assert.equal(result.product.spec["Peso maquina"], undefined);
  assert.equal(result.product.spec["Peso operativo"], undefined);
  assert.equal(result.product.spec["Peso sin carga"], undefined);
  assert.equal(result.product.spec["Peso carretilla en vacio"], "1550");
  assert.equal(JSON.stringify(record), original);
});

test("Manain: la preparación integra la unificación binaria sin alterar el registro de origen", () => {
  const source: ProductRecord = {
    ...record,
    specs: { ...record.specs, Estabilizadores: "si", "Trabajo negativo": "no", Matriculada: "SI" }
  };
  const original = JSON.stringify(source);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.spec.Estabilizadores, "Sí");
  assert.equal(prepared.product.spec["Trabajo negativo"], "No");
  assert.equal(prepared.product.spec.Matriculada, "Sí");
  assert.equal(JSON.stringify(source), original);
});

test("Manain: unifica únicamente medidas explícitas en metros sin alterar su significado", () => {
  const specs: SpecsMap = {
    "Longitud plataforma": "1.81 m",
    "Ancho plataforma": "0.9 m",
    "Altura trabajo": "21.58 m",
    "Longitud total": "1.90 m",
    "Altura max. replegada": "3.70 m mm",
    "Peso": "5.2000 kg",
    "Año": "2024",
    Modelo: "1.2 m",
    "Tracción": "4x4"
  };
  const original = JSON.stringify(specs);
  const output = normalizeManainTechnicalSpecs(record, specs);
  assert.deepEqual(output, {
    ...specs,
    "Longitud plataforma": "1,81 m",
    "Ancho plataforma": "0,9 m",
    "Altura trabajo": "21,58 m",
    "Longitud total": "1,9 m"
  });
  assert.equal(normalizeManainTechnicalSpecs(record, output), output);
  assert.equal(JSON.stringify(specs), original);
  assert.equal(normalizeManainTechnicalSpecs({ ...record, providerId: "gomariz" }, specs), specs);
});

test("Manain: la preparación presenta metros con coma y preserva las magnitudes de origen", () => {
  const source: ProductRecord = {
    ...record,
    specs: { ...record.specs, "Altura trabajo": "9.50 m", "Longitud plataforma": "1.42 m" }
  };
  const original = JSON.stringify(source);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.spec["Altura trabajo"], "9,5 m");
  assert.equal(prepared.product.spec["Longitud plataforma"], "1,42 m");
  assert.equal(JSON.stringify(source), original);
});


test("Manain: corrige un modelo repetido solo con identidad de origen coincidente", () => {
  const source: ProductRecord = {
    ...record,
    model: "TX2 PRO, TX2 PRO",
    specs: { ...record.specs, Modelo: "TX2 PRO, TX2 PRO" }
  };
  const original = JSON.stringify(source);
  const normalized = normalizeManainTechnicalSpecs(source, source.specs!);
  assert.equal(normalized.Modelo, "TX2 PRO");
  assert.equal(normalizeManainTechnicalSpecs(source, normalized), normalized);
  assert.equal(JSON.stringify(source), original);
  assert.equal(normalizeManainTechnicalSpecs({ ...source, model: "TX2 PRO" }, source.specs!).Modelo,
    "TX2 PRO, TX2 PRO");
  assert.equal(normalizeManainTechnicalSpecs({ ...source, providerId: "gam" }, source.specs!).Modelo,
    "TX2 PRO, TX2 PRO");
  const alternatives: SpecsMap = { Modelo: "TX2 PRO, TX3 PRO" };
  assert.equal(normalizeManainTechnicalSpecs({ ...source, model: "TX2 PRO, TX3 PRO" }, alternatives), alternatives);
});
