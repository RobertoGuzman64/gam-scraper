import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { containsEditorialIdentity, containsEditorialBrandModel } from "../domain/editorial-identity-match.js";
import { verifiedEditorialIdentity, verifiedEditorialStructuredIdentity } from "../domain/editorial-source-contract.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { cleanAuthenticatedSourceEditorial } from "../domain/editorial-text-hygiene.js";
import { conciseVerifiedUnitGeneral } from "../domain/editorial-identity-summary.js";
import { normalizeVerifiedEditorialCapacity } from "../domain/editorial-capacity-coherence.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift
} from "./editorial-contract-records.js";

const sources = [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift];
const general = "La ficha técnica identifica las prestaciones documentadas de esta unidad.";

const update = (source: ProductRecord, title: string): ProductRecord => ({ ...source, title });

test("marca y modelo admiten separadores equivalentes, pero no sufijos ni prefijos de variantes", () => {
  for (const text of ["Carretilla MARCA MODELO10", "Carretilla Marca MODELO-10", "Carretilla MARCA MODELO 10"]) {
    assert.equal(containsEditorialBrandModel(text, "MARCA", "MODELO10"), true, text);
  }
  for (const text of ["Carretilla MARCA MODELO100", "Carretilla MARCA XMODELO10", "Carretilla XMARCA MODELO10", "Carretilla MARCAN MODELO10"]) {
    assert.equal(containsEditorialBrandModel(text, "MARCA", "MODELO10"), false, text);
  }
  assert.equal(containsEditorialIdentity("GENIE Z45/25 J", "Z45/25J"), true);
  assert.equal(containsEditorialIdentity("GENIE Z45/250J", "Z45/25J"), false);
  assert.equal(containsEditorialIdentity("GAM equipo", ""), false);
});

test("los tres proveedores rechazan la identidad parecida y conservan la unidad compatible", () => {
  for (const factory of sources) {
    const record = factory();
    assert.equal(verifiedEditorialIdentity(record), true, record.providerId);
    assert.equal(verifiedEditorialIdentity(update(record, "Carretilla elevadora MARCA MODELO100 2500 kg")), false);
    assert.equal(verifiedEditorialIdentity(update(record, "Carretilla elevadora MARCAS MODELO10 2500 kg")), false);
    assert.equal(verifiedEditorialIdentity(update(record, "Carretilla elevadora MARCA MODELO-10 2500 kg")), true);
    const described = { ...record, longDescription: "La carretilla incorpora dirección asistida." };
    assert.match(resolveSourceEditorialClaims(described, described, general) ?? "", /dirección asistida/u);
    const wrongTitle = update(described, "Carretilla elevadora MARCA MODELO100 2500 kg");
    assert.equal(resolveSourceEditorialClaims(wrongTitle, wrongTitle, general), general);
    const wrongSpecs = { ...described, specs: { ...described.specs, Modelo: "MODELO100" } };
    assert.equal(resolveSourceEditorialClaims(wrongSpecs, wrongSpecs, general), general);
  }
});

test("la limpieza de textos no acepta un modelo que solo aparece como subcadena de otra variante", () => {
  for (const factory of sources) {
    const record = factory();
    const confused = "¡Hola! Esta máquina MARCA MODELO100 dispone de una oferta comercial con abundante equipamiento técnico para trabajos de manutención.";
    const valid = "¡Hola! Esta máquina MARCA MODELO10 dispone de una oferta comercial con abundante equipamiento técnico para trabajos de manutención.";
    assert.equal(cleanAuthenticatedSourceEditorial({ ...record, longDescription: confused }, null, confused).general, confused);
    assert.equal(cleanAuthenticatedSourceEditorial({ ...record, longDescription: valid }, null, valid).general, valid.replace(/^¡Hola!\s+/u, ""));
  }
});

test("el resumen verificado exige identidad completa en su oración y no solo una subcadena", () => {
  const source = controlledGamForklift();
  const correct = "La carretilla MARCA MODELO10 conserva las prestaciones verificadas para su uso en almacenes industriales.";
  const mismatched = "La carretilla MARCA MODELO100 conserva las prestaciones verificadas para su uso en almacenes industriales.";
  assert.equal(conciseVerifiedUnitGeneral(source, correct), correct);
  assert.equal(conciseVerifiedUnitGeneral(source, mismatched), null);
});

test("la normalización de capacidad no corrige textos de una variante con nombre más largo", () => {
  const record = controlledGamForklift();
  const source: ProductRecord = {
    ...record,
    shortDescription: "Carretilla MARCA MODELO10 con capacidad de carga de 2500 kg.",
    longDescription: "La carretilla MARCA MODELO10 declara capacidad nominal de 2500 kg.",
    specs: { ...record.specs, Marca: record.brand ?? "", Modelo: record.model ?? "" }
  };
  const unrelated = {
    title: "Carretilla MARCA MODELO100 con 2000 kg",
    description: "Carretilla MARCA MODELO100 con capacidad de carga de 2000 kg.",
    description_general: "La ficha de MARCA MODELO100 indica capacidad nominal de 2000 kg.",
    sourceUrl: source.url,
    reference: source.reference,
    spec: { ...source.specs }
  };
  const result = normalizeVerifiedEditorialCapacity(source, unrelated);
  assert.equal(result.title, unrelated.title);
  assert.equal(result.description, unrelated.description);
  assert.equal(result.description_general, unrelated.description_general);
});

test("una variante discordante en el título no contamina los hechos técnicos acreditados", () => {
  for (const factory of sources) {
    const original = factory();
    const title = original.title?.replace("MODELO10", "MODELO100") ?? "";
    const source: ProductRecord = {
      ...original,
      title,
      specs: { ...original.specs, Marca: original.brand ?? "", Modelo: original.model ?? "" },
      longDescription: "La carretilla cuenta con dirección asistida."
    };
    assert.equal(verifiedEditorialIdentity(source), false);
    assert.equal(verifiedEditorialStructuredIdentity(source), true);
    const published = prepareSourceProduct(source).product;
    assert.match(published.title ?? "", /MODELO10(?!0)/u, original.providerId);
    assert.doesNotMatch(published.title ?? "", /MODELO100/u, original.providerId);
    assert.doesNotMatch(published.description_general ?? "", /declara dirección asistida/u, original.providerId);
  }
});

test("sin corroboración de ficha técnica no se permite el modo de composición estructurada", () => {
  for (const factory of sources) {
    const original = factory();
    const conflict: ProductRecord = {
      ...original,
      title: "Carretilla MARCA MODELO100 de 2500 kg",
      specs: { ...original.specs, Marca: original.brand ?? "", Modelo: "MODELO100" }
    };
    assert.equal(verifiedEditorialIdentity(conflict), false);
    assert.equal(verifiedEditorialStructuredIdentity(conflict), false);
    assert.equal(resolveSourceEditorialClaims(conflict, conflict, general), general);
  }
});
