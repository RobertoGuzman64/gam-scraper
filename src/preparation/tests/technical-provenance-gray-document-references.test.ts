import assert from "node:assert/strict";
import { test } from "node:test";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification, technicalDocumentClaimSha256 } from "../../contracts/technical-provenance.js";
import type { TechnicalDocumentVerification, TechnicalSpecEvidence } from "../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { classifyPublishedTechnicalSpec } from "../technical-spec-classification.js";
import { reviewedModelDocumentVerification } from "../shared/technical/evidence/reviewed-model-claims.js";

const cases = [
  { reference: "171", model: "T16", fields: [
    "Anchura de la boquilla de aspiración", "Depósito de agua limpia estándar", "Depósito de recuperación"
  ] },
  { reference: "2737", model: "6K 36V BR", fields: [
    "Cargador a bordo del modelo", "Frenado en posición neutra del modelo",
    "Reducción de transmisión del modelo", "Velocidad de avance y retroceso del modelo"
  ] },
  { reference: "6689", model: "6 CABRIO 80 2", fields: [
    "Cilindrada del motor", "Par motor máximo", "Potencia máxima del motor", "Tipo de tracción"
  ] }
] as const;

test("fase 35: once afirmaciones exactas se acreditan en documentos de modelos sin marca de origen", async () => {
  const originals = await readPortableOriginal(process.cwd(), "gam");
  let count = 0;
  for (const item of cases) {
    const original = originals.products.find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    assert.equal(original.brand, null);
    assert.equal(original.model, item.model);
    const prepared = prepareSourceProduct(original);
    assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
    for (const field of item.fields) {
      const entry: TechnicalSpecEvidence | undefined = prepared.technicalProvenance.entries.find((candidate) => candidate.field === field);
      assert.ok(entry);
      assert.equal(entry.scope, "document-reference");
      if (entry.scope !== "document-reference") continue;
      assert.ok(entry.verification);
      assert.equal(entry.document.brand, null);
      assert.equal(entry.document.model, item.model);
      assert.equal(entry.value, prepared.product.spec[field]);
      assert.equal(entry.document.url === original.url, false);
      assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
      assert.deepEqual(reviewedModelDocumentVerification(entry.document, entry.field, entry.value), entry.verification);
      assert.equal(classifyPublishedTechnicalSpec(original, prepared.technicalProvenance, field, entry.value), "reused");
      count++;
    }
  }
  assert.equal(count, 11);
});

test("fase 35: huellas, identidades, URLs, valores y acreditaciones falsificadas no heredan el azul", async () => {
  const originals = await readPortableOriginal(process.cwd(), "gam");
  for (const item of cases) {
    const original = originals.products.find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    const entry = trace.entries.find((candidate) => candidate.field === item.fields[0]);
    assert.ok(entry && entry.scope === "document-reference" && entry.verification);
    const field = entry.field;
    const value = entry.value;
    const replace = (changed: TechnicalSpecEvidence) => ({ ...trace,
      entries: trace.entries.map((candidate) => candidate.field === field ? changed : candidate)
    });
    assert.equal(classifyPublishedTechnicalSpec({ ...original, title: `${original.title} modificado` }, trace, field, value), "pending");
    assert.equal(classifyPublishedTechnicalSpec({ ...original, model: "OTRO MODELO" }, trace, field, value), "pending");
    assert.equal(classifyPublishedTechnicalSpec(original, trace, field, `${value} otro`), "pending");
    assert.equal(classifyPublishedTechnicalSpec(original,
      replace({ ...entry, document: { ...entry.document, url: "https://ejemplo-invalido.test/modelo" } }), field, value), "pending");
    assert.equal(classifyPublishedTechnicalSpec(original,
      replace({ ...entry, document: { ...entry.document, brand: "MARCA INVENTADA" } }), field, value), "pending");
    const { verification: discarded, ...unverified } = entry;
    assert.ok(discarded);
    assert.equal(classifyPublishedTechnicalSpec(original,
      replace(unverified), field, value), "pending");
    const forgedSupport = "afirmación no revisada con hash recalculado";
    const forgery: TechnicalDocumentVerification = { ...entry.verification, support: forgedSupport,
      claimSha256: technicalDocumentClaimSha256(entry.document, field, value, entry.verification.reviewedOn, forgedSupport) };
    assert.ok(matchesTechnicalDocumentVerification(entry.document, field, value, forgery));
    assert.equal(classifyPublishedTechnicalSpec(original,
      replace({ ...entry, verification: forgery }), field, value), "pending");
  }
});

test("fase 35: otras referencias sin fuente revisada siguen pendientes", async () => {
  const originals = await readPortableOriginal(process.cwd(), "gam");
  for (const [reference, field] of [
    ["6993", "JLG E300AJP · Capacidad de cesta"],
    ["6806", "Tipo de motor anunciado"]
  ] as const) {
    const original = originals.products.find((candidate) => candidate.reference === reference);
    assert.ok(original);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    const entry = trace.entries.find((candidate) => candidate.field === field);
    assert.ok(entry);
    assert.equal(entry.scope, "document-reference");
    if (entry.scope !== "document-reference") continue;
    assert.equal(entry.verification, undefined);
    assert.equal(classifyPublishedTechnicalSpec(original, trace, field, entry.value), "pending");
  }
});
