import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveDocumentedModelDimensions } from "../domain/editorial-model-dimensions.js";
import { isGamDocumentedYaleDimensionsSource } from "../../../gam/identity/evidence/model-dimensions-source.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const original = (reference: string): ProductRecord => accreditedSourceRecord("gam-editorial-historical", reference);

const another = (source: ProductRecord): ProductRecord => {
  const reference = `${source.reference}-OTRA`;
  return {
    ...source, reference, url: source.url.replace(`/${source.reference}-`, `/${reference}-`),
    shortDescription: null, longDescription: null, year: null,
    specs: { ...source.specs, Longitud: "3900 mm", Anchura: "1400 mm", Altura: "2500 mm", Peso: "5200 KG" }
  };
};

test("RE061 traslada dimensiones del modelo históricamente documentado al recorrido compartido", () => {
  for (const reference of ["2318", "2319", "2320", "2208", "2209", "2210"]) {
    const source = original(reference);
    const snapshot = JSON.stringify(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(isGamDocumentedYaleDimensionsSource(source), true, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.match(prepared.product.description_general ?? "", /declara .* m de longitud, .* m de anchura, .* m de altura del equipo y .* kg de peso/u);
    assert.match(prepared.product.description_general ?? "", new RegExp(source.model?.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") ?? "", "u"));
    assert.ok((prepared.product.description_general ?? "").includes(source.longDescription ?? ""));
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE061 usa exclusivamente las medidas de una entrada nueva compatible", () => {
  const source = original("2318");
  const candidate = another(source);
  const expected = /3,9 m de longitud, 1,4 m de anchura, 2,5 m de altura del equipo y 5\.200 kg de peso/u;
  const clause = resolveDocumentedModelDimensions(candidate, candidate, null);
  assert.match(clause ?? "", expected);
  const prepared = prepareSourceProduct(candidate);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description_general ?? "", expected);
  assert.doesNotMatch(prepared.product.description_general ?? "", /3,714 m|1,353 m|2,592 m|4\.292 kg/u);
  assert.equal(resolveKnowledgeEditorial(candidate, candidate).general, null);
  assert.equal(prepared.product.reference, candidate.reference);
});

test("RE061 no usa valores sin identidad, procedencia, unidades o dimensiones corroboradas", () => {
  const source = another(original("2318"));
  const invalid: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, url: "https://example.invalid/es/carretillas-elevadora-diesel-yale/2318-OTRA-gp25n6" },
    { ...source, url: `${source.url}?variante=otra` },
    { ...source, model: "GP2.0N" },
    { ...source, specs: { ...source.specs, Modelo: "GP3.0N" } },
    { ...source, brand: "HYSTER" },
    { ...source, title: "Plataforma articulada Yale GP2.5N6" },
    { ...source, specs: { ...source.specs, Longitud: "3900 kg" } },
    { ...source, specs: { ...source.specs, Altura: "2500" } },
    { ...source, specs: { ...source.specs, Peso: "5200 mm" } },
    { ...source, specs: { ...source.specs, Anchura: "1400 mm o 1500 mm" } },
    { ...source, condition: "Segunda mano" }
  ];
  for (const changed of invalid) {
    assert.equal(isGamDocumentedYaleDimensionsSource(changed) &&
      resolveDocumentedModelDimensions(changed, changed, null) !== null, false, JSON.stringify(changed));
    assert.doesNotMatch(prepareSourceProduct(changed).product.description_general ?? "", /3,9 m de longitud, 1,4 m de anchura/u);
  }
  assert.equal(resolveDocumentedModelDimensions(source, { ...source, reference: "UNIDAD-AJENA" }, null), null);
  assert.equal(resolveDocumentedModelDimensions(source, { ...source, specs: { ...source.specs, Altura: "2600 mm" } }, null), null);
});

test("RE061 no desplaza descripciones firmadas ni duplica dimensiones ya presentes", () => {
  const historical = original("2316");
  const prepared = prepareSourceProduct(historical);
  assert.ok(resolveKnowledgeEditorial(historical, historical).general);
  assert.doesNotMatch(prepared.product.description_general ?? "", /^La ficha técnica de carretilla elevadora YALE GP2\.0N declara /u);
  const already = another(original("2318"));
  assert.equal(resolveDocumentedModelDimensions(already, already,
    "La longitud de la unidad es de 3.900 mm y su anchura de 1.400 mm."), null);
});
