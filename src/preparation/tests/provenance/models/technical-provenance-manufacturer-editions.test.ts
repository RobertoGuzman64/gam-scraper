import assert from "node:assert/strict";
import { test } from "node:test";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import { technicalDocumentClaimSha256, matchesTechnicalDocumentVerification } from "../../../../contracts/technical-provenance.js";
import type { TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentVerification } from "../../../technical/evidence/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const reference = "M209-3306";
const field = "Altura de plataforma";
const value = "20,31 m";
const url = "https://doc.pegamo.es/www/machinery/doc/0AEE48CF9C424F608F99E74F6D48876A.pdf";

const originalAndTrace = async () => {
  const { products } = await readPortableOriginal(process.cwd(), "mercaeleva");
  const original = products.find((candidate) => candidate.reference === reference);
  assert.ok(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  const entry = trace.entries.find((candidate) => candidate.field === field);
  assert.ok(entry && entry.scope === "model-document" && entry.verification);
  return { original, trace, entry };
};

test("la ficha JLG 660SJ de 2015 acredita exclusivamente la altura publicada", async () => {
  const { original, trace, entry } = await originalAndTrace();
  assert.equal(original.brand, "JLG");
  assert.equal(original.model, "660SJ");
  assert.equal(original.year, "2015");
  assert.equal(trace.originalRecordSha256, originalRecordFingerprint(original));
  assert.equal(entry.scope, "model-document");
  assert.equal(entry.value, value);
  assert.deepEqual(entry.document, { url, brand: "JLG", model: "660SJ" });
  assert.ok(entry.verification);
  assert.deepEqual(entry.verification, reviewedModelDocumentVerification(entry.document, field, value));
  assert.ok(matchesTechnicalDocumentVerification(entry.document, field, value, entry.verification));
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, value), "reused");
  for (const previous of [
    ["Alcance horizontal (m)", "17,3 m"],
    ["Anchura (mm)", "2,49 m"],
    ["Capacidad máxima de plataforma", "230 kg"]
  ] as const) {
    const existing = trace.entries.find((candidate) => candidate.field === previous[0]);
    assert.ok(existing);
    assert.equal(classifyPublishedTechnicalSpec(original, trace, previous[0], previous[1]), "reused");
    assert.notEqual(existing.document?.url, url);
  }
});

test("otra ficha, otra edición, otro modelo o un hash fabricado no acreditan la altura", async () => {
  const { original, trace, entry } = await originalAndTrace();
  assert.ok(entry.verification);
  const replace = (replacement: TechnicalSpecEvidence) => ({ ...trace,
    entries: trace.entries.map((candidate) => candidate.field === field ? replacement : candidate)
  });
  assert.equal(classifyPublishedTechnicalSpec({ ...original, title: `${original.title} - otra unidad` },
    trace, field, value), "pending");
  assert.equal(classifyPublishedTechnicalSpec({ ...original, model: "600SJ" }, trace, field, value), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, "20,02 m"), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original,
    { ...trace, originalRecordSha256: "0".repeat(64) }, field, value), "pending");
  for (const document of [
    { ...entry.document, url: `${url}?revision=otra` },
    { ...entry.document, model: "660SJC" },
    { ...entry.document, brand: "OTRA MARCA" }
  ]) {
    assert.equal(classifyPublishedTechnicalSpec(original, replace({ ...entry, document }), field, value), "pending");
  }
  const { verification: removed, ...withoutVerification } = entry;
  assert.ok(removed);
  assert.equal(classifyPublishedTechnicalSpec(original, replace(withoutVerification), field, value), "pending");
  const fakeSupport = "Afirmación sustituida por una fuente diferente";
  const fakeVerification = { ...entry.verification, support: fakeSupport,
    claimSha256: technicalDocumentClaimSha256(entry.document, field, value,
      entry.verification.reviewedOn, fakeSupport) };
  assert.ok(matchesTechnicalDocumentVerification(entry.document, field, value, fakeVerification));
  assert.equal(classifyPublishedTechnicalSpec(original,
    replace({ ...entry, verification: fakeVerification }), field, value), "pending");
});
