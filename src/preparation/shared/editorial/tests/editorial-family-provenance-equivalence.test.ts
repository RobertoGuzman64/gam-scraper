import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveGomarizEditorialDomainSource } from "../../../gomariz/editorial/mapping/domain-source.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveDocumentedFamilyTitle } from "../domain/editorial-documented-title.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { editorialFamilyOf, resolveConsistentEditorialFamily } from "../domain/editorial-families.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";
import { controlledGomarizPlatform } from "./editorial-contract-records.js";

const scissor = accreditedSourceRecord("gomariz-original", "TE1591");
const articulated = accreditedSourceRecord("gomariz-original", "BA1253");
const generator = accreditedSourceRecord("gomariz-original", "GR1356");
const tracks = accreditedSourceRecord("gomariz-original", "OR1537");
const tower = accreditedSourceRecord("gomariz-special-original", "TO1242");
const gamForklift = accreditedSourceRecord("gam-original", "6878");
const mercaForklift = accreditedSourceRecord("mercaeleva-original", "M208-7097");

const newUnit = (source: ProductRecord, reference: string): ProductRecord => ({
  ...source,
  reference,
  url: `${source.url?.replace(/\/$/u, "")}-otra-unidad/`,
  shortDescription: null,
  longDescription: null,
  year: null,
  horometer: null,
  serialNumber: null,
  image: null,
  images: [],
  specs: { ...source.specs }
});

const familyOfSource = (record: ProductRecord): string | null => {
  const source = resolveGomarizEditorialDomainSource(record);
  return source ? resolveConsistentEditorialFamily(source.familyClues, record.title,
    typeof record.specs?.["Título adicional"] === "string" ? record.specs["Título adicional"] : null,
    `${record.subcategory ?? ""} | ${record.categoryName}`) : null;
};

test("el reconocimiento histórico de familias usa señales acreditadas y se consume en la preparación", () => {
  for (const [source, family] of [
    [scissor, "plataforma-tijera"],
    [articulated, "plataforma-articulada"],
    [generator, "grupo-electrogeno"],
    [tower, "torre-iluminacion"]
  ] as const) {
    const before = JSON.stringify(source);
    assert.equal(familyOfSource(source), family, source.reference ?? "");
    assert.equal(resolveEditorialFacts(source)?.family, family, source.reference ?? "");
    assert.equal(prepareSourceProduct(source).product.reference, source.reference);
    assert.equal(JSON.stringify(source), before);
  }
  assert.equal(editorialFamilyOf("grupo electrógeno"), "grupo-electrogeno");
  assert.equal(editorialFamilyOf("plataforma sobre orugas"), "plataforma-oruga");
  assert.equal(editorialFamilyOf("brazo articulado"), "plataforma-articulada");
  assert.equal(editorialFamilyOf("máquina sin familia declarada"), null);
});


test("las señales compartidas conservan familia en GAM y Mercaeleva sin confundir su procedencia", () => {
  for (const source of [gamForklift, mercaForklift]) {
    const snapshot = JSON.stringify(source);
    assert.equal(resolveEditorialFacts(source)?.family, "carretilla-elevadora");
    assert.equal(prepareSourceProduct(source).product.sourceUrl, source.url);
    assert.equal(resolveEditorialFacts({ ...source, providerId: "gomariz" }), null);
    assert.equal(resolveEditorialFacts({ ...source, specs: { ...source.specs, Modelo: "MODELO DISTINTO" } }), null);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("una unidad compatible obtiene su familia y sus atributos propios sin heredar el conocimiento firmado", () => {
  for (const [original, reference, family] of [
    [scissor, "TE2591", "plataforma-tijera"],
    [generator, "GR2356", "grupo-electrogeno"],
    [tower, "TO2242", "torre-iluminacion"]
  ] as const) {
    const incoming = newUnit(original, reference);
    const before = JSON.stringify(incoming);
    assert.equal(resolveEditorialFacts(incoming)?.family, family);
    assert.equal(familyOfSource(incoming), family);
    assert.equal(resolveKnowledgeEditorial(incoming).general, null);
    assert.equal(resolveKnowledgeEditorial(incoming).title, null);
    const result = prepareSourceProduct(incoming);
    assert.equal(result.product.reference, reference);
    assert.equal(result.product.sourceUrl, incoming.url);
    assert.ok(result.product.title?.includes(original.model ?? ""));
    assert.equal(JSON.stringify(incoming), before);
  }
});

test("la procedencia Gomariz no universal reconoce sus rutas especiales sin inventar familias", () => {
  for (const [record, family, title] of [
    [tracks, "plataforma-oruga", "Plataforma sobre orugas Socage 15S"],
    [generator, "grupo-electrogeno", "Grupo electrógeno Pramac GPW200P-FN"],
    [tower, "torre-iluminacion", "Torre de iluminación Generac EVE 9"]
  ] as const) {
    assert.equal(familyOfSource(record), family);
    assert.equal(resolveDocumentedFamilyTitle(record), title);
  }
  const noCategory = {
    ...controlledGomarizPlatform(),
    title: "MARCA MODELO10",
    url: "https://www.gomarizrent.com/producto/marca-modelo10/",
    longDescription: null
  };
  assert.equal(familyOfSource(noCategory), null);
  assert.equal(resolveEditorialFacts(noCategory), null);
  assert.equal(resolveDocumentedFamilyTitle(noCategory), null);
});

test("las rutas documentadas rechazan títulos incompatibles sin dejarse dominar por el orden de patrones", () => {
  for (const source of [scissor, generator, tower, tracks]) {
    const inconsistent = { ...source, title: `Carretilla elevadora ${source.brand} ${source.model}` };
    assert.equal(familyOfSource(inconsistent), null, source.reference ?? "");
    assert.equal(resolveEditorialFacts(inconsistent), null, source.reference ?? "");
    assert.equal(resolveReusableEditorial(inconsistent).general, null, source.reference ?? "");
    assert.equal(resolveDocumentedFamilyTitle(inconsistent), null, source.reference ?? "");
  }
});

test("identidad, proveedor, ruta y familia adicional discordantes bloquean la atribución", () => {
  for (const source of [scissor, generator, tower]) {
    for (const invalid of [
      { ...source, providerId: "gam" },
      { ...source, url: "https://example.invalid/venta/energia/generador/modelo/" },
      { ...source, brand: "MARCA DISTINTA" },
      { ...source, model: "MODELO DISTINTO" },
      { ...source, specs: { ...source.specs, "Título adicional": "CARRETILLA ELEVADORA" } }
    ]) {
      assert.equal(resolveEditorialFacts(invalid), null, `${source.reference}/${invalid.providerId}`);
      assert.equal(resolveReusableEditorial(invalid).general, null);
    }
  }
  assert.equal(resolveConsistentEditorialFamily(
    "plataforma de tijera", "plataforma articulada MARCA MODELO10", null, "", null), null);
  assert.equal(resolveConsistentEditorialFamily(
    "plataforma sobre orugas", "plataforma de tijera MARCA MODELO10", null, "", null), "plataforma-oruga");
});
