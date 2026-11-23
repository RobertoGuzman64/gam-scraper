import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { normalizeManainTechnicalSpecs } from "../reconciliation/normalization.js";

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
