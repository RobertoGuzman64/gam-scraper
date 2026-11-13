import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { normalizeVerifiedEditorialCapacity } from "../domain/editorial-capacity-coherence.js";
import { normalizePreparedEditorialPresentation } from "../mapping/prepared-editorial-presentation.js";
import { controlledGamForklift } from "./editorial-contract-records.js";

const loadSource = (): ProductRecord => ({
  ...controlledGamForklift(),
  title: "Carretilla elevadora diésel 16400Kg MARCA MODELO10",
  shortDescription: "➨ MARCA MODELO10 ➨ Carretilla elevadora diésel de 7 metros ⭐ Capacidad de carga de 16400 kg",
  longDescription: "La carretilla elevadora diésel MARCA MODELO10 declara capacidad de carga de hasta 16000 kg y motor diésel.",
  specs: { Marca: "MARCA", Modelo: "MODELO10", "Capacidad de carga (kg)": "16000 KG", "Tipo motor": "Diésel" }
});

const changed = (source: ProductRecord, providerId: ProductRecord["providerId"], model: string): ProductRecord => ({
  ...source,
  providerId,
  reference: `CONTROL-${model}`,
  url: `https://equipos.example.org/${providerId}/${model.toLowerCase()}`,
  model,
  title: source.title?.replaceAll("MODELO10", model) ?? null,
  shortDescription: source.shortDescription?.replaceAll("MODELO10", model) ?? null,
  longDescription: source.longDescription?.replaceAll("MODELO10", model) ?? null,
  specs: { ...source.specs, Modelo: model }
});

const documentFor = (source: ProductRecord) => ({
  title: source.title,
  description: source.shortDescription,
  description_general: source.longDescription,
  reference: source.reference,
  sourceUrl: source.url,
  spec: { ...source.specs }
});

test("la capacidad nominal corroborada corrige título y resumen de modelos nuevos sin dependencia del proveedor", () => {
  for (const [providerId, model] of [
    ["gam", "CONTROL10"], ["gomariz", "CONTROL11"], ["mercaeleva", "CONTROL12"]
  ] as const) {
    const source = changed(loadSource(), providerId, model);
    const before = JSON.stringify(source);
    const normalized = normalizeVerifiedEditorialCapacity(source, documentFor(source));
    assert.match(normalized.title ?? "", /16000 kg/iu);
    assert.doesNotMatch(normalized.title ?? "", /16400/iu);
    assert.match(normalized.description ?? "", /16000 kg/iu);
    assert.doesNotMatch(normalized.description ?? "", /16400/iu);
    assert.equal(normalized.description_general, source.longDescription);
    assert.deepEqual(normalizeVerifiedEditorialCapacity(source, { ...documentFor(source), ...normalized }), normalized);
    assert.equal(JSON.stringify(source), before);
  }
});

test("un resumen técnico corroborado corrige el título y una general discordante", () => {
  const source = changed(loadSource(), "mercaeleva", "CONTROL12");
  const consistent: ProductRecord = {
    ...source,
    shortDescription: source.shortDescription?.replace("16400 kg", "16000 kg") ?? null,
    longDescription: source.longDescription?.replace("16000 kg", "16400 kg") ?? null
  };
  const normalized = normalizeVerifiedEditorialCapacity(consistent, documentFor(consistent));
  assert.match(normalized.title ?? "", /16000 kg/iu);
  assert.match(normalized.description_general ?? "", /16000 kg/iu);
  assert.doesNotMatch(normalized.description_general ?? "", /16400 kg/iu);
});

test("las contradicciones de unidad, fuente, modelo, magnitud y procedencia bloquean cualquier corrección", () => {
  const source = changed(loadSource(), "gomariz", "CONTROL11");
  const document = documentFor(source);
  for (const altered of [
    { ...source, reference: "CONTROL-OTRA" },
    { ...source, url: `${source.url}?variante=2` },
    { ...source, model: "OTRO-MODELO" },
    { ...source, specs: { ...source.specs, Modelo: "OTRO-MODELO" } },
    { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "12500 KG" } },
    { ...source, longDescription: source.longDescription?.replace("16000 kg", "12500 kg") ?? null },
    { ...source, longDescription: `${source.longDescription} Capacidad de carga de 14000 kg.` }
  ]) assert.deepEqual(normalizeVerifiedEditorialCapacity(altered, document), {
    title: document.title, description: document.description, description_general: document.description_general
  });
  for (const mismatch of [
    { ...document, sourceUrl: `${document.sourceUrl}?otra=1` },
    { ...document, spec: { ...document.spec, Modelo: "CONTROL12" } },
    { ...document, spec: { ...document.spec, "Capacidad de carga (kg)": "12500 KG" } },
    { ...document, title: "Plataforma de tijera 16400 Kg CONTROL11" }
  ]) assert.deepEqual(normalizeVerifiedEditorialCapacity(source, mismatch), {
    title: mismatch.title, description: mismatch.description, description_general: mismatch.description_general
  });
});

test("la presentación armoniza las afirmaciones sin tocar especificaciones ni atributos ni la fuente", () => {
  const source = loadSource();
  const prepared = prepareSourceProduct(source).product;
  const published = { ...prepared, title: source.title, description_title: source.title, description: source.shortDescription };
  const original = JSON.stringify({ source, published });
  const normalized = normalizePreparedEditorialPresentation(source, published);
  assert.match(normalized.title ?? "", /16000 kg/iu);
  assert.match(normalized.description ?? "", /16000 kg/iu);
  assert.equal(normalized.description_title, normalized.title);
  assert.deepEqual(normalized.spec, published.spec);
  assert.deepEqual(normalized.attributes, published.attributes);
  assert.deepEqual(normalizePreparedEditorialPresentation(source, normalized), normalized);
  assert.equal(JSON.stringify({ source, published }), original);
});

test("no se corrige una capacidad opcional ni se propagan datos entre fichas de un mismo modelo", () => {
  const source = loadSource();
  const document = documentFor(source);
  const uncertain = { ...source,
    longDescription: "La carretilla elevadora MARCA MODELO10 puede alcanzar 16000 kg según equipamiento." };
  assert.deepEqual(normalizeVerifiedEditorialCapacity(uncertain, document), {
    title: document.title, description: document.description, description_general: document.description_general
  });
  assert.deepEqual(normalizeVerifiedEditorialCapacity({ ...source, reference: "CONTROL-NUEVA" }, document), {
    title: document.title, description: document.description, description_general: document.description_general
  });
});
