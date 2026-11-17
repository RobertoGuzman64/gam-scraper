import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { synthesizeSourcedLongGeneral } from "../domain/editorial-source-general-synthesis.js";

const original = (reference: string): ProductRecord => accreditedSourceRecord("gam-original", reference);
const quantities = (value: string): ReadonlySet<string> =>
  new Set(value.match(/\d+(?:[.,]\d+)*/gu) ?? []);
const words = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;

const sourcedReferences = [
  "6991", "6186", "6190", "6192", "6191", "6163", "4021", "2300",
  "2301", "2313", "6182", "4734", "2242", "2244", "2259", "2249", "2314"
] as const;

test("sintetiza originales extensos manteniendo sus cifras y la identidad de cada unidad", () => {
  for (const reference of sourcedReferences) {
    const source = original(reference);
    const sourceText = source.longDescription?.trim() ?? "";
    const snapshot = JSON.stringify(source);
    const summary = synthesizeSourcedLongGeneral(source, source, sourceText, true);
    assert.ok(summary, reference);
    assert.ok(words(summary) >= 160 && words(summary) < 300, reference);
    assert.ok(words(summary) < words(sourceText), reference);
    for (const quantity of quantities(sourceText)) {
      assert.ok(quantities(summary).has(quantity), `${reference}: ${quantity}`);
    }
    for (const sentence of summary.split(/(?<=[.!?])\s+(?=[¿¡A-ZÁÉÍÓÚÜÑ0-9])/u)) {
      assert.ok(sourceText.includes(sentence), `${reference}: ${sentence}`);
    }
    const prepared = prepareSourceProduct(source);
    assert.ok(words(prepared.product.description_general ?? "") < 300, reference);
    assert.ok(words(prepared.product.description_general ?? "") >= 160, reference);
    assert.equal(JSON.stringify(source), snapshot, reference);
  }
});

test("conserva los detalles distintivos y no deja preguntas comerciales aisladas", () => {
  assert.match(prepareSourceProduct(original("6186")).product.description_general ?? "", /700°/u);
  assert.match(prepareSourceProduct(original("6190")).product.description_general ?? "", /S3 Smart Stability System EVO/u);
  assert.match(prepareSourceProduct(original("6991")).product.description_general ?? "", /seg[uú]n versi[oó]n/u);
  const lithium = prepareSourceProduct(original("4734")).product.description_general ?? "";
  assert.match(lithium, /230 kg/u);
  assert.doesNotMatch(lithium, /¿Dónde comprar/u);
  assert.match(lithium, /¿Es adecuada para zonas interiores\? Sí,/u);
});

test("rechaza otras referencias, marcas, variantes, fuentes no autenticadas y textos ajenos", () => {
  const source = original("6186");
  const general = source.longDescription;
  assert.ok(general);
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "mercaeleva" },
    { ...source, reference: "OTRA-UNIDAD" },
    { ...source, url: "https://example.org/otra-unidad" },
    { ...source, brand: "OTRA-MARCA" },
    { ...source, model: "OTRO-MODELO" },
    { ...source, condition: "Segunda mano" }
  ];
  for (const other of variants) {
    assert.equal(synthesizeSourcedLongGeneral(source, other, general,
      source.providerId === other.providerId), null);
  }
  assert.equal(synthesizeSourcedLongGeneral(source, source, general, false), null);
  assert.equal(synthesizeSourcedLongGeneral(source, source, `${general} Texto adicional.`, true), null);
  assert.equal(synthesizeSourcedLongGeneral(source, source, general.slice(0, 80), true), null);
  assert.equal(synthesizeSourcedLongGeneral({ ...source, longDescription: null }, source, general, true), null);
  assert.equal(synthesizeSourcedLongGeneral({ ...source, longDescription: `${general} https://example.org` },
    source, `${general} https://example.org`, true), null);
});

test("sintetiza originales extensos sin perder sistemas de seguridad ni opciones", () => {
  const protections: Readonly<Record<string, readonly RegExp[]>> = {
    "6187": [/parada de emergencia/iu, /limitador de momento/iu, /700°/u],
    "6745": [/freno electromagnético/iu, /Smart Lift/u, /opciones de batería/iu],
    "6746": [/freno de servicio electromagnético/iu, /según la versión/iu, /opción disponible/iu]
  };
  for (const [reference, required] of Object.entries(protections)) {
    const source = original(reference);
    const general = source.longDescription ?? "";
    const summary = synthesizeSourcedLongGeneral(source, source, general, true);
    assert.ok(summary, reference);
    assert.ok(words(summary) < words(general), reference);
    for (const number of quantities(general)) assert.ok(quantities(summary).has(number), `${reference}: ${number}`);
    for (const feature of required) assert.match(summary, feature, reference);
  }
});

test("no elimina mecanismos de seguridad de textos sin una síntesis acreditada", () => {
  const source = original("4031");
  assert.equal(synthesizeSourcedLongGeneral(source, source, source.longDescription, true), null);
});

test("conserva el bloque editorial previo y rechaza prefijos ajenos", () => {
  const source = original("6186");
  const originalGeneral = source.longDescription ?? "";
  const prefix = `La ficha técnica de ${source.title} declara medidas de la unidad.`;
  const general = `${prefix}\n\n${originalGeneral}`;
  const result = synthesizeSourcedLongGeneral(source, source, general, true);
  assert.ok(result);
  assert.ok(result.startsWith(`${prefix}\n\n`));
  assert.ok(words(result) < words(general));
  for (const number of quantities(originalGeneral)) assert.ok(quantities(result).has(number));
  assert.equal(synthesizeSourcedLongGeneral(source, source, `Prefijo extraño.\n\n${originalGeneral}`, true), null);
  assert.equal(synthesizeSourcedLongGeneral(source, { ...source, reference: "OTRA" }, general, true), null);
});
