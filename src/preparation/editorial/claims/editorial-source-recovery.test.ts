import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { resolveVerifiedSourceEditorialExcerpt } from "../source/editorial-source-excerpt.js";
import { resolveMissingTechnicalEditorialGeneral } from "../source/context/editorial-missing-technical-general.js";
import { resolveDocumentedModelGeneral } from "../measurements/sourced/editorial-sourced-technical-context.js";
import { controlledGomarizPlatform, controlledMercaelevaPlatform } from "../core/editorial-contract-records.js";
import { prepareSourceProduct } from "../../prepare-product.js";

const source = (
  providerId: ProductRecord["providerId"], model: string, suffix: string, description: string | null,
  specs: ProductRecord["specs"]
): ProductRecord => ({
  providerId, categoryKey: providerId === "mercaeleva" ? "venta" : "manutencion", categoryName: "Maquinaria en venta",
  url: providerId === "mercaeleva" ? `https://sales.mercaeleva.com/es/for-sale/machine/MB-${model}-M888-7070` :
    `https://online.gamrentals.com/es/apiladoras-elevadoras-electricas-nuevas/8888-mb-${model}`,
  title: `MB ${model} ${suffix}`, shortDescription: null, longDescription: description,
  price: null, condition: "Nuevo", reference: providerId === "mercaeleva" ? "M888-7070" : "8888",
  brand: "MB", model, year: "2026", location: null, country: null, horometer: null,
  serialNumber: null, image: null, images: [], specs: specs ?? {}
});

const technical = {
  Marca: "MB", Modelo: "ESL999", Estado: "Nuevo", "Título adicional": "Apilador eléctrico de 1.600kg con batería de litio",
  "Capacidad máxima de elevación": "1600 kg", "Tipo de Batería": "Li-ion", "Tipo de motor": "Eléctrico",
  "Voltaje de la batería": "24 V", "Capacidad de la batería": "100 Ah",
  "Altura máxima de elevación": "3600 mm", "Tipo de mástil": "Triple"
} as const;

test("El motor recupera una general técnica de una unidad nueva verificada sin narrador específico", () => {
  const record = source("mercaeleva", "ESL999", "Apilador eléctrico de 1.600kg con batería de litio", null, technical);
  const general = resolveMissingTechnicalEditorialGeneral(record, record);
  assert.match(general ?? "", /MB ESL999/);
  assert.match(general ?? "", /1\.600 kg/);
  assert.match(general ?? "", /3\.600 mm/);
  assert.match(general ?? "", /24 V y 100 Ah/);
  const prepared = prepareSourceProduct(record);
  assert.match(prepared.product.description_general ?? "", /MB ESL999/);
  assert.match(prepared.product.description_general ?? "", /1\.600 kg/);
});

test("La recuperación funciona por contrato para un segundo origen sin reglas de proveedor", () => {
  const record = source("gam", "ESL999", "Apilador eléctrico de 1.600kg con batería de litio", null, technical);
  const general = resolveMissingTechnicalEditorialGeneral(record, record);
  assert.match(general ?? "", /MB ESL999/);
});

test("No hereda capacidad, motorización, identidad o valores de una unidad distinta", () => {
  const record = source("mercaeleva", "ESL999", "Apilador eléctrico de 1.600kg con batería de litio", null, technical);
  assert.equal(resolveMissingTechnicalEditorialGeneral(record, { ...record, model: "ESL998" }), null);
  assert.equal(resolveMissingTechnicalEditorialGeneral(record, { ...record, reference: "M999-7070" }), null);
  assert.equal(resolveMissingTechnicalEditorialGeneral(record, { ...record, specs: { ...technical, "Capacidad máxima de elevación": "1500 kg" } }), null);
  assert.equal(resolveMissingTechnicalEditorialGeneral({ ...record, title: record.title?.replace("1.600", "2.000") ?? null },
    { ...record, title: record.title?.replace("1.600", "2.000") ?? null }), null);
  assert.equal(resolveMissingTechnicalEditorialGeneral({ ...record, specs: { ...technical, "Tipo de motor": "Diésel" } },
    { ...record, specs: { ...technical, "Tipo de motor": "Diésel" } }), null);
  assert.equal(resolveMissingTechnicalEditorialGeneral({ ...record, specs: { ...technical, "Tipo de Batería": "Gel" } },
    { ...record, specs: { ...technical, "Tipo de Batería": "Gel" } }), null);
  assert.equal(resolveMissingTechnicalEditorialGeneral({ ...record, longDescription: "Ficha técnica existente" },
    { ...record, longDescription: "Ficha técnica existente" }), null);
});

test("Extrae descripción declarada solo con marca, modelo, familia y medidas compatibles", () => {
  const title = "PLATAFORMA TIJERA ELECTRICA 22 MT";
  const record = {
    ...source("mercaeleva", "HL-220 E12", title, "Ref. 1887 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 22 MT HOLLAND LIFT HL-220 E12 HORAS 859 AÑO DE FABRICACION 2017", {
      Marca: "Hollandlift", Modelo: "HL-220 E12", Estado: "Usado"
    }),
    title: `Hollandlift HL-220 E12 ${title}`,
    brand: "Hollandlift", condition: "Segunda mano" as const
  };
  const excerpt = resolveVerifiedSourceEditorialExcerpt(record);
  assert.equal(excerpt, "PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 22 MT HOLLAND LIFT HL-220 E12");
  assert.equal(resolveVerifiedSourceEditorialExcerpt({ ...record, model: "HL-220 E13" }), null);
  assert.equal(resolveVerifiedSourceEditorialExcerpt({ ...record, longDescription: record.longDescription?.replace("TIJERA", "ARTICULADA") ?? null }), null);
  assert.equal(resolveVerifiedSourceEditorialExcerpt({ ...record, longDescription: record.longDescription?.replace("22 MT", "16 MT") ?? null }), null);
  assert.equal(resolveVerifiedSourceEditorialExcerpt({ ...record, shortDescription: "Resumen oficial" }), null);
  assert.equal(resolveVerifiedSourceEditorialExcerpt({ ...record, providerId: "gomariz" }), null);
});

test("Rechaza la atribución de capacidades y mástiles contradictorios en el origen", () => {
  const record = source("mercaeleva", "ESL999", "Apilador eléctrico de 1.600kg", "Ref. M888-7070 APILADOR ELECTRICO 1600 KG MB ESL999 MASTIL DUPLEX TRIPLEX HORAS 1", technical);
  assert.equal(resolveVerifiedSourceEditorialExcerpt(record), null);
  const incompatible = { ...record, longDescription: "Ref. M888-7070 APILADOR ELECTRICO 1500 KG MB ESL999 HORAS 1" };
  assert.equal(resolveVerifiedSourceEditorialExcerpt(incompatible), null);
  const capacityConflict = { ...record, longDescription: "Ref. M888-7070 APILADOR ELECTRICO 1600 KG MB ESL999 HORAS 1",
    specs: { ...technical, "Capacidad máxima de elevación": "1500 kg" } };
  assert.equal(resolveVerifiedSourceEditorialExcerpt(capacityConflict), null);
  const mastConflict = { ...record, longDescription: "Ref. M888-7070 APILADOR ELECTRICO 1600 KG MB ESL999 MASTIL DUPLEX HORAS 1" };
  assert.equal(resolveVerifiedSourceEditorialExcerpt(mastConflict), null);
});


test("aprovecha maniobrabilidad nominal acreditada sin atribuir condiciones de trabajo en altura", () => {
  const reviewed = { "Radio de giro exterior del modelo": "2300 mm", "Pendiente superable del modelo con plataforma bajada": "25 %" };
  const general = "La ficha técnica de plataforma de tijera eléctrica MARCA MODELO10 indica altura de trabajo de 10 m.";
  for (const original of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const prepared = { ...original, specs: { ...original.specs, ...reviewed } };
    const result = resolveDocumentedModelGeneral(original, prepared, general, reviewed);
    assert.equal(result, `${general}\n\nEl modelo presenta radio de giro exterior de 2,3 m y pendiente superable nominal con plataforma bajada de 25 %.`);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, result, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, {}), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, model: "OTRO" }, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, `${general} Radio de giro de 2,3 m. Pendiente de 25 %.`, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, { ...reviewed, "Radio de giro exterior del modelo": "2500 mm", "Pendiente superable del modelo con plataforma bajada": "40 %" }), null);
    const articulated = { ...original, title: "Plataforma articulada eléctrica MARCA MODELO10" };
    assert.equal(resolveDocumentedModelGeneral(articulated, { ...articulated, specs: prepared.specs }, general.replace("de tijera", "articulada"), reviewed), `${general.replace("de tijera", "articulada")}\n\nEl modelo presenta radio de giro exterior de 2,3 m.`);
  }
});


test("distingue diámetro compatible de herramienta instalada en implementos", () => {
  const original = { ...controlledGomarizPlatform(), title: "Martillo para miniexcavadora MARCA MODELO10", specs: { Peso: "100 kg" } };
  const reviewed = { "Diámetro nominal de herramienta compatible": "45 mm" };
  const prepared = { ...original, specs: { ...original.specs, ...reviewed } };
  const general = "La ficha técnica de martillo para miniexcavadora MARCA MODELO10 indica peso declarado de 100 kg.";
  assert.equal(resolveDocumentedModelGeneral(original, prepared, general, reviewed), `${general}\n\nEl modelo presenta diámetro nominal de herramienta compatible de 45 mm.`);
  assert.equal(resolveDocumentedModelGeneral(original, prepared, `${general} Puntero de 45 mm.`, reviewed), null);
  assert.equal(resolveDocumentedModelGeneral(original, prepared, general, {}), null);
  assert.equal(resolveDocumentedModelGeneral(original, prepared, general, { "Diámetro nominal de herramienta compatible": "55 mm" }), null);
  assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, reference: "OTRO" }, general, reviewed), null);
});
