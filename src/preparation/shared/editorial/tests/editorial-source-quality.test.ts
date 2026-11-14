import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { cleanAuthenticatedSourceEditorial } from "../domain/editorial-text-hygiene.js";
import {
  controlledGamForklift,
  controlledGomarizPlatform,
  controlledMercaelevaPlatform
} from "./editorial-contract-records.js";

const providers = [controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaPlatform];

const withSourceGeneral = (record: ProductRecord, general: string): ProductRecord => ({
  ...record,
  longDescription: general,
  specs: { ...record.specs, Marca: record.brand ?? "", Modelo: record.model ?? "" }
});

test("una fuente sin evidencia editorial suficiente conserva los dos avisos de cobertura y no se promociona", () => {
  for (const factory of providers) {
    const source: ProductRecord = {
      ...factory(),
      brand: null,
      model: null,
      title: "Máquina sin identidad acreditada",
      shortDescription: null,
      longDescription: null,
      specs: {},
      url: "https://origen-ajeno.example/catalogo/unidad"
    };
    const before = JSON.stringify(source);
    const result = prepareSourceProduct(source);
    assert.equal(result.status, "review", source.providerId);
    assert.ok(result.issues.includes("Cobertura editorial insuficiente: descripción corta"), source.providerId);
    assert.ok(result.issues.includes("Cobertura editorial insuficiente: descripción general"), source.providerId);
    assert.equal(result.product.description, null);
    assert.equal(result.product.description_general, null);
    assert.equal(JSON.stringify(source), before);
  }
});

test("cuando hay evidencia técnica suficiente, no se generan avisos artificiales de descripciones ausentes", () => {
  for (const factory of providers) {
    const record = factory();
    const result = prepareSourceProduct(record);
    assert.ok(result.product.description?.trim(), record.providerId);
    assert.ok(result.product.description_general?.trim(), record.providerId);
    assert.ok(!result.issues.some((issue) => issue.startsWith("Cobertura editorial insuficiente:")), record.providerId);
  }
});

test("la higiene de introducciones se reutiliza para unidades nuevas de los tres orígenes auténticos", () => {
  for (const factory of providers) {
    const source = factory();
    const general = `Claro. La ficha técnica de MARCA MODELO10 permite describir las prestaciones de esta unidad sin atribuirle accesorios ni características ajenos al anuncio.`;
    const record = withSourceGeneral(source, general);
    const original = JSON.stringify(record);
    const result = cleanAuthenticatedSourceEditorial(record, null, general);
    assert.equal(result.general, general.slice("Claro. ".length), record.providerId);
    assert.equal(cleanAuthenticatedSourceEditorial(record, null,
      "Claro. Información insuficiente.").general, "Claro. Información insuficiente.");
    assert.equal(cleanAuthenticatedSourceEditorial(record, null, `${general} Afirmación distinta.`).general,
      `${general} Afirmación distinta.`);
    assert.equal(cleanAuthenticatedSourceEditorial({ ...record, model: "MODELO100" }, null, general).general,
      general);
    assert.equal(cleanAuthenticatedSourceEditorial({ ...record, url: "https://example.org/maquinaria" }, null, general).general,
      general);
    assert.equal(JSON.stringify(record), original);
  }
});

test("los marcadores de promoción y afirmaciones aisladas se limpian solo en texto acreditado de la fuente", () => {
  for (const factory of providers) {
    const record = factory();
    const short = "➨ MARCA MODELO10 de ocasión ➨ Equipo con prestaciones documentadas ⭐ Disponible";
    const general = "La ficha de MARCA MODELO10 aporta prestaciones de esta máquina. Sí. La unidad anunciada no acredita más equipamiento.";
    const source: ProductRecord = { ...withSourceGeneral(record, general), shortDescription: short };
    const clean = cleanAuthenticatedSourceEditorial(source, short, general);
    assert.equal(clean.short, "MARCA MODELO10 de ocasión. Equipo con prestaciones documentadas. Disponible", source.providerId);
    assert.equal(clean.general, "La ficha de MARCA MODELO10 aporta prestaciones de esta máquina. La unidad anunciada no acredita más equipamiento.");
    assert.equal(cleanAuthenticatedSourceEditorial(source, `${short} distinto`, general).short,
      `${short} distinto`);
    assert.equal(cleanAuthenticatedSourceEditorial({ ...source, reference: "" }, short, general).short, short);
    assert.equal(cleanAuthenticatedSourceEditorial({ ...source, providerId: "desconocido" }, short, general).general, general);
  }
});
