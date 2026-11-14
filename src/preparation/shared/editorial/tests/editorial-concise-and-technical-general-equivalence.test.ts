import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";
import {
  controlledGamForklift,
  controlledGomarizPlatform,
  controlledMercaelevaPlatform
} from "./editorial-contract-records.js";

const newUnit = (source: ProductRecord, reference: string): ProductRecord => ({
  ...source,
  reference,
  url: source.url?.replace(source.reference ?? "", reference) ?? null,
  specs: { ...source.specs }
});

test("RE057 recupera cortas concisas en originales Mercaeleva sin sustituir generales acreditadas", () => {
  for (const reference of ["M318-0509", "M838-0666", "M840-6795"]) {
    const source = accreditedSourceRecord("mercaeleva-original", reference);
    const snapshot = JSON.stringify(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(source.shortDescription, null, reference);
    assert.equal(prepared.status, "ready", reference);
    const short = prepared.product.description;
    const general = prepared.product.description_general;
    assert.ok(short, reference);
    assert.ok(general, reference);
    assert.ok(short.length < general.length, reference);
    assert.notEqual(short, general, reference);
    assert.match(short, /(?:altura de trabajo|plataforma)/u, reference);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE057 reutiliza la corta en una unidad nueva sin heredar textos firmados de la anterior", () => {
  const original = accreditedSourceRecord("mercaeleva-original", "M840-6795");
  const moved = newUnit(original, "M840-6795-OTRA");
  const signed = resolveKnowledgeEditorial(original, original);
  const unsigned = resolveKnowledgeEditorial(moved, moved);
  const prepared = prepareSourceProduct(moved);
  const composed = resolveReusableEditorial(moved);
  assert.ok(signed.short);
  assert.ok(signed.general);
  assert.equal(unsigned.short, null);
  assert.equal(unsigned.general, null);
  assert.ok(composed.short);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.description, composed.short);
  assert.match(prepared.product.description ?? "", /16 m/u);
  assert.notEqual(prepared.product.description, prepareSourceProduct(original).product.description);
  assert.notEqual(prepared.product.description_general, prepareSourceProduct(original).product.description_general);
  const another: ProductRecord = {
    ...controlledMercaelevaPlatform(),
    reference: "CONTROL-57",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/equipo-CONTROL-57",
    specs: { "Altura de trabajo": "12 m", "Tipo de motor": "Eléctrico" }
  };
  const next = prepareSourceProduct(another);
  assert.equal(next.status, "ready");
  assert.match(next.product.description ?? "", /12 m/u);
  assert.doesNotMatch(next.product.description ?? "", /10 m/u);
  assert.equal(next.product.description, resolveReusableEditorial(another).short);
});

test("RE057 no recupera una corta técnica para identidad o procedencia ajenas", () => {
  const source = controlledMercaelevaPlatform();
  for (const changed of [
    { ...source, model: "MODELO11" },
    { ...source, providerId: "otro-proveedor" },
    { ...source, url: "https://example.invalid/maquina/C-57" }
  ]) {
    assert.equal(resolveReusableEditorial(changed).short, null);
    assert.equal(prepareSourceProduct(changed).product.description, null);
  }
  assert.equal(resolveReusableEditorial({ ...source, specs: {} }).general, null);
  assert.equal(prepareSourceProduct({ ...source, specs: {} }).product.description_general, null);
});

test("RE058 compone generales modulares por familia y hechos en los tres proveedores", () => {
  for (const source of [controlledGamForklift(), controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const original = JSON.stringify(source);
    const shared = resolveReusableEditorial(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", source.providerId);
    assert.ok(shared.general, source.providerId);
    assert.ok(prepared.product.description_general?.startsWith(shared.general), source.providerId);
    assert.match(prepared.product.description_general ?? "", /MARCA MODELO10/u);
    assert.match(prepared.product.description_general ?? "", /La ficha técnica de/u);
    assert.equal(JSON.stringify(source), original);
  }
  const forklift = prepareSourceProduct(controlledGamForklift()).product.description_general;
  const platform = prepareSourceProduct(controlledMercaelevaPlatform()).product.description_general;
  assert.match(forklift ?? "", /carretilla elevadora/u);
  assert.match(platform ?? "", /plataforma de tijera/u);
  assert.doesNotMatch(platform ?? "", /carretilla elevadora/u);
});

test("RE058 excluye composiciones de familias incompatibles o datos técnicos ausentes", () => {
  for (const source of [controlledGamForklift(), controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    for (const changed of [
      { ...source, model: "MODELO11" },
      { ...source, url: "https://example.invalid/otra" },
      { ...source, providerId: "otro-proveedor" },
      { ...source, specs: {} }
    ]) {
      assert.equal(resolveReusableEditorial(changed).general, null);
      assert.equal(prepareSourceProduct(changed).product.description_general, null);
    }
  }
});

test("RE062 conserva generales técnicos corroborados de GAM y no el texto promocional del origen", () => {
  for (const [reference, elevation, load] of [
    ["6901", "16 m", "227 kg"],
    ["6139", "16 m", "230 kg"],
    ["6985", "20 m", "230 kg"]
  ] as const) {
    const source = accreditedSourceRecord("gam-original", reference);
    const snapshot = JSON.stringify(source);
    const general = prepareSourceProduct(source).product.description_general;
    assert.ok(general, reference);
    assert.match(general, /^La ficha técnica de plataforma articulada/u, reference);
    assert.ok(general.includes(elevation), reference);
    assert.ok(general.includes(load), reference);
    assert.ok(general.includes(source.brand ?? ""), reference);
    assert.ok(general.includes(source.model ?? ""), reference);
    assert.doesNotMatch(general, /➨|⭐/u, reference);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE062 recalcula medidas de otra unidad GAM y rechaza título o identidad contradictorios", () => {
  const source = controlledGamForklift();
  const changed: ProductRecord = {
    ...newUnit(source, "CONTROL-62"),
    title: "Carretilla elevadora MARCA MODELO10 3000 kg",
    specs: {
      ...source.specs,
      "Capacidad de carga (kg)": "3000 kg",
      "Altura de elevación (mm)": "6000 mm"
    }
  };
  const shared = resolveReusableEditorial(changed);
  const prepared = prepareSourceProduct(changed);
  assert.equal(prepared.status, "ready");
  assert.ok(shared.general);
  assert.ok(prepared.product.description_general?.startsWith(shared.general));
  assert.match(prepared.product.description_general ?? "", /6 m/u);
  assert.match(prepared.product.description_general ?? "", /3\.000 kg/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /2\.500 kg|4,5 m/u);
  const conflicting: ProductRecord = { ...changed, title: source.title };
  assert.equal(resolveReusableEditorial(conflicting).general, null);
  assert.equal(prepareSourceProduct(conflicting).product.description_general, null);
  for (const invalid of [
    { ...changed, model: "MODELO11" },
    { ...changed, url: "https://example.invalid/carretilla" }
  ]) {
    assert.equal(resolveReusableEditorial(invalid).general, null);
    assert.equal(prepareSourceProduct(invalid).product.description_general, null);
  }
});
