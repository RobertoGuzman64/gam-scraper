import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const references = ["M572-8190", "M205-2951", "M178-6194", "M005-4474", "M030-7485"] as const;

const originals = references.map((reference) => accreditedSourceRecord("mercaeleva-original", reference));

const anotherUnit = (source: ProductRecord): ProductRecord => {
  const reference = `${source.reference}-OTRA`;
  return {
    ...source,
    reference,
    url: source.url.replace(source.reference ?? "", reference),
    year: null,
    horometer: null,
    serialNumber: null,
    image: null,
    images: [],
    shortDescription: null,
    longDescription: null,
    specs: {
      Marca: source.brand ?? "",
      Modelo: source.model ?? "",
      "Título adicional": source.specs?.["Título adicional"] ?? "",
      "Tipo de motor": source.specs?.["Tipo de motor"] ?? "",
      "Altura de trabajo": source.specs?.["Altura de trabajo"] ?? ""
    }
  };
};

test("los cinco originales de plataformas conservan el conocimiento histórico como respaldo subordinado a sus datos", () => {
  for (const source of originals) {
    const snapshot = JSON.stringify(source);
    const selected = resolveKnowledgeEditorial(source, source);
    assert.ok(selected.fallbackGeneral, source.reference ?? "");
    assert.equal(selected.general, null);
    const facts = resolveEditorialFacts(source);
    assert.ok(facts);
    assert.equal(facts.lateralReachM, null);
    assert.equal(facts.loadCapacityKg, null);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", source.reference ?? "");
    assert.equal(prepared.product.reference, source.reference);
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.notEqual(prepared.product.description_general, selected.fallbackGeneral);
    assert.match(prepared.product.description_general ?? "", /altura de trabajo de /u);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("las nuevas unidades compatibles reutilizan reglas técnicas pero no textos ni datos de unidades históricas", () => {
  for (const source of originals) {
    const next = anotherUnit(source);
    const snapshot = JSON.stringify([source, next]);
    const selected = resolveKnowledgeEditorial(next, next);
    assert.equal(selected.fallbackGeneral, null);
    assert.equal(selected.general, null);
    const composed = resolveReusableEditorial(next);
    assert.match(composed.general ?? "", /altura de trabajo de /u);
    assert.equal(resolveEditorialFacts(next)?.lateralReachM, null);
    assert.equal(resolveEditorialFacts(next)?.loadCapacityKg, null);
    const prepared = prepareSourceProduct(next).product;
    assert.equal(prepared.reference, next.reference);
    assert.equal(prepared.sourceUrl, next.url);
    assert.notEqual(prepared.description_general, resolveKnowledgeEditorial(source, source).fallbackGeneral);
    assert.doesNotMatch(prepared.description_general ?? "", /horas registradas|referencia comercial declarada por el vendedor/u);
    assert.equal(JSON.stringify([source, next]), snapshot);
  }
});

test("las cinco firmas de respaldo no atraviesan cambios de proveedor, URL, modelo, condición ni contenido", () => {
  for (const source of originals) {
    for (const invalid of [
      { ...source, providerId: "gomariz" },
      { ...source, url: `${source.url}?otra-unidad=1` },
      { ...source, reference: `${source.reference}-OTRA` },
      { ...source, model: `${source.model}-OTRO` },
      { ...source, condition: source.condition === "Nuevo" ? "Segunda mano" as const : "Nuevo" as const },
      { ...source, longDescription: `${source.longDescription ?? ""} Sin verificar.` },
      { ...source, specs: { ...source.specs, "Altura de trabajo": "99 m" } }
    ]) {
      const selected = resolveKnowledgeEditorial(invalid, invalid);
      assert.equal(selected.fallbackGeneral, null, `${source.reference}:${invalid.url}`);
      assert.equal(selected.general, null, `${source.reference}:${invalid.url}`);
    }
  }
});
