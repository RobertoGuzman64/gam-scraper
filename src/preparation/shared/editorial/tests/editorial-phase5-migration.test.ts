import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { editorialSourceDigest, loadEditorialKnowledge } from "../../../../infrastructure/filesystem/editorial/knowledge.js";
import { selectUnitKnowledge } from "../domain/editorial-knowledge.js";
import { resolveDocumentedEditorialTitle } from "../domain/editorial-documented-title.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const original = (provider: string, reference: string): ProductRecord => {
  const data: { readonly products: readonly ProductRecord[] } = JSON.parse(readFileSync(
    `catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`, "utf8"));
  const record = data.products.find((entry) => entry.reference === reference);
  assert.ok(record, `${provider}:${reference}`);
  return record;
};

test("textos firmados de unidades sin identidad completa, sin contagio", () => {
  for (const [provider, reference, field] of [
    ["gam", "6971", "general"],
    ["gam", "6193", "general"],
    ["gam", "6688", "short"],
    ["mercaeleva", "M294-4678", "general"]
  ] as const) {
    const source = original(provider, reference);
    assert.ok(!source.brand || !source.model);
    const knowledge = resolveKnowledgeEditorial(source, source);
    assert.ok(knowledge.identityOverride);
    assert.ok(knowledge[field], `${provider}:${reference}`);
    const prepared = prepareSourceProduct(source).product;
    assert.equal(field === "short" ? prepared.description : prepared.description_general, knowledge[field]);
    for (const changed of [
      { ...source, reference: `${reference}-otra` },
      { ...source, url: `${source.url}?revision=otra` },
      { ...source, specs: { ...source.specs, "Dato nuevo": "sin acreditar" } }
    ]) assert.equal(resolveKnowledgeEditorial(changed, changed)[field], null);
  }
});

test("firma de fuente íntegra para título y descripción de unidad", () => {
  const source = original("gam", "6193");
  const knowledge = loadEditorialKnowledge();
  const identity = { key: `gam:${source.reference}`, sourceUrl: source.url, brand: source.brand ?? "", model: source.model ?? "" };
  assert.ok(selectUnitKnowledge(identity, knowledge, editorialSourceDigest(source)).general);
  assert.equal(selectUnitKnowledge(identity, knowledge, editorialSourceDigest({ ...source, year: "2020" })).general, null);
});

test("títulos documentados por familia, magnitudes y fuente sin referencias cableadas", () => {
  const verified = [
    ["M855-6850", /Carretilla todoterreno 4x4 Ausa C250HX4 de 2\.500 kg/u],
    ["M736-5615", /Dúmper giratorio Ausa D450AHG de 4\.500 kg/u],
    ["M840-8278", /Plataforma de tijera eléctrica JLG 1930ES de 8 m/u],
    ["M200-9533", /Manipulador telescópico JLG 4014PS de 14 m/u]
  ] as const;
  for (const [reference, pattern] of verified) {
    const source = original("mercaeleva", reference);
    assert.match(resolveDocumentedEditorialTitle(source) ?? "", pattern);
    assert.match(prepareSourceProduct(source).product.title ?? "", pattern);
    assert.equal(resolveDocumentedEditorialTitle({ ...source, url: "https://example.com/otra" }), null);
    assert.equal(resolveDocumentedEditorialTitle({ ...source, specs: { ...source.specs, Estado: "Nuevo" } }), null);
  }
  assert.equal(resolveDocumentedEditorialTitle(original("mercaeleva", "M582-1882")), null);
  assert.equal(resolveDocumentedEditorialTitle(original("mercaeleva", "M028-8481")), null);
  const forklift = original("mercaeleva", "M855-6850");
  assert.equal(resolveDocumentedEditorialTitle({ ...forklift, specs: { ...forklift.specs,
    "Capacidad máxima de elevación": "3000 kg" } }), null);
});

test("generales y títulos firmados migrados desde tablas antiguas", () => {
  for (const reference of ["1218", "1219", "2180", "4792", "6909"]) {
    const source = original("gam", reference);
    const editorial = resolveKnowledgeEditorial(source, source);
    assert.ok(editorial.general, reference);
    assert.equal(prepareSourceProduct(source).product.description_general, editorial.general, reference);
    const modified = { ...source, shortDescription: "Cambiado" };
    assert.equal(resolveKnowledgeEditorial(modified, modified).general, null);
  }
  for (const reference of ["2364", "6805", "6971", "6987"]) {
    const source = original("gam", reference);
    const editorial = resolveKnowledgeEditorial(source, source);
    assert.ok(editorial.title, reference);
    assert.equal(prepareSourceProduct(source).product.title, editorial.title, reference);
    const modified = { ...source, url: `${source.url}?revision=1` };
    assert.equal(resolveKnowledgeEditorial(modified, modified).title, null);
  }
});
