import assert from "node:assert/strict";
import test from "node:test";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import {
  isProductTechnicalProvenance, matchesTechnicalDocumentVerification, technicalDocumentClaimSha256
} from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentVerification } from "../../../technical/evidence/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const manufacturerDocument =
  "https://www.genielift.com/docs/default-source/product-specifications/articulated-boom-lift/en/z-3422ic_spec_2019.pdf";

test("fase 48: la longitud de plataforma Genie Z-34/22 queda acreditada por la ficha 2019", async () => {
  const originals = await readPortableOriginal(process.cwd(), "mercaeleva");
  const original = originals.products.find((item) => item.reference === "M690-5522");
  assert.ok(original);
  assert.equal(original.brand, "Genie");
  assert.equal(original.model, "Z-34/22");
  assert.equal(original.year, "2019");
  assert.ok(original.title?.includes("DIESEL"));
  const unchangedOriginal = JSON.stringify(original);
  const emitted = prepareSourceProduct(original).technicalProvenance;
  assert.ok(emitted);
  assert.ok(isProductTechnicalProvenance(emitted));
  assert.equal(emitted.originalRecordSha256, originalRecordFingerprint(original));
  assert.equal(JSON.stringify(original), unchangedOriginal);
  const field = "Longitud de plataforma";
  const value = "0,76 m";
  const entry = emitted.entries.find((item) => item.field === field);
  assert.ok(entry);
  assert.equal(entry.scope, "model-document");
  assert.ok(entry.scope === "model-document");
  assert.equal(entry.value, value);
  assert.equal(entry.document.url, manufacturerDocument);
  assert.equal(entry.document.brand, original.brand);
  assert.equal(entry.document.model, original.model);
  assert.ok(entry.verification);
  assert.deepEqual(entry.verification, reviewedModelDocumentVerification(entry.document, field, value));
  assert.ok(matchesTechnicalDocumentVerification(entry.document, field, value, entry.verification));
  assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, value), "reused");
  assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, "0,77 m"), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original, emitted, "Anchura de plataforma", "0,76 m"), "pending");
  assert.equal(classifyPublishedTechnicalSpec({ ...original, model: "Z-45/25J" }, emitted, field, value), "pending");
  assert.equal(classifyPublishedTechnicalSpec({ ...original, year: "2018" }, emitted, field, value), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original, { ...emitted, originalRecordSha256: "0".repeat(64) }, field, value),
    "pending");
  assert.equal(reviewedModelDocumentVerification({ ...entry.document, url: `${manufacturerDocument}?revision=otra` },
    field, value), null);
  assert.equal(reviewedModelDocumentVerification({ ...entry.document, model: "Z-34/22N" }, field, value), null);

  const alteredDocument = { ...entry.document, url: `${manufacturerDocument}?revision=otra` };
  const alteredVerification = {
    ...entry.verification,
    claimSha256: technicalDocumentClaimSha256(alteredDocument, field, value,
      entry.verification.reviewedOn, entry.verification.support)
  };
  const alteredEvidence = {
    ...emitted,
    entries: emitted.entries.map((candidate) => candidate.field === field ? {
      ...entry, document: alteredDocument, verification: alteredVerification
    } : candidate)
  };
  assert.ok(isProductTechnicalProvenance(alteredEvidence));
  assert.equal(classifyPublishedTechnicalSpec(original, alteredEvidence, field, value), "pending");

  const forgedSupport = "Afirmación sin cotejo documental externo";
  const forgedVerification = {
    ...entry.verification,
    support: forgedSupport,
    claimSha256: technicalDocumentClaimSha256(entry.document, field, value,
      entry.verification.reviewedOn, forgedSupport)
  };
  const forgedEvidence = {
    ...emitted,
    entries: emitted.entries.map((candidate) => candidate.field === field ? {
      ...entry, verification: forgedVerification
    } : candidate)
  };
  assert.ok(matchesTechnicalDocumentVerification(entry.document, field, value, forgedVerification));
  assert.ok(isProductTechnicalProvenance(forgedEvidence));
  assert.equal(classifyPublishedTechnicalSpec(original, forgedEvidence, field, value), "pending");
});

test("fase 53: anchura de cesta opcional no se acredita por documento de modelo", async () => {
  const originals = await readPortableOriginal(process.cwd(), "mercaeleva");
  const cases = [
    { reference: "M690-5522", field: "Anchura de plataforma", value: "1,42 m" }
  ] as const;
  for (const { reference, field, value } of cases) {
    const original = originals.products.find((item) => item.reference === reference);
    assert.ok(original);
    const emitted = prepareSourceProduct(original).technicalProvenance;
    assert.ok(emitted);
    assert.ok(!emitted.entries.some((entry) => entry.field === field && entry.value === value));
    assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, value), "pending", `${reference}: ${field}`);
  }
});
