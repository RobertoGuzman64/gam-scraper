import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";
import { resolvePreparedEditorial } from "../mapping/prepared-editorial.js";
import { captureSourceEditorialEvidence } from "../mapping/source-editorial-evidence.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledGomarizPlatform,
  controlledMercaelevaForklift
} from "./editorial-contract-records.js";

const source = (provider: "gam" | "gomariz" | "mercaeleva", reference: string): ProductRecord =>
  accreditedSourceRecord(`${provider}-original`, reference);

const resolve = (record: ProductRecord) =>
  resolvePreparedEditorial(record, record, captureSourceEditorialEvidence(record));

test("los títulos firmados prevalecen sobre la composición de familia únicamente en su unidad", () => {
  for (const [provider, reference] of [["gam", "2364"], ["gomariz", "BA1253"], ["gomariz", "TE1618"]] as const) {
    const original = source(provider, reference);
    const fingerprint = JSON.stringify(original);
    const knowledge = resolveKnowledgeEditorial(original, original);
    assert.ok(knowledge.title, `${provider}:${reference}`);
    assert.equal(resolve(original).title, knowledge.title);
    const prepared = prepareSourceProduct(original).product;
    assert.equal(prepared.title, knowledge.title);
    assert.equal(prepared.description_title, prepared.title);
    for (const changed of [
      { ...original, reference: `${reference}-nuevo` },
      { ...original, url: `${original.url}?variante=nueva` },
      { ...original, title: `${original.title} nueva versión` },
      { ...original, specs: { ...original.specs, "Ficha original modificada": "sin confirmar" } }
    ]) assert.equal(resolveKnowledgeEditorial(changed, changed).title, null);
    assert.equal(JSON.stringify(original), fingerprint);
  }
});

test("los textos cortos y generales firmados prevalecen sin intercambiar campos", () => {
  for (const reference of ["5996", "6689"]) {
    const original = source("gam", reference);
    const knowledge = resolveKnowledgeEditorial(original, original);
    assert.ok(knowledge.short, reference);
    assert.ok(knowledge.general, reference);
    const mapped = resolve(original);
    assert.equal(mapped.preparedShort, knowledge.short, reference);
    assert.equal(mapped.preparedLong, knowledge.general, reference);
    const prepared = prepareSourceProduct(original).product;
    assert.equal(prepared.description, knowledge.short, reference);
    assert.equal(prepared.description_general, knowledge.general, reference);
    assert.notEqual(prepared.description, prepared.description_general);
    const altered = { ...original, specs: { ...original.specs, "Procedencia": "no acreditada" } };
    const rejected = resolveKnowledgeEditorial(altered, altered);
    assert.equal(rejected.short, null);
    assert.equal(rejected.general, null);
  }
});

test("una general histórica firmada convive con la corta construida desde hechos de la unidad", () => {
  for (const [provider, reference] of [
    ["gam", "1218"], ["gomariz", "TE1618"], ["mercaeleva", "M208-7097"]
  ] as const) {
    const original = source(provider, reference);
    const knowledge = resolveKnowledgeEditorial(original, original);
    const mapped = resolve(original);
    assert.ok(knowledge.general, `${provider}:${reference}`);
    assert.equal(knowledge.short, null);
    assert.equal(mapped.preparedLong, knowledge.general);
    assert.ok(mapped.preparedShort);
    assert.notEqual(mapped.preparedShort, knowledge.general);
    assert.equal(prepareSourceProduct(original).product.description_general, knowledge.general);
  }
});

test("las firmas solo prevalecen con huella original, incluso si la autenticidad de fuente ya no es suficiente", () => {
  const original = source("gam", "5996");
  const knowledge = resolveKnowledgeEditorial(original, original);
  const withoutVerification = resolvePreparedEditorial(original, original,
    { sourceVerified: false, identityVerified: false });
  assert.equal(withoutVerification.preparedShort, knowledge.short);
  assert.equal(withoutVerification.preparedLong, knowledge.general);
  const changedRecords: ProductRecord[] = [
    { ...original, condition: "Segunda mano" },
    { ...original, reference: "OTRA-UNIDAD" },
    { ...original, providerId: "gomariz" },
    { ...original, model: "MODELO-DIFERENTE" },
    { ...original, url: `${original.url}?revision=1` },
    { ...original, specs: { ...original.specs, Motor: "No acreditado" } }
  ];
  for (const changed of changedRecords) {
    const result = resolveKnowledgeEditorial(changed, changed);
    assert.equal(result.short, null);
    assert.equal(result.general, null);
    assert.equal(result.title, null);
    assert.equal(result.fallbackGeneral, null);
  }
});

test("las unidades nuevas compatibles reutilizan la composición, pero no reciben textos firmados históricos", () => {
  for (const record of [
    controlledGamForklift(), controlledGomarizForklift(),
    controlledGomarizPlatform(), controlledMercaelevaForklift()
  ]) {
    const original = JSON.stringify(record);
    const selected = resolveKnowledgeEditorial(record, record);
    assert.equal(selected.title, null);
    assert.equal(selected.short, null);
    assert.equal(selected.general, null);
    const shared = resolveReusableEditorial(record);
    const mapped = resolve(record);
    assert.ok(shared.short, record.providerId);
    assert.ok(shared.general, record.providerId);
    assert.equal(mapped.preparedShort, shared.short);
    assert.ok(mapped.preparedLong?.startsWith(shared.general));
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.description, shared.short);
    assert.equal(prepared.product.title, prepared.product.description_title);
    assert.equal(JSON.stringify(record), original);
  }
});

test("los originales firmados no trasvasan su título o general a otra unidad del mismo modelo", () => {
  const original = source("gomariz", "TE1618");
  const knowledge = resolveKnowledgeEditorial(original, original);
  const newUnit: ProductRecord = {
    ...original,
    reference: "TE1618-NUEVA",
    url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-s0812ii-brazo-articulado-10-mts-unidad-nueva/",
    year: null,
    horometer: null,
    serialNumber: null
  };
  assert.ok(knowledge.title);
  assert.ok(knowledge.general);
  const newer = resolveKnowledgeEditorial(newUnit, newUnit);
  assert.equal(newer.title, null);
  assert.equal(newer.general, null);
  const reused = resolveReusableEditorial(newUnit);
  assert.ok(reused.short);
  assert.equal(resolve(newUnit).preparedShort, reused.short);
  const prepared = prepareSourceProduct(newUnit).product;
  assert.notEqual(prepared.title, knowledge.title);
  assert.notEqual(prepared.description_general, knowledge.general);
});
