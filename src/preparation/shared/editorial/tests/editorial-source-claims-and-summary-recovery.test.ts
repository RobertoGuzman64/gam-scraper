import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { resolveVerifiedTechnicalBrief } from "../domain/editorial-technical-brief.js";
import { resolveEditorialIdentitySummary } from "../domain/editorial-identity-summary.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledGomarizPlatform,
  controlledMercaelevaForklift
} from "./editorial-contract-records.js";

const explicit = (record: ProductRecord): ProductRecord => ({
  ...record,
  reference: "CONTROL-24",
  url: record.url?.replace(/CONTROL-\d+/gu, "CONTROL-24") ?? null,
  shortDescription: null,
  longDescription: null,
  specs: { Marca: "MARCA", Modelo: "MODELO10", "Parada de emergencia": true, "Frenado regenerativo": true }
});

test("recupera general únicamente de declaraciones explícitas compatibles con identidad nueva en tres orígenes", () => {
  for (const basis of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const record = explicit(basis);
    const source = JSON.stringify(record);
    const general = resolveSourceEditorialClaims(record, record, null);
    assert.match(general ?? "", /MARCA MODELO10/u);
    assert.match(general ?? "", /frenado regenerativo/u);
    assert.match(general ?? "", /parada de emergencia/u);
    assert.match(general ?? "", /su configuración debe comprobarse/u);
    assert.equal(prepareSourceProduct(record).product.description_general, general);
    assert.equal(JSON.stringify(record), source);
  }
});

test("no compone sin una declaración afirmativa íntegra de la misma unidad", () => {
  const original = explicit(controlledGamForklift());
  assert.equal(resolveSourceEditorialClaims({ ...original, specs: { Marca: "MARCA", Modelo: "MODELO10" } },
    { ...original, specs: { Marca: "MARCA", Modelo: "MODELO10" } }, null), null);
  for (const record of [
    { ...original, specs: { ...original.specs, "Parada de emergencia": false } },
    { ...original, specs: { ...original.specs, "Parada de emergencia": "Opcional" } }
  ]) assert.doesNotMatch(resolveSourceEditorialClaims(record, record, null) ?? "", /parada de emergencia/u);
  for (const prepared of [
    { ...original, reference: "CONTROL-OTRA" },
    { ...original, model: "MODELO11" },
    { ...original, condition: "Nuevo" as const },
    { ...original, url: original.url?.replace("CONTROL-24", "CONTROL-OTRA") ?? null },
    { ...original, providerId: "gomariz" as const },
    { ...original, specs: { ...original.specs, "Parada de emergencia": false, "Frenado regenerativo": false } }
  ]) assert.equal(resolveSourceEditorialClaims(original, prepared, null), null);
  assert.equal(resolveSourceEditorialClaims({ ...original, title: "Fregadora MARCA MODELO10" },
    { ...original, title: "Fregadora MARCA MODELO10" }, null), null);
});

test("preserva la narración original cuando no hay general compuesto", () => {
  const record = { ...explicit(controlledGamForklift()), longDescription: "Texto de origen firmado por la misma unidad." };
  assert.equal(resolveSourceEditorialClaims(record, record, null), null);
  const prepared = prepareSourceProduct(record);
  assert.match(prepared.product.description_general ?? "", /Texto de origen firmado/u);
});

test("incorpora rasgos existentes de familias compatibles sin afirmar equipamiento instalado", () => {
  for (const basis of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const record: ProductRecord = {
      ...basis,
      longDescription: "La carretilla dispone de cabina cerrada y cinturón de seguridad."
    };
    const general = resolveSourceEditorialClaims(record, record, "Ficha técnica contrastada.") ?? "";
    assert.match(general, /cabina cerrada/u);
    assert.match(general, /cinturón de seguridad/u);
    assert.match(general, /deben comprobarse para esta unidad/u);
    assert.equal(resolveSourceEditorialClaims(record, record, general), general);
  }
  const forklift = { ...controlledGamForklift(), longDescription: "La carretilla incorpora cabina cerrada." };
  assert.equal(resolveSourceEditorialClaims(forklift, { ...forklift, model: "MODELO11" }, "Ficha técnica."), "Ficha técnica.");
});

test("rechaza rasgos opcionales, negados o de familia incompatible", () => {
  const source = controlledGamForklift();
  for (const description of [
    "La carretilla no dispone de cabina cerrada ni cinturón de seguridad.",
    "La cabina cerrada se ofrece como opción y el cinturón de seguridad según versión.",
    "La carretilla puede incorporar cabina cerrada y cinturón de seguridad."
  ]) {
    const record = { ...source, longDescription: description };
    assert.equal(resolveSourceEditorialClaims(record, record, "Ficha técnica."), "Ficha técnica.");
  }
  const platform = { ...controlledGomarizPlatform(), longDescription: "La plataforma tiene cabina cerrada y cinturón de seguridad." };
  assert.equal(resolveSourceEditorialClaims(platform, platform, "Ficha técnica."), "Ficha técnica.");
  const electromagnetic = { ...controlledGamForklift(), longDescription: "El freno electromagnético se incorpora de serie." };
  assert.match(resolveSourceEditorialClaims(electromagnetic, electromagnetic, "Ficha técnica.") ?? "", /freno electromagnético/u);
});

test("conserva la familia y dos medidas de fuente corroboradas en un resumen técnico", () => {
  const basis = controlledGomarizPlatform();
  const record = { ...basis, specs: { ...basis.specs, Peso: "980 kg", Longitud: "1,37 m" } };
  const brief = resolveVerifiedTechnicalBrief(record, record);
  assert.match(brief ?? "", /^Plataforma de tijera MARCA MODELO10 de ocasión/u);
  assert.match(brief ?? "", /980 kg/u);
  assert.match(brief ?? "", /1,37 m/u);
  assert.equal(resolveVerifiedTechnicalBrief(record, { ...record, specs: { ...record.specs, Peso: "970 kg" } }), null);
  assert.equal(resolveVerifiedTechnicalBrief(record, { ...record, reference: "CONTROL-OTRA" }), null);
  assert.equal(resolveVerifiedTechnicalBrief(record, { ...record, model: "MODELO11" }), null);
  assert.equal(resolveVerifiedTechnicalBrief(record, { ...record, title: "Carretilla elevadora MARCA MODELO10" }), null);
  assert.equal(resolveEditorialIdentitySummary({ ...record, model: "MODELO11" }, null), null);
});
