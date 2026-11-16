import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { editorialSourceDigest, loadEditorialKnowledge } from "../../../../infrastructure/filesystem/editorial/knowledge.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { normalizeEditorialGeneral } from "../domain/editorial-normalization.js";
import { selectUnitKnowledge } from "../domain/editorial-knowledge.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const original = (provider: "gam" | "gomariz" | "mercaeleva", reference: string): ProductRecord =>
  accreditedSourceRecord(`${provider}-original`, reference);

const identity = (record: ProductRecord) => ({
  key: `${record.providerId}:${record.reference ?? ""}`,
  sourceUrl: record.url,
  brand: record.brand ?? "",
  model: record.model ?? ""
});

test("las generales firmadas GAM sólo difieren por la presentación normalizada de kg", () => {
  for (const reference of ["6196", "6195", "6486", "6116", "6980"]) {
    const source = original("gam", reference);
    const snapshot = JSON.stringify(source);
    const signed = resolveKnowledgeEditorial(source);
    assert.ok(signed.general, reference);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", reference);
    assert.notEqual(prepared.product.description_general, signed.general, reference);
    assert.equal(prepared.product.description_general, normalizeEditorialGeneral(signed.general, source.model), reference);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("las alturas descartadas en respaldos firmados no se reintroducen por precedencia", () => {
  const source = original("gomariz", "TE1858");
  const signed = resolveKnowledgeEditorial(source);
  assert.equal(signed.general, null);
  assert.match(signed.fallbackGeneral ?? "", /14,30 m/u);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description_general ?? "", /altura de trabajo de 6,3 m/u);
  assert.match(prepared.product.description_general ?? "", /altura de plataforma de 4,3 m/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /14,30 m/u);
  assert.notEqual(prepared.product.description_general, signed.fallbackGeneral);
});

test("una general técnica respaldada conserva magnitudes de unidad sin trasladar la plantilla de familia", () => {
  const source = accreditedSourceRecord("gomariz-special-original", "MT1661");
  const snapshot = JSON.stringify(source);
  const signed = resolveKnowledgeEditorial(source);
  assert.ok(signed.fallbackGeneral);
  assert.equal(signed.general, null);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.notEqual(prepared.product.description_general, signed.fallbackGeneral);
  for (const value of ["13,8 m", "9,25 m", "4.000 kg", "11.090 kg", "2018"]) {
    assert.ok(prepared.product.description_general?.includes(value), value);
  }
  assert.doesNotMatch(prepared.product.description_general ?? "", /de 2\.500kg hasta 4\.000kg/u);
  assert.equal(JSON.stringify(source), snapshot);
});

test("el respaldo de modelo conserva la unidad, el horómetro y la atribución documental", () => {
  const source = original("mercaeleva", "M572-8190");
  const signed = resolveKnowledgeEditorial(source);
  assert.ok(signed.fallbackGeneral);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.notEqual(prepared.product.description_general, signed.fallbackGeneral);
  assert.match(prepared.product.description_general ?? "", /3\.018 horas registradas/u);
  assert.match(prepared.product.description_general ?? "", /año de fabricación 2017/u);
  assert.match(prepared.product.description_general ?? "", /Referencia comercial declarada por el vendedor: 774/u);
  assert.match(prepared.product.description_general ?? "", /no acreditan la configuración ni las prestaciones de esta unidad/u);
});

test("los respaldos únicos se aplican solamente a la unidad cuya fuente sigue acreditada", () => {
  for (const [provider, reference, required] of [
    ["gomariz", "OR1537", /motorización combinada eléctrica y de gasolina/u],
    ["mercaeleva", "M736-5615", /tolva con giro de hasta 180°/u]
  ] as const) {
    const source = original(provider, reference);
    const signed = resolveKnowledgeEditorial(source);
    assert.ok(signed.fallbackGeneral);
    assert.match(prepareSourceProduct(source).product.description_general ?? "", required);
    for (const changed of [
      { ...source, url: `${source.url}?unidad=otra` },
      { ...source, reference: `${reference}-OTRA` },
      { ...source, providerId: provider === "gomariz" ? "mercaeleva" : "gomariz" },
      { ...source, model: `${source.model ?? ""}-OTRA` },
      { ...source, specs: { ...source.specs, "Dato sin acreditar": "nuevo" } }
    ]) assert.equal(resolveKnowledgeEditorial(changed).fallbackGeneral, null);
  }
});

test("las generales firmadas coexistentes respetan la prioridad sin contaminar otras huellas", () => {
  const knowledge = loadEditorialKnowledge();
  for (const reference of ["M011-3720", "M940-4770"]) {
    const source = original("mercaeleva", reference);
    const digest = editorialSourceDigest(source);
    const eligible = (knowledge.units.get(`mercaeleva:${reference}`) ?? [])
      .filter((entry) => entry.sourceDigest === digest && entry.sourceUrl === source.url && entry.general && entry.usage !== "fallback");
    assert.ok(eligible.length > 1, reference);
    const selected = selectUnitKnowledge(identity(source), knowledge, digest);
    assert.equal(selected.general, eligible[0]?.general, reference);
    assert.equal(prepareSourceProduct(source).product.description_general, selected.general, reference);
    assert.equal(selectUnitKnowledge(identity(source), knowledge, `${digest.slice(0, -1)}${digest.endsWith("a") ? "b" : "a"}`).general, null);
    const otherProvider = { ...identity(source), key: `gomariz:${reference}` };
    assert.equal(selectUnitKnowledge(otherProvider, knowledge, digest).general, null);
    const otherVariant = { ...identity(source), model: `${source.model ?? ""}-OTRA` };
    assert.equal(selectUnitKnowledge(otherVariant, knowledge, digest).general, null);
  }
});
