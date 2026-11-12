import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { resolveVerifiedEditorialUnitContext } from "../domain/editorial-unit-context.js";
import { resolveUnbrandedEditorial } from "../domain/editorial-unbranded-equipment.js";
import { editorialSourceDigest, loadEditorialKnowledge } from "../../../../infrastructure/filesystem/editorial/knowledge.js";
import { selectUnitKnowledge } from "../domain/editorial-knowledge.js";

const catalog = (provider: string): readonly ProductRecord[] => {
  const data: { readonly products: readonly ProductRecord[] } = JSON.parse(readFileSync(
    `catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`, "utf8"));
  return data.products;
};

const get = (provider: string, reference: string): ProductRecord => {
  const source = catalog(provider).find((item) => item.reference === reference);
  assert.ok(source, `${provider}:${reference}`);
  return source;
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
