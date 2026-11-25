import assert from "node:assert/strict";
import { test } from "node:test";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import { matchesTechnicalDocumentVerification, technicalDocumentClaimSha256 } from "../../../../contracts/technical-provenance.js";
import type { TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentVerification } from "../../../technical/evidence/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const reference = "M579-8838";
const field = "Alcance horizontal (m)";
const value = "9,25 m";
const url = "https://manuals.genielift.com/operators/english/133540.pdf";
const previousUrl = "https://manuals.genielift.com/operators/english/219413.pdf";

const originalWithEvidence = async () => {
  const { products } = await readPortableOriginal(process.cwd(), "mercaeleva");
  const original = products.find((candidate) => candidate.reference === reference);
  assert.ok(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  const evidence = trace.entries.find((candidate) => candidate.field === field);
  assert.ok(evidence && evidence.scope === "model-document" && evidence.verification);
  return { original, trace, evidence };
};

test("la edición de Genie anterior a 2014 acredita únicamente el alcance de la Z-51/30J original", async () => {
  const { original, trace, evidence } = await originalWithEvidence();
  assert.equal(original.brand, "Genie");
  assert.equal(original.model, "Z-51/30J");
  assert.equal(original.year, "2013");
  assert.equal(trace.originalRecordSha256, originalRecordFingerprint(original));
  assert.equal(evidence.value, value);
  assert.deepEqual(evidence.document, { url, brand: original.brand, model: original.model });
  assert.deepEqual(evidence.verification, reviewedModelDocumentVerification(evidence.document, field, value));
  assert.ok(matchesTechnicalDocumentVerification(evidence.document, field, value, evidence.verification));
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, value), "reused");
  const unaffected = ["Altura de plataforma", "Capacidad máxima de plataforma", "Anchura (mm)"];
  for (const otherField of unaffected) {
    const other = trace.entries.find((candidate) => candidate.field === otherField);
    assert.ok(other && other.scope === "model-document" && other.verification);
    assert.equal(other.document.url, previousUrl);
    assert.equal(classifyPublishedTechnicalSpec(original, trace, otherField, other.value), "reused");
  }
  assert.equal(reviewedModelDocumentVerification({ ...evidence.document, url: previousUrl }, field, value), null);
});

test("la edición, identidad, valor y prueba manipulados no producen una acreditación", async () => {
  const { original, trace, evidence } = await originalWithEvidence();
  const replace = (changed: TechnicalSpecEvidence) => ({ ...trace,
    entries: trace.entries.map((candidate) => candidate.field === field ? changed : candidate)
  });
  for (const changed of [
    { ...original, reference: "M579-8839" },
    { ...original, model: "Z-51/30" },
    { ...original, year: "2023" },
    { ...original, title: `${original.title} alterado` }
  ]) {
    assert.equal(classifyPublishedTechnicalSpec(changed, trace, field, value), "pending");
  }
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, "9,37 m"), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original,
    { ...trace, originalRecordSha256: "0".repeat(64) }, field, value), "pending");
  for (const document of [
    { ...evidence.document, url: previousUrl },
    { ...evidence.document, url: `${url}?edicion=otra` },
    { ...evidence.document, model: "Z-45/25J" },
    { ...evidence.document, brand: "Marca distinta" }
  ]) {
    assert.equal(classifyPublishedTechnicalSpec(original, replace({ ...evidence, document }), field, value), "pending");
  }
  const { verification, ...withoutVerification } = evidence;
  assert.ok(verification);
  assert.equal(classifyPublishedTechnicalSpec(original, replace(withoutVerification), field, value), "pending");
  const support = "afirmación sin revisión";
  const forged = { ...verification, support,
    claimSha256: technicalDocumentClaimSha256(evidence.document, field, value, verification.reviewedOn, support) };
  assert.equal(classifyPublishedTechnicalSpec(original,
    replace({ ...evidence, verification: forged }), field, value), "pending");
});
