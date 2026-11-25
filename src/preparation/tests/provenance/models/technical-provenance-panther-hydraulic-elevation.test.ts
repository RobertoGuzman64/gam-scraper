import assert from "node:assert/strict";
import { test } from "node:test";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import { matchesTechnicalDocumentVerification, technicalDocumentClaimSha256 } from "../../../../contracts/technical-provenance.js";
import type { TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentVerification } from "../../../technical/evidence/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const field = "Elevación";
const value = "Hidráulica manual";
const url = "https://logitrans.com/panther-manual-pallet-truck/";

const originalWithEvidence = async () => {
  const { products } = await readPortableOriginal(process.cwd(), "gam");
  const original = products.find((candidate) => candidate.reference === "237");
  assert.ok(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  const evidence = trace.entries.find((candidate) => candidate.field === field);
  assert.ok(evidence && evidence.scope === "model-document" && evidence.verification);
  return { original, trace, evidence };
};

test("la elevación hidráulica del Panther Flex requiere documentación del conjunto de bomba y ficha de modelo", async () => {
  const { original, trace, evidence } = await originalWithEvidence();
  assert.equal(original.brand, "LOGITRANS");
  assert.equal(original.model, "Panther Flex");
  assert.equal(trace.originalRecordSha256, originalRecordFingerprint(original));
  assert.equal(evidence.value, value);
  assert.deepEqual(evidence.document, { url, brand: original.brand, model: original.model });
  assert.deepEqual(evidence.verification, reviewedModelDocumentVerification(evidence.document, field, value));
  assert.ok(matchesTechnicalDocumentVerification(evidence.document, field, value, evidence.verification));
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, value), "reused");
  for (const otherField of ["Propulsión", "Descenso de carga"]) {
    const other = trace.entries.find((candidate) => candidate.field === otherField);
    assert.ok(other && other.scope === "model-document" && other.verification);
    assert.equal(classifyPublishedTechnicalSpec(original, trace, otherField, other.value), "reused");
  }
});

test("identidad, fingerprint, documento o prueba alterados no acreditan la elevación", async () => {
  const { original, trace, evidence } = await originalWithEvidence();
  const replace = (changed: TechnicalSpecEvidence) => ({ ...trace,
    entries: trace.entries.map((candidate) => candidate.field === field ? changed : candidate)
  });
  for (const changed of [
    { ...original, reference: "238" },
    { ...original, model: "Panther" },
    { ...original, title: `${original.title} alterado` }
  ]) {
    assert.equal(classifyPublishedTechnicalSpec(changed, trace, field, value), "pending");
  }
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, "Hidráulica eléctrica"), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original,
    { ...trace, originalRecordSha256: "0".repeat(64) }, field, value), "pending");
  for (const document of [
    { ...evidence.document, url: `${url}?variante=inox` },
    { ...evidence.document, model: "Panther 2572" },
    { ...evidence.document, brand: "LOGITRANS OTRO" }
  ]) {
    assert.equal(reviewedModelDocumentVerification(document, field, value), null);
    assert.equal(classifyPublishedTechnicalSpec(original, replace({ ...evidence, document }), field, value), "pending");
  }
  const { verification, ...withoutVerification } = evidence;
  assert.ok(verification);
  assert.equal(classifyPublishedTechnicalSpec(original, replace(withoutVerification), field, value), "pending");
  const support = "afirmación falsificada";
  const forged = { ...verification, support,
    claimSha256: technicalDocumentClaimSha256(evidence.document, field, value, verification.reviewedOn, support) };
  assert.ok(matchesTechnicalDocumentVerification(evidence.document, field, value, forged));
  assert.equal(classifyPublishedTechnicalSpec(original,
    replace({ ...evidence, verification: forged }), field, value), "pending");
});
