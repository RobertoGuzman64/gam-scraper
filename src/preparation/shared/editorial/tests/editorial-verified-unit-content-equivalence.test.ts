import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";
import {
  controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaForklift
} from "./editorial-contract-records.js";

type Provider = "gam" | "gomariz" | "mercaeleva";

const original = (provider: Provider, reference: string): ProductRecord =>
  accreditedSourceRecord(`${provider}-original`, reference);

test("RE070 conserva textos de unidad GAM firmados y compuestos por campo", () => {
  for (const reference of ["6650", "6689"]) {
    const source = original("gam", reference);
    const snapshot = JSON.stringify(source);
    const knowledge = resolveKnowledgeEditorial(source, source);
    const prepared = prepareSourceProduct(source);
    assert.ok(knowledge.short, reference);
    assert.ok(knowledge.general, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.description, knowledge.short, reference);
    assert.equal(prepared.product.description_general, knowledge.general, reference);
    assert.notEqual(prepared.product.description, prepared.product.description_general);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE070 acepta la limpieza de una firma GAM sin convertirla en pérdida de procedencia", () => {
  const source = original("gam", "6196");
  const signed = resolveKnowledgeEditorial(source, source);
  const prepared = prepareSourceProduct(source);
  assert.ok(signed.general);
  assert.ok(prepared.product.description_general);
  assert.notEqual(prepared.product.description_general, signed.general);
  assert.match(signed.general, /8M/u);
  assert.match(prepared.product.description_general, /8 m/u);
  assert.match(prepared.product.description_general, /B200021461/u);
});

test("RE071 conserva el título, la general y la corta cuando Gomariz acredita cada campo", () => {
  for (const [reference, field] of [
    ["TE1618", "general"], ["BA1465", "short"], ["BA1253", "title"]
  ] as const) {
    const source = original("gomariz", reference);
    const snapshot = JSON.stringify(source);
    const knowledge = resolveKnowledgeEditorial(source, source);
    const prepared = prepareSourceProduct(source);
    const asserted = knowledge[field];
    assert.ok(asserted, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(field === "general" ? prepared.product.description_general :
      field === "short" ? prepared.product.description : prepared.product.title, asserted, reference);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE071 respeta que una general de reserva Gomariz ceda a hechos técnicos más sólidos", () => {
  const source = original("gomariz", "TE1772");
  const knowledge = resolveKnowledgeEditorial(source, source);
  const shared = resolveReusableEditorial(source);
  const prepared = prepareSourceProduct(source);
  assert.ok(knowledge.fallbackGeneral);
  assert.ok(shared.general);
  assert.equal(prepared.status, "ready");
  assert.ok(prepared.product.description_general?.startsWith(shared.general));
  assert.notEqual(prepared.product.description_general, knowledge.fallbackGeneral);
  assert.match(prepared.product.description_general ?? "", /7,8 m/u);
});

test("RE072 conserva cortas, generales y reserva validada por unidad Mercaeleva", () => {
  for (const [reference, field] of [
    ["M940-4770", "general"], ["M239-6301", "short"],
    ["M208-7097", "general"], ["M736-5615", "fallbackGeneral"]
  ] as const) {
    const source = original("mercaeleva", reference);
    const knowledge = resolveKnowledgeEditorial(source, source);
    const prepared = prepareSourceProduct(source);
    const asserted = knowledge[field];
    assert.ok(asserted, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(field === "short" ? prepared.product.description : prepared.product.description_general,
      asserted, reference);
  }
});

test("RE070-RE072 no reatribuyen evidencias firmadas al variar unidad, proveedor o fuente", () => {
  for (const [provider, reference] of [
    ["gam", "6689"], ["gomariz", "TE1618"], ["mercaeleva", "M940-4770"]
  ] as const) {
    const source = original(provider, reference);
    const signed = resolveKnowledgeEditorial(source, source);
    assert.ok(signed.short || signed.general || signed.title);
    for (const changed of [
      { ...source, reference: `${reference}-OTRA` },
      { ...source, providerId: `${provider}-otro` },
      { ...source, url: `${source.url}?cambio=1` },
      { ...source, model: `${source.model}-otra` },
      { ...source, year: "2039" },
      { ...source, specs: { ...source.specs, "Identidad no acreditada": "otra" } }
    ]) {
      const rejected = resolveKnowledgeEditorial(changed, changed);
      assert.equal(rejected.short, null, `${provider}:${reference}:short`);
      assert.equal(rejected.general, null, `${provider}:${reference}:general`);
      assert.equal(rejected.fallbackGeneral, null, `${provider}:${reference}:fallbackGeneral`);
      assert.equal(rejected.title, null, `${provider}:${reference}:title`);
    }
  }
});

test("RE070-RE072 reutilizan reglas en nuevas unidades sin copiar evidencias particulares", () => {
  for (const create of [controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaForklift]) {
    const source = create();
    const snapshot = JSON.stringify(source);
    const knowledge = resolveKnowledgeEditorial(source, source);
    const shared = resolveReusableEditorial(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(knowledge.short, null, source.providerId);
    assert.equal(knowledge.general, null, source.providerId);
    assert.equal(knowledge.fallbackGeneral, null, source.providerId);
    assert.equal(knowledge.title, null, source.providerId);
    assert.ok(shared.short, source.providerId);
    assert.ok(shared.general, source.providerId);
    assert.equal(prepared.status, "ready", source.providerId);
    assert.equal(prepared.product.description, shared.short, source.providerId);
    assert.ok(prepared.product.description_general?.startsWith(shared.general), source.providerId);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE070-RE072 no convierten una firma histórica en aprobación de contradicciones", () => {
  const gam = original("gam", "4737");
  const gamSigned = resolveKnowledgeEditorial(gam, gam);
  const gamPrepared = prepareSourceProduct(gam);
  assert.ok(gamSigned.general);
  assert.equal(gamPrepared.status, "review");
  assert.ok(gamPrepared.issues.some((issue) => issue.includes("Identidad GAM contradictoria")));
  assert.notEqual(gamPrepared.product.description_general, gamSigned.general);

  const mercaeleva = original("mercaeleva", "M486-0114");
  const mercaSigned = resolveKnowledgeEditorial(mercaeleva, mercaeleva);
  const mercaPrepared = prepareSourceProduct(mercaeleva);
  assert.ok(mercaSigned.general);
  assert.equal(mercaPrepared.status, "review");
  assert.ok(mercaPrepared.issues.some((issue) => issue.includes("altura de trabajo")));
});
