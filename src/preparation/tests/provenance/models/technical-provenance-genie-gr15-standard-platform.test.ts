import assert from "node:assert/strict";
import test from "node:test";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification, technicalDocumentClaimSha256 } from "../../../../contracts/technical-provenance.js";
import type { TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentVerification } from "../../../technical/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const manual = "https://manuals.genielift.com/operators/Spanish/133102SP.pdf";
const earlierManual = "https://manuals.genielift.com/operators/german/97752GR.pdf";
const field = "Capacidad nominal de la plataforma estándar";
const value = "227 kg";

test("fase 49: GR-15 acredita únicamente 227 kg para la plataforma estándar del modelo", async () => {
  const originals = await readPortableOriginal(process.cwd(), "mercaeleva");
  const original = originals.products.find((item) => item.reference === "M028-8481");
  assert.ok(original);
  assert.equal(original.brand, "Genie");
  assert.equal(original.model, "GR-15");
  assert.equal(original.year, "2017");
  const snapshot = JSON.stringify(original);
  const prepared = prepareSourceProduct(original);
  const emitted = prepared.technicalProvenance;
  assert.ok(emitted);
  assert.ok(isProductTechnicalProvenance(emitted));
  assert.equal(prepared.product.spec[field], value);
  assert.equal(emitted.originalRecordSha256, originalRecordFingerprint(original));
  assert.equal(JSON.stringify(original), snapshot);

  const capacity = emitted.entries.find((item) => item.field === field);
  assert.ok(capacity && capacity.scope === "model-document");
  assert.equal(capacity.value, value);
  assert.deepEqual(capacity.document, { url: manual, brand: "Genie", model: "GR-15" });
  assert.ok(capacity.verification);
  assert.deepEqual(capacity.verification, reviewedModelDocumentVerification(capacity.document, field, value));
  assert.ok(matchesTechnicalDocumentVerification(capacity.document, field, value, capacity.verification));
  assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, value), "reused");

  for (const [otherField, otherValue] of [
    ["Altura de plataforma", "4,62 m"],
    ["Anchura de la máquina", "0,75 m"],
    ["Longitud replegada", "1,35 m"]
  ] as const) {
    const entry: TechnicalSpecEvidence | undefined = emitted.entries.find((item) => item.field === otherField);
    assert.ok(entry && entry.scope === "model-document");
    assert.equal(entry.value, otherValue);
    assert.equal(entry.document.url, earlierManual);
    assert.equal(classifyPublishedTechnicalSpec(original, emitted, otherField, otherValue), "reused");
  }

  assert.equal(reviewedModelDocumentVerification(capacity.document, field, "159 kg"), null);
  assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, "159 kg"), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original, emitted, "Capacidad de plataforma AWP", value), "pending");
  assert.equal(classifyPublishedTechnicalSpec({ ...original, model: "GR-20" }, emitted, field, value), "pending");
  assert.equal(classifyPublishedTechnicalSpec({ ...original, year: "2016" }, emitted, field, value), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original, { ...emitted,
    originalRecordSha256: "0".repeat(64) }, field, value), "pending");

  const alteredDocument = { ...capacity.document, url: `${manual}?edicion=otra` };
  const forgedDocumentVerification = { ...capacity.verification, claimSha256: technicalDocumentClaimSha256(
    alteredDocument, field, value, capacity.verification.reviewedOn, capacity.verification.support) };
  const documentChanged = { ...emitted, entries: emitted.entries.map((entry) => entry.field === field
    ? { ...capacity, document: alteredDocument, verification: forgedDocumentVerification } : entry) };
  assert.ok(isProductTechnicalProvenance(documentChanged));
  assert.equal(classifyPublishedTechnicalSpec(original, documentChanged, field, value), "pending");

  const unsupportedClaim = "Dato no contrastado para esa plataforma";
  const forgedFactVerification = { ...capacity.verification, support: unsupportedClaim,
    claimSha256: technicalDocumentClaimSha256(capacity.document, field, value,
      capacity.verification.reviewedOn, unsupportedClaim) };
  const factChanged = { ...emitted, entries: emitted.entries.map((entry) => entry.field === field
    ? { ...capacity, verification: forgedFactVerification } : entry) };
  assert.ok(isProductTechnicalProvenance(factChanged));
  assert.equal(classifyPublishedTechnicalSpec(original, factChanged, field, value), "pending");
});
