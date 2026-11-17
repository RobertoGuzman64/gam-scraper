import assert from "node:assert/strict";
import test from "node:test";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { removeSourcedPromotionalClosing } from "../domain/editorial-sourced-commercial-tail.js";
import { resolveSourcedShortDiscrepancy } from "../domain/editorial-sourced-short-discrepancy.js";

const original = (reference: string): ProductRecord => accreditedSourceRecord("gam-original", reference);
const longOriginal = (reference: string): ProductRecord => accreditedSourceRecord("gam-editorial-cases", reference);
const discrepancyOriginal = (): ProductRecord => accreditedSourceRecord("gam-short-discrepancy-source", "2168");

const quantities = (value: string): ReadonlySet<string> => new Set(value.match(/\d+(?:[.,]\d+)*/gu) ?? []);

test("recorta únicamente cierres publicitarios de la misma referencia sin eliminar sus cifras", () => {
  for (const reference of ["2208", "2209", "2210"] as const) {
    const source = longOriginal(reference);
    const text = source.longDescription ?? "";
    const shortened = removeSourcedPromotionalClosing(source, source, text, true);
    assert.ok(shortened, reference);
    assert.ok(shortened.length < text.length, reference);
    for (const quantity of quantities(text)) assert.ok(quantities(shortened).has(quantity), `${reference}: ${quantity}`);
  }
  const safety = prepareSourceProduct(original("4031")).product.description_general ?? "";
  assert.match(safety, /Thermo-Sentry/u);
  assert.match(safety, /SweepMax/u);
  assert.match(safety, /ShakeMax 360/u);
  assert.ok(safety.includes(original("4031").longDescription ?? ""));
});

test("conserva los datos técnicos añadidos después del original", () => {
  const source = original("4018");
  const sourceText = source.longDescription ?? "";
  const addition = " La descripción breve del anuncio identifica un depósito de solución de 303 litros. Es una característica mencionada en la fuente, sujeta a comprobación de la máquina ofrecida.";
  const result = removeSourcedPromotionalClosing(source, source, `${sourceText}${addition}`, true);
  assert.ok(result);
  assert.ok(result.endsWith(addition));
  assert.match(result, /tejadillo opcional/u);
  for (const quantity of quantities(sourceText)) assert.ok(quantities(result).has(quantity));
});

test("neutraliza la frase comercial sin dejar sin respuesta la pregunta del anuncio", () => {
  for (const reference of ["6477", "6479", "6813"] as const) {
    const source = original(reference);
    const before = source.longDescription ?? "";
    const result = removeSourcedPromotionalClosing(source, source, before, true);
    assert.ok(result);
    assert.match(result, /¿Es adecuada para (?:el reparto urbano|repartos urbanos)\? Sí,/u);
    assert.match(result, /se presenta como opci[oó]n para repartos ligeros/u);
    for (const quantity of quantities(before)) assert.ok(quantities(result).has(quantity));
  }
});

test("rechaza referencias distintas, identidades cruzadas y textos incompletos", () => {
  const source = longOriginal("2208");
  const general = source.longDescription ?? "";
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, reference: "OTRA-UNIDAD" },
    { ...source, url: "https://example.org/otra-unidad" },
    { ...source, brand: "OTRA-MARCA" },
    { ...source, model: "OTRO-MODELO" },
    { ...source, condition: "Segunda mano" }
  ];
  for (const variant of variants) {
    assert.equal(removeSourcedPromotionalClosing(source, variant, general, source.providerId === variant.providerId), null);
  }
  assert.equal(removeSourcedPromotionalClosing(source, source, general, false), null);
  assert.equal(removeSourcedPromotionalClosing(source, source, "Texto ajeno a esta referencia.", true), null);
  assert.equal(removeSourcedPromotionalClosing({ ...source, longDescription: null }, source, general, true), null);
  assert.equal(removeSourcedPromotionalClosing(source, source, `${general} Añadido sin procedencia.`, true), null);
});

test("expone una discrepancia de capacidad sin atribuir motor o capacidad no corroborados", () => {
  const source = discrepancyOriginal();
  const snapshot = JSON.stringify(source);
  const short = resolveSourcedShortDiscrepancy(source, source, source.shortDescription, true);
  assert.ok(short);
  assert.match(short, /8\.000 kg/u);
  assert.match(short, /48 toneladas/u);
  assert.match(short, /deben contrastarse/u);
  assert.doesNotMatch(short, /Cummins/u);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.product.description, short);
  assert.equal(JSON.stringify(source), snapshot);
});

test("no reutiliza discrepancias entre proveedores, unidades, variantes ni capacidades", () => {
  const source = discrepancyOriginal();
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, reference: "OTRA-UNIDAD" },
    { ...source, url: "https://example.org/otra-unidad" },
    { ...source, model: "H8XD-EC8" },
    { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "9000 KG" } },
    { ...source, condition: "Segunda mano" }
  ];
  for (const variant of variants) {
    assert.equal(resolveSourcedShortDiscrepancy(source, variant, source.shortDescription, source.providerId === variant.providerId), null);
  }
  assert.equal(resolveSourcedShortDiscrepancy(source, source, source.shortDescription, false), null);
  assert.equal(resolveSourcedShortDiscrepancy(source, source, "Descripción comercial ajena.", true), null);
});
