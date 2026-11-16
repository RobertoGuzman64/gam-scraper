import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const byReference = (reference: string): ProductRecord => accreditedSourceRecord("mercaeleva-original", reference);
const documentation = /La documentación técnica de referencia del modelo Haulotte STAR-10 recoge altura de trabajo de 10 m, altura de plataforma de 8 m, capacidad nominal de 200 kg, 3 m de alcance horizontal con plumín y diseño sin voladizo trasero según la documentación del fabricante\./u;
const condition = /Las magnitudes corresponden al modelo o versión documentada y no acreditan la configuración ni las prestaciones de esta unidad\./u;

const newCompatibleSource = (): ProductRecord => {
  const original = byReference("M095-5362");
  return {
    ...original,
    reference: "M999-5362",
    url: original.url.replace("M095-5362", "M999-5362"),
    year: null,
    horometer: null,
    longDescription: "PLATAFORMA VERTICAL AUTOPROPULSADA ALTURA DE TRABAJO 10 MT HAULOTTE STAR-10",
    specs: {
      Marca: "Haulotte",
      Modelo: "STAR-10",
      "Título adicional": "PLATAFORMA VERTICAL AUTOPROPULSADA 10 MT",
      "Tipo de motor": "Eléctrico",
      "Altura de trabajo": "10 m"
    }
  };
};

test("el conocimiento de fabricante del mástil STAR-10 se recupera para sus tres unidades históricas sin afirmar equipamiento de cada una", () => {
  for (const reference of ["M095-5362", "M171-6370", "M144-5512"]) {
    const source = byReference(reference);
    const snapshot = JSON.stringify(source);
    const signed = resolveKnowledgeEditorial(source, source);
    assert.ok(signed.fallbackGeneral);
    assert.match(signed.fallbackGeneral, /plumín/u);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", reference);
    assert.match(prepared.product.description_general ?? "", documentation, reference);
    assert.match(prepared.product.description_general ?? "", condition, reference);
    assert.doesNotMatch(prepared.product.description ?? "", /alcance horizontal de 3 m|capacidad de 200 kg/u);
    assert.equal(prepared.product.spec["Alcance lateral"], undefined);
    assert.equal(prepared.product.spec.Capacidad, undefined);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("otra unidad compatible reutiliza solo la documentación técnica del modelo y no las evidencias firmadas ni horas de originales", () => {
  const source = newCompatibleSource();
  const snapshot = JSON.stringify(source);
  const knowledge = resolveKnowledgeEditorial(source, source);
  assert.equal(knowledge.fallbackGeneral, null);
  assert.equal(knowledge.general, null);
  assert.match(knowledge.modelReference ?? "", documentation);
  const prepared = prepareSourceProduct(source);
  assert.match(prepared.product.description_general ?? "", documentation);
  assert.match(prepared.product.description_general ?? "", condition);
  assert.doesNotMatch(prepared.product.description_general ?? "", /617 horas|1\.126 horas|377 horas|referencia comercial declarada por el vendedor:\s*(?:740|454|448)/iu);
  assert.equal(prepared.product.spec["Alcance lateral"], undefined);
  assert.equal(prepared.product.spec.Capacidad, undefined);
  assert.equal(JSON.stringify(source), snapshot);
});

test("la referencia no se transfiere a modelos, familias, energías o alturas incompatibles", () => {
  const source = newCompatibleSource();
  const incompatible: readonly ProductRecord[] = [
    { ...source, model: "STAR-8", title: "Haulotte STAR-8 PLATAFORMA VERTICAL AUTOPROPULSADA 10 MT", specs: { ...source.specs, Modelo: "STAR-8" } },
    { ...source, title: "Haulotte STAR-10 PLATAFORMA DE TIJERA ELÉCTRICA 10 MT" },
    { ...source, specs: { ...source.specs, "Tipo de motor": "Diésel" } },
    { ...source, specs: { ...source.specs, "Altura de trabajo": "12 m" } },
    { ...source, specs: { ...source.specs, "Altura plataforma": "7 m" } },
    { ...source, specs: { ...source.specs, "Capacidad": "230 kg" } },
    { ...source, url: "https://example.invalid/maquina" }
  ];
  for (const record of incompatible) {
    const knowledge = resolveKnowledgeEditorial(record, record);
    assert.doesNotMatch(knowledge.modelReference ?? "", documentation);
    const output = prepareSourceProduct(record);
    assert.doesNotMatch(output.product.description_general ?? "", documentation);
  }
});
