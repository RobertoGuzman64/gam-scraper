import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { resolveVerifiedEditorialUnitContext } from "../domain/editorial-unit-context.js";
import { resolveUnbrandedEditorial } from "../domain/editorial-unbranded-equipment.js";
import { editorialSourceDigest, loadEditorialKnowledge } from "../../../../infrastructure/filesystem/editorial/knowledge.js";
import { selectUnitKnowledge } from "../domain/editorial-knowledge.js";

const get = (provider: string, reference: string): ProductRecord => {
  if (provider === "gam") return accreditedSourceRecord("gam-original", reference);
  if (provider === "gomariz") return accreditedSourceRecord("gomariz-original", reference);
  if (provider === "mercaeleva") return accreditedSourceRecord("mercaeleva-original", reference);
  throw new Error(`Proveedor desconocido: ${provider}`);
};


test("centro de carga y radio de giro usan concepto y unidad; una contradicción original no se publica", () => {
  const contradicted = get("gam", "2096");
  const corroborated = get("gam", "2057");
  assert.equal(resolveEditorialFacts(contradicted)?.loadCenterMm, null);
  assert.equal(resolveEditorialFacts(corroborated)?.loadCenterMm, 1200);
  assert.doesNotMatch(resolveReusableEditorial(contradicted).general ?? "", /centro de carga declarado de 900 mm/u);
  assert.match(resolveReusableEditorial(corroborated).general ?? "", /centro de carga declarado de 1\.200 mm/u);
  assert.equal(resolveEditorialFacts({ ...corroborated, specs: { ...corroborated.specs, "Centro de carga": "1200 kg" } })?.loadCenterMm, null);
});

test("los tamaños de cesta y la anchura de limpieza siguen reglas familiares reutilizables", () => {
  const platform = get("gam", "6901");
  const cleaner = get("gam", "3993");
  assert.deepEqual([resolveEditorialFacts(platform)?.basketLengthM, resolveEditorialFacts(platform)?.basketWidthM], [1.83, 1]);
  assert.equal(resolveEditorialFacts(cleaner)?.cleaningWidthM, 0.368);
  assert.match(resolveReusableEditorial(platform).general ?? "", /cesta de 1,83 × 1 m/u);
  assert.equal(resolveEditorialFacts({ ...platform, specs: { ...platform.specs, "Dimensiones Cesta": "1400x700x1100 metros" } })?.basketLengthM, null);
});

test("los módulos sin marca ni modelo comparten plantilla y no heredan dimensiones de otras unidades", () => {
  const first = get("gam", "6814");
  const second = get("gam", "6815");
  assert.match(resolveUnbrandedEditorial(first)?.general ?? "", /longitud de 1,3 m/u);
  assert.match(resolveUnbrandedEditorial(second)?.general ?? "", /longitud de 2,15 m/u);
  assert.match(prepareSourceProduct(first).product.description_general ?? "", /módulo sanitario/u);
  assert.equal(resolveUnbrandedEditorial({ ...first, url: "https://example.org/es/estructuras/6814-modulo-bano-unitario" }), null);
  assert.equal(resolveUnbrandedEditorial({ ...first, specs: {} }), null);
});

test("prestaciones de seguridad no se trasladan cuando la fuente expresa opcionalidad o negación", () => {
  const source = get("gam", "6901");
  const base = resolveReusableEditorial(source).general;
  assert.ok(base);
  assert.match(resolveSourceEditorialClaims(source, source, base) ?? "", /mandos proporcionales/u);
  const optional = { ...source, longDescription: "Los controles proporcionales son opcionales para este modelo." };
  assert.equal(resolveSourceEditorialClaims(optional, optional, base), base);
  const denied = { ...source, longDescription: "Este modelo no dispone de controles proporcionales." };
  assert.equal(resolveSourceEditorialClaims(denied, denied, base), base);
  assert.equal(resolveSourceEditorialClaims({ ...source, model: "OTRO" }, source, base), base);
});

test("ubicación y serie únicamente se añaden desde los campos coincidentes de la unidad original", () => {
  const source = get("gam", "6682");
  const general = resolveReusableEditorial(source).general;
  assert.ok(general);
  const expectedLocation = source.location?.trim();
  assert.ok(expectedLocation);
  const enriched = resolveVerifiedEditorialUnitContext(source, general);
  assert.match(enriched ?? "", /Ubicación declarada para esta unidad/u);
  assert.ok(enriched?.includes(expectedLocation));
  assert.doesNotMatch(resolveVerifiedEditorialUnitContext({ ...source, location: "OTRA" }, general) ?? "", /Ubicación declarada para esta unidad/u);
  assert.doesNotMatch(resolveVerifiedEditorialUnitContext({ ...source, specs: { ...source.specs, Ubicación: "OTRA" } }, general) ?? "", /Ubicación declarada para esta unidad/u);
});

test("la identidad cruzada histórica recuperada se consume como evidencia firmada; otra unidad no la hereda", () => {
  const source = get("gam", "5730");
  const known = loadEditorialKnowledge();
  const entry = selectUnitKnowledge({ key: `gam:${source.reference}`, sourceUrl: source.url,
    brand: source.brand ?? "", model: source.model ?? "" }, known, editorialSourceDigest(source));
  assert.ok(entry.short);
  assert.equal(prepareSourceProduct(source).product.description, entry.short);
  const next = { ...source, reference: "900099", url: source.url.replace("/5730-", "/900099-") };
  assert.equal(selectUnitKnowledge({ key: `gam:${next.reference}`, sourceUrl: next.url,
    brand: next.brand ?? "", model: next.model ?? "" }, known, editorialSourceDigest(next)).short, null);
});

test("las fichas contradictorias solo usan su excepción declarativa firmada", () => {
  const source = get("gam", "6666");
  const result = prepareSourceProduct(source).product;
  assert.match(result.description ?? "", /Modelo discrepante entre título y ficha técnica/u);
  const corrupted = { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "3500 kg" } };
  assert.notEqual(prepareSourceProduct(corrupted).product.description, result.description);
});

test("la higiene del origen elimina marcadores y afirmaciones huérfanas sin tocar textos no acreditados", async () => {
  const { cleanAuthenticatedSourceEditorial } = await import("../domain/editorial-text-hygiene.js");
  const source = get("gam", "2096");
  const short = source.shortDescription;
  const long = source.longDescription;
  const clean = cleanAuthenticatedSourceEditorial(source, short, long);
  assert.doesNotMatch(clean.short ?? "", /^[➨★⭐]/u);
  assert.doesNotMatch(clean.general ?? "", /\. S[ií]\. /u);
  assert.equal(cleanAuthenticatedSourceEditorial({ ...source, model: "OTRO" }, short, long).short, short);
});

test("RE049: los módulos sanitarios históricos conservan clase, medidas y procedencia propias", () => {
  for (const { reference, length, width, weight } of [
    { reference: "6814", length: "1,3 m", width: "1,1 m", weight: "200 kg" },
    { reference: "6815", length: "2,15 m", width: "1,3 m", weight: "300 kg" }
  ]) {
    const source = get("gam", reference);
    const snapshot = JSON.stringify(source);
    const composed = resolveUnbrandedEditorial(source);
    assert.match(composed?.short ?? "", /Módulo sanitario/u);
    for (const measure of [length, width, weight]) assert.ok(composed?.general?.includes(measure), measure);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.equal(prepared.product.description_general, composed?.general);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE049: una unidad nueva reutiliza la regla sanitaria con dimensiones exclusivamente propias", () => {
  const source = get("gam", "6814");
  const reference = "8814";
  const incoming: ProductRecord = {
    ...source,
    reference,
    url: source.url?.replace("/6814-", `/${reference}-`) ?? null,
    shortDescription: null,
    longDescription: null,
    specs: { ...source.specs, Longitud: "2800 mm", Anchura: "1400 mm", Peso: "250 KG" }
  };
  const snapshot = JSON.stringify(incoming);
  const composed = resolveUnbrandedEditorial(incoming);
  assert.ok(composed);
  for (const measure of ["longitud de 2,8 m", "anchura de 1,4 m", "peso declarado de 250 kg"]) {
    assert.ok(composed.general?.includes(measure), measure);
  }
  assert.doesNotMatch(composed.general ?? "", /longitud de 1,3 m|anchura de 1,1 m|peso declarado de 200 kg/u);
  const prepared = prepareSourceProduct(incoming);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.reference, reference);
  assert.equal(prepared.product.sourceUrl, incoming.url);
  assert.equal(prepared.product.description_general, composed.general);
  assert.equal(JSON.stringify(incoming), snapshot);
});

test("RE049: un título de caseta no puede reutilizar una ruta autenticada de módulo de baño", () => {
  for (const reference of ["6814", "6815"]) {
    const source = get("gam", reference);
    assert.equal(resolveUnbrandedEditorial({ ...source, title: "MÓDULO CASETA PREFABRICADO" }), null);
    assert.equal(resolveUnbrandedEditorial({ ...source, title: "PLATAFORMA DE TIJERA" }), null);
  }
});

test("RE049: procedencia, identidad de origen y ausencia de medidas bloquean la composición sanitaria", () => {
  const source = get("gam", "6814");
  for (const changed of [
    { ...source, providerId: "otro-proveedor" },
    { ...source, url: "https://example.invalid/es/estructuras/6814-modulo-bano-unitario" },
    { ...source, reference: "OTRA-UNIDAD" },
    { ...source, brand: "OTRA MARCA" },
    { ...source, model: "OTRO MODELO" },
    { ...source, specs: {} }
  ]) {
    assert.equal(resolveUnbrandedEditorial(changed), null);
  }
  const invalidLength = { ...source, specs: { ...source.specs, Longitud: "1300 kg" } };
  assert.doesNotMatch(resolveUnbrandedEditorial(invalidLength)?.general ?? "", /longitud de/u);
  assert.match(resolveUnbrandedEditorial(invalidLength)?.general ?? "", /anchura de 1,1 m/u);
  const another = get("gam", "6815");
  assert.doesNotMatch(resolveUnbrandedEditorial(another)?.general ?? "", /peso declarado de 200 kg/u);
});
