import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { editorialSourceDigest, loadEditorialKnowledge } from "../../../../infrastructure/filesystem/editorial/knowledge.js";
import { selectUnitKnowledge } from "../domain/editorial-knowledge.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const get = (provider: string, reference: string): ProductRecord => {
  const catalog: { readonly products: readonly ProductRecord[] } = JSON.parse(readFileSync(
    `catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`, "utf8"));
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, `${provider}:${reference}`);
  return record;
};

test("consume la evidencia declarativa de las tres fuentes sin narradores específicos", () => {
  const knowledge = loadEditorialKnowledge();
  assert.ok(knowledge.units.size >= 300);
  assert.ok(knowledge.models.size >= 100);
  assert.ok(Object.keys(knowledge.families).length >= 26);
  for (const [provider, reference] of [["gam", "2102"], ["gomariz", "TE1618"], ["mercaeleva", "M208-7097"]]) {
    if (!provider || !reference) continue;
    const source = get(provider, reference);
    const editorial = resolveKnowledgeEditorial(source);
    assert.ok(editorial.general);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.product.description_general, editorial.general);
  }
});

test("la evidencia de una unidad exige referencia, URL, identidad y huella completas", () => {
  const source = get("gam", "2102");
  const knowledge = loadEditorialKnowledge();
  const initial = JSON.stringify(source);
  const identity = (record: ProductRecord) => ({
    key: `${record.providerId}:${record.reference ?? ""}`, sourceUrl: record.url,
    brand: record.brand ?? "", model: record.model ?? ""
  });
  const original = selectUnitKnowledge(identity(source), knowledge, editorialSourceDigest(source));
  assert.ok(original.general);
  for (const changed of [
    { ...source, reference: "2103" },
    { ...source, model: "OTRO" },
    { ...source, providerId: "gomariz" },
    { ...source, url: source.url.replace("/2102-", "/9999-") },
    { ...source, longDescription: `${source.longDescription ?? ""} Pendiente de comprobación.` },
    { ...source, specs: { ...source.specs, Peso: "5000 kg" } }
  ]) {
    const result = selectUnitKnowledge(identity(changed), knowledge, editorialSourceDigest(changed));
    assert.deepEqual(result, { short: null, general: null, title: null });
    assert.notEqual(prepareSourceProduct(changed).product.description_general, original.general);
  }
  assert.equal(JSON.stringify(source), initial);
});

test("una nueva unidad del mismo modelo recibe contexto, pero no hereda horas ni datos como propios", () => {
  const source = get("gomariz", "TE1591");
  const original = JSON.stringify(source);
  const next: ProductRecord = {
    ...source, reference: "TE199991", url: source.url.replace(/\/[^/]+\/$/u, "/lgmg-as0812-unidad-entrante/"),
    year: null, horometer: null, serialNumber: null,
    specs: Object.fromEntries(Object.entries(source.specs ?? {}).filter(([name]) => name !== "Altura plataforma"))
  };
  assert.ok(resolveEditorialFacts(next));
  const resolved = resolveKnowledgeEditorial(next);
  assert.match(resolved.modelReference ?? "", /otras fichas del catálogo del modelo LGMG AS0812/u);
  const prepared = prepareSourceProduct(next);
  assert.match(prepared.product.description_general ?? "", /datos no acreditan por sí solos la configuración de esta unidad/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /horas registradas/u);
  assert.equal(JSON.stringify(source), original);
});

test("un almacén vertical redacta capacidad por bandeja, sin fingir capacidad total", () => {
  const source = get("gam", "3434");
  const prepared = prepareSourceProduct(source);
  assert.equal(resolveEditorialFacts(source)?.family, "almacen-vertical");
  assert.match(prepared.product.description ?? "", /carga neta por bandeja de 350 kg/u);
  assert.match(prepared.product.description_general ?? "", /no equivale a la capacidad total/u);
});

test("la evidencia de fabricante distingue un elevador manual de una plataforma de personas", () => {
  const source = get("gomariz", "PV556");
  const record = prepareSourceProduct(source).product;
  assert.equal(resolveKnowledgeEditorial(source).familyOverride, "elevador-materiales");
  assert.match(record.description ?? "", /^Elevador de materiales Genie SLA15/u);
  assert.doesNotMatch(record.description ?? "", /plataforma eléctrica/u);
  assert.match(record.description_general ?? "", /elevador manual de material/u);
});

test("los títulos de unidad sólo se aplican cuando su huella de origen permanece intacta", () => {
  const source = get("gomariz", "BA1253");
  const knowledge = resolveKnowledgeEditorial(source);
  assert.ok(knowledge.title);
  assert.equal(prepareSourceProduct(source).product.title, knowledge.title);
  const changed = { ...source, title: `${source.title} edición nueva` };
  const changedTitle = resolveKnowledgeEditorial(changed);
  assert.equal(changedTitle.title, null);
  assert.notEqual(prepareSourceProduct(changed).product.title, knowledge.title);
});
