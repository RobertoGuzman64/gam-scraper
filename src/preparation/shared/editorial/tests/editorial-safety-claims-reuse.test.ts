import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift
} from "./editorial-contract-records.js";

const general = "La ficha describe las características técnicas verificadas de esta unidad.";

const newUnit = (base: ProductRecord): ProductRecord => ({
  ...base,
  reference: "CONTROL-88",
  model: "MODELO88",
  title: base.title?.replace("MODELO10", "MODELO88") ?? null,
  url: base.url?.replace(/CONTROL-\d+/gu, "CONTROL-88").replace("modelo10", "modelo88") ?? null,
  specs: { ...base.specs, Marca: "MARCA", Modelo: "MODELO88" },
  longDescription: null,
  shortDescription: null
});

const originalCases = [
  { dataset: "gam-original", reference: "2018", claim: /declara frenado regenerativo/iu },
  { dataset: "gam-original", reference: "6901", claim: /declara mandos proporcionales/iu },
  { dataset: "mercaeleva-original", reference: "M168-3277", claim: /declara dirección asistida/iu }
] as const;

test("frenado y seguridad documentados sobreviven a la preparación de las unidades históricas", () => {
  for (const { dataset, reference, claim } of originalCases) {
    const record = accreditedSourceRecord(dataset, reference);
    const before = JSON.stringify(record);
    assert.match(resolveSourceEditorialClaims(record, record, general) ?? "", claim);
    const prepared = prepareSourceProduct(record);
    assert.match(prepared.product.description_general ?? "", claim);
    assert.equal(JSON.stringify(record), before);
  }
});

test("una máquina nueva compatible de cada proveedor recibe las afirmaciones de su propia fuente", () => {
  for (const basis of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const unit = newUnit(basis);
    const declared: ProductRecord = {
      ...unit,
      longDescription: "La carretilla incorpora frenado regenerativo, parada de emergencia y control de estabilidad.",
      specs: { ...unit.specs, "Frenado regenerativo": true, "Parada de emergencia": true, "Control de estabilidad": true }
    };
    const text = resolveSourceEditorialClaims(declared, declared, general) ?? "";
    assert.match(text, /declara frenado regenerativo/iu);
    assert.match(text, /declara parada de emergencia/iu);
    assert.match(text, /declara control de estabilidad/iu);
    const prepared = prepareSourceProduct(declared).product.description_general ?? "";
    assert.match(prepared, /declara frenado regenerativo/iu);
    assert.match(prepared, /declara parada de emergencia/iu);
    assert.match(prepared, /declara control de estabilidad/iu);
    assert.equal(resolveSourceEditorialClaims(declared, declared, text), text);
  }
});

test("los controles de seguridad comparten extracción sin inventar prestaciones opcionales o negadas", () => {
  const declarations = [
    ["Frenado automático", "frenado automático"],
    ["Controles proporcionales", "controles proporcionales"],
    ["Dirección asistida", "dirección asistida"],
    ["Detección de obstáculos", "detección de obstáculos"],
    ["Control de estabilidad", "control de estabilidad"],
    ["Control de tracción TCS", "control de tracción TCS"],
    ["Sistema antivuelco ACS", "sistema antivuelco ACS"],
    ["Parada de emergencia", "parada de emergencia"]
  ] as const;
  const base = newUnit(controlledGamForklift());
  for (const [key, wording] of declarations) {
    const source: ProductRecord = {
      ...base,
      longDescription: `La carretilla incorpora ${wording}.`,
      specs: { ...base.specs, [key]: true }
    };
    assert.notEqual(resolveSourceEditorialClaims(source, source, general), general, key);
    assert.equal(resolveSourceEditorialClaims({ ...source, specs: { ...source.specs, [key]: false } },
      { ...source, specs: { ...source.specs, [key]: false } }, general), general, key);
    for (const wordingOfSource of [
      `La carretilla no incluye ${wording}.`,
      `La carretilla incorpora ${wording} como opción.`,
      `La carretilla puede incorporar ${wording} según la versión.`
    ]) {
      const conditional = { ...source, longDescription: wordingOfSource };
      assert.equal(resolveSourceEditorialClaims(conditional, conditional, general), general, key);
    }
  }
});

test("el frenado y la seguridad de una unidad no se atribuyen a otra variante, proveedor o registro", () => {
  for (const basis of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source: ProductRecord = {
      ...newUnit(basis),
      longDescription: "La carretilla incorpora frenado regenerativo y parada de emergencia.",
      specs: { ...basis.specs, Marca: "MARCA", Modelo: "MODELO88", "Frenado regenerativo": true, "Parada de emergencia": true }
    };
    for (const prepared of [
      { ...source, reference: "OTRA-UNIDAD" },
      { ...source, model: "OTRA-VARIANTE" },
      { ...source, providerId: source.providerId === "gam" ? "gomariz" as const : "gam" as const },
      { ...source, condition: "Nuevo" as const },
      { ...source, url: "https://example.invalid/otra-unidad" },
      { ...source, specs: { ...source.specs, "Frenado regenerativo": false, "Parada de emergencia": false } }
    ]) assert.equal(resolveSourceEditorialClaims(source, prepared, general), general);
    const absent = { ...source, longDescription: null, specs: { ...source.specs, "Frenado regenerativo": false, "Parada de emergencia": false } };
    assert.equal(resolveSourceEditorialClaims(absent, absent, general), general);
  }
});
