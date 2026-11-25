import assert from "node:assert/strict";
import { test } from "node:test";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import { matchesTechnicalDocumentVerification, technicalDocumentClaimSha256 } from "../../../../contracts/technical-provenance.js";
import type { TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentVerification } from "../../../technical/evidence/reviewed-model-claims.js";
import { reviewedUnitDescriptionEvidence } from "../../../technical/evidence/reviewed-unit-description-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const reference = "4814";
const field = "Tipo de motor";
const value = "Diésel";
const url = "https://vertikal.net/en/pdf/78085/1beac504/ca_2025_8_p24-39.pdf";

const originalAndTrace = async () => {
  const originals = await readPortableOriginal(process.cwd(), "gam");
  const original = originals.products.find((candidate) => candidate.reference === reference);
  assert.ok(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  const entry = trace.entries.find((candidate) => candidate.field === field);
  assert.ok(entry && entry.scope === "model-document" && entry.verification);
  return { original, trace, entry };
};

test("el motor acredita el diésel del XT3207KH con dos fuentes técnicas identificadas", async () => {
  const { original, trace, entry } = await originalAndTrace();
  assert.equal(original.brand, "XCMG");
  assert.equal(original.model, "XT3207KH");
  assert.equal(trace.originalRecordSha256, originalRecordFingerprint(original));
  assert.equal(entry.value, value);
  assert.deepEqual(entry.document, { url, brand: "XCMG", model: "XT3207KH" });
  assert.ok(entry.verification);
  assert.ok(entry.verification.support.includes("XT3207KH | Engine model: Deutz TCD 3.6"));
  assert.ok(entry.verification.support.includes("https://www.deutz.com/americas/en/products/power-packs/tcd-36-l4/"));
  assert.deepEqual(entry.verification, reviewedModelDocumentVerification(entry.document, field, value));
  assert.ok(matchesTechnicalDocumentVerification(entry.document, field, value, entry.verification));
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, value), "reused");
  const traction = trace.entries.find((candidate) => candidate.field === "Tracción");
  assert.ok(traction);
  assert.equal(traction.value, "4×4");
  assert.equal(traction.scope, "unit");
  assert.equal(classifyPublishedTechnicalSpec(original, trace, traction.field, traction.value), "own");
});

test("ficha, modelo, documento, valor y afirmaciones alterados no acreditan el motor", async () => {
  const { original, trace, entry } = await originalAndTrace();
  assert.ok(entry.verification);
  const replace = (replacement: TechnicalSpecEvidence) => ({ ...trace,
    entries: trace.entries.map((candidate) => candidate.field === field ? replacement : candidate)
  });
  for (const tampered of [
    { ...original, title: `${original.title} cambiado` },
    { ...original, reference: "4817" },
    { ...original, model: "XT3207K" },
    { ...original, brand: "OTRA MARCA" }
  ]) {
    assert.equal(classifyPublishedTechnicalSpec(tampered, trace, field, value), "pending");
  }
  assert.equal(classifyPublishedTechnicalSpec(original, { ...trace,
    originalRecordSha256: "0".repeat(64) }, field, value), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, "Gasolina"), "pending");
  for (const document of [
    { ...entry.document, url: "https://xcmguk.com/product/xt3207kh/" },
    { ...entry.document, model: "XT3207K" },
    { ...entry.document, brand: "OTRA MARCA" }
  ]) {
    assert.equal(reviewedModelDocumentVerification(document, field, value), null);
    assert.equal(classifyPublishedTechnicalSpec(original,
      replace({ ...entry, document }), field, value), "pending");
  }
  const { verification: removed, ...withoutVerification } = entry;
  assert.ok(removed);
  assert.equal(classifyPublishedTechnicalSpec(original, replace(withoutVerification), field, value), "pending");
  const forgedSupport = "evidencia alterada con hash correcto";
  const forged = { ...entry.verification, support: forgedSupport,
    claimSha256: technicalDocumentClaimSha256(entry.document, field, value,
      entry.verification.reviewedOn, forgedSupport) };
  assert.ok(matchesTechnicalDocumentVerification(entry.document, field, value, forged));
  assert.equal(classifyPublishedTechnicalSpec(original,
    replace({ ...entry, verification: forged }), field, value), "pending");
});

test("la potencia del XT4014KH procede literalmente de su ficha original", async () => {
  const originals = await readPortableOriginal(process.cwd(), "gam");
  const original = originals.products.find((candidate) => candidate.reference === "4817");
  assert.ok(original);
  const field = "Potencia nominal del motor";
  const value = "74 kW";
  const excerpt = "Equipado con un motor diésel de 74 kW (99 HP), el XT4014KH";
  assert.ok(original.longDescription?.includes(excerpt));
  const snapshot = JSON.stringify(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  assert.equal(trace.originalRecordSha256, originalRecordFingerprint(original));
  assert.equal(JSON.stringify(original), snapshot);
  assert.deepEqual(reviewedUnitDescriptionEvidence(original, field, value), {
    scope: "unit", sourceField: "longDescription", sourceValue: original.longDescription
  });
  const entry = trace.entries.find((candidate) => candidate.field === field);
  assert.ok(entry);
  assert.equal(entry.scope, "unit");
  assert.equal(entry.value, value);
  assert.equal(entry.sourceField, "longDescription");
  assert.equal(entry.sourceValue, original.longDescription);
  assert.equal(entry.document, undefined);
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, value), "own");
  const traction = trace.entries.find((candidate) => candidate.field === "Tracción");
  assert.ok(traction);
  assert.equal(classifyPublishedTechnicalSpec(original, trace, traction.field, traction.value), "reused");
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, "90 kW"), "pending");
  assert.equal(classifyPublishedTechnicalSpec({ ...original, title: `${original.title} alterado` }, trace, field, value), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original, { ...trace,
    originalRecordSha256: "0".repeat(64) }, field, value), "pending");
  const withoutExcerpt = { ...original, longDescription: original.longDescription?.replace(excerpt, "") ?? null };
  assert.equal(reviewedUnitDescriptionEvidence(withoutExcerpt, field, value), null);
  assert.equal(reviewedUnitDescriptionEvidence({ ...original, model: "XT4014K" }, field, value), null);
  assert.equal(reviewedUnitDescriptionEvidence({ ...original, reference: "4814" }, field, value), null);
  assert.equal(reviewedUnitDescriptionEvidence({ ...original, url: `${original.url}-alterada` }, field, value), null);
  assert.equal(reviewedUnitDescriptionEvidence(original, field, "75 kW"), null);
});
