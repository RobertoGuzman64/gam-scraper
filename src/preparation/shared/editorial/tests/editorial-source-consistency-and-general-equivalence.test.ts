import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { hasEditorialSourceWorkHeightConflict } from "../domain/editorial-height-consistency.js";
import { hasCorroboratedEditorialDistinctWorkHeights } from "../domain/editorial-source.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";
import { captureSourceEditorialEvidence } from "../mapping/source-editorial-evidence.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledGomarizPlatform,
  controlledMercaelevaForklift, controlledMercaelevaPlatform
} from "./editorial-contract-records.js";

const original = (provider: "gam" | "gomariz" | "mercaeleva", reference: string): ProductRecord =>
  accreditedSourceRecord(`${provider}-original`, reference);

const platforms = [controlledGomarizPlatform, controlledMercaelevaPlatform];
const forklifts = [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift];

const plainGeneral = "La máquina MARCA MODELO10 es una unidad con configuración específica que debe verificarse en la ficha original del vendedor antes de su utilización.";

const onlySourceGeneral = (record: ProductRecord, reference: string, general: string): ProductRecord => ({
  ...record,
  reference,
  url: record.url?.replace(record.reference ?? "", reference) ?? null,
  shortDescription: null,
  longDescription: general,
  specs: { Marca: "MARCA", Modelo: "MODELO10" }
});

test("detecta una contradicción de altura textual sin validar el anuncio de plataforma", () => {
  for (const make of platforms) {
    const source = make();
    const compatible = { ...source, longDescription: "La plataforma MARCA MODELO10 tiene altura de trabajo de 10 metros." };
    const contradictory = { ...source, longDescription: "La plataforma MARCA MODELO10 tiene altura de trabajo de 12 metros." };
    const snapshot = JSON.stringify(contradictory);
    assert.equal(hasEditorialSourceWorkHeightConflict(compatible), false, source.providerId);
    assert.equal(prepareSourceProduct(compatible).status, "ready", source.providerId);
    assert.equal(hasEditorialSourceWorkHeightConflict(contradictory), true, source.providerId);
    const prepared = prepareSourceProduct(contradictory);
    assert.equal(prepared.status, "review", source.providerId);
    assert.ok(prepared.issues.includes("Descripción comercial contradictoria: altura de trabajo"), source.providerId);
    assert.equal(JSON.stringify(contradictory), snapshot);
  }
});

test("rechaza cargas incompatibles en el resumen técnico de los tres proveedores", () => {
  for (const make of forklifts) {
    const source = make();
    const incompatible = { ...source, specs: { ...source.specs, "Capacidad de carga": "3200 kg" } };
    const snapshot = JSON.stringify(incompatible);
    assert.ok(resolveReusableEditorial(source).general, source.providerId);
    assert.equal(resolveReusableEditorial(incompatible).general, null, source.providerId);
    const prepared = prepareSourceProduct(incompatible);
    assert.equal(prepared.status, "review", source.providerId);
    assert.equal(prepared.product.description_general, null, source.providerId);
    assert.ok(prepared.issues.includes("Cobertura editorial insuficiente: descripción general"), source.providerId);
    assert.equal(JSON.stringify(incompatible), snapshot);
  }
});

test("distingue altura nominal y de trabajo de origen sin invalidar el conocimiento firmado", () => {
  const source = original("mercaeleva", "M486-0114");
  const signed = resolveKnowledgeEditorial(source, source);
  const snapshot = JSON.stringify(source);
  assert.ok(signed.general);
  assert.equal(hasEditorialSourceWorkHeightConflict(source), true);
  assert.equal(hasCorroboratedEditorialDistinctWorkHeights(source), true);
  assert.equal(hasEditorialSourceWorkHeightConflict(source, hasCorroboratedEditorialDistinctWorkHeights(source)), false);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(JSON.stringify(source), snapshot);
});

test("conserva sin cambios la descripción original GAM si no existe texto de mayor precedencia", () => {
  const source = original("gam", "6607");
  const snapshot = JSON.stringify(source);
  assert.ok(source.longDescription);
  assert.equal(resolveKnowledgeEditorial(source, source).general, null);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.description_general, source.longDescription);
  assert.equal(JSON.stringify(source), snapshot);
});

test("reutiliza la conservación del origen en unidades nuevas sin copiar generales ajenas", () => {
  for (const make of [controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaForklift]) {
    const first = onlySourceGeneral(make(), "CONTROL-74-A", plainGeneral);
    const secondGeneral = "La máquina MARCA MODELO10 pertenece a otra unidad, cuya configuración propia debe confirmarse antes de su utilización.";
    const second = onlySourceGeneral(make(), "CONTROL-74-B", secondGeneral);
    const snapshot = JSON.stringify([first, second]);
    assert.deepEqual(captureSourceEditorialEvidence(first), { identityVerified: true, sourceVerified: true });
    assert.equal(resolveReusableEditorial(first).general, null);
    assert.equal(resolveKnowledgeEditorial(first, first).general, null);
    const firstPrepared = prepareSourceProduct(first);
    const secondPrepared = prepareSourceProduct(second);
    assert.equal(firstPrepared.status, "ready", first.providerId);
    assert.equal(secondPrepared.status, "ready", first.providerId);
    assert.equal(firstPrepared.product.description_general, plainGeneral, first.providerId);
    assert.equal(secondPrepared.product.description_general, secondGeneral, first.providerId);
    assert.notEqual(firstPrepared.product.description_general, secondPrepared.product.description_general);
    assert.equal(JSON.stringify([first, second]), snapshot);
  }
});

test("no inventa una general ausente ni la hereda de otra unidad", () => {
  for (const make of [controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaForklift]) {
    const source = onlySourceGeneral(make(), "CONTROL-74-SIN", plainGeneral);
    const missing = { ...source, longDescription: null };
    const prepared = prepareSourceProduct(missing);
    assert.equal(prepared.status, "review", source.providerId);
    assert.equal(prepared.product.description_general, null, source.providerId);
    assert.ok(prepared.issues.includes("Cobertura editorial insuficiente: descripción general"), source.providerId);
  }
});
