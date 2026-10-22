import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { sourceSignalForIssue } from "../../diagnostics/source-triage.js";

const base: ProductRecord = {
  providerId: "gam", categoryKey: "carretillas", categoryName: "Carretillas",
  url: "https://example.test/machine/1", title: "Carretilla", shortDescription: null,
  longDescription: null, price: null, reference: "001", brand: null, model: null,
  year: null, location: null, country: null, horometer: null, serialNumber: null,
  image: null, specs: {}
};

test("una especificación con etiqueta exacta es indicio, no atributo recuperado", () => {
  assert.equal(sourceSignalForIssue("Atributo obligatorio ausente: Tipo de mástil", {
    ...base, specs: { "Tipo de mástil": "Dúplex / Tríplex" }
  }), "especificacion_explicita");
  assert.equal(sourceSignalForIssue("Atributo obligatorio ausente: Tipo de mástil", {
    ...base, specs: { "Tipo de mástil": "   " }
  }), "sin_evidencia_local");
  assert.equal(sourceSignalForIssue("Atributo obligatorio ausente: Altura de trabajo", {
    ...base, specs: { "ALTURA DE TRABAJO": "16 m" }
  }), "especificacion_explicita");
  assert.equal(sourceSignalForIssue("Atributo obligatorio ausente: Altura de trabajo", {
    ...base, specs: { "Altura de elevación": "16 m" }
  }), "sin_evidencia_local");
});

test("menciones no aportan valores y no se confunden con campos acreditados", () => {
  assert.equal(sourceSignalForIssue("Atributo obligatorio ausente: Altura de trabajo", {
    ...base, longDescription: "Altura de trabajo a consultar con el proveedor"
  }), "mencion_textual");
  assert.equal(sourceSignalForIssue("Atributo obligatorio ausente: Capacidad de carga", {
    ...base, longDescription: "Capacidad de cesta: 200 kg"
  }), "sin_evidencia_local");
  assert.equal(sourceSignalForIssue("Precio no disponible o inválido", {
    ...base, priceText: "Consultar precio"
  }), "campo_origen_no_validado");
  assert.equal(sourceSignalForIssue("Precio no disponible o inválido", base), "sin_evidencia_local");
});

test("restricciones comerciales, categorías y conflictos no implican datos inventados", () => {
  assert.equal(sourceSignalForIssue("Categoría Equipzilla sin correspondencia inequívoca", base), "equivalencia_pendiente");
  assert.equal(sourceSignalForIssue("Condición comercial no confirmada (Nuevo o Segunda_Mano)", base), "sin_evidencia_local");
  assert.equal(sourceSignalForIssue("Condición comercial contradictoria entre la ficha y el origen", base), "contradiccion");
  assert.equal(sourceSignalForIssue("Descripción comercial contradictoria: altura de trabajo", base), "contradiccion");
  assert.equal(sourceSignalForIssue("Número de serie ABC compartido por dos máquinas", base), "identidad");
  assert.equal(sourceSignalForIssue("Descripción corta ausente: solo hay descripción general", {
    ...base, longDescription: "Ficha general"
  }), "sin_evidencia_local");
});
