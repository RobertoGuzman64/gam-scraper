import assert from "node:assert/strict";
import { test } from "node:test";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import { technicalDocumentClaimSha256 } from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedCatalogModelIdentity } from "../../../technical/evidence/reviewed-catalog-model-identity.js";
import { reviewedModelDocumentVerification } from "../../../technical/evidence/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const url = "https://www.ctelift.com/wp-content/uploads/2020/11/B-LIFT-27.2_2021-05_EN.pdf";
const field = "Altura de plataforma";
const value = "25 m";

test("la ficha B-LIFT 27.2 FIB conserva identidad y evidencia primaria del modelo base", async () => {
  const { products } = await readPortableOriginal(process.cwd(), "gam");
  const original = products.find((candidate) => candidate.reference === "6190");
  assert.ok(original);
  assert.equal(original.brand, null);
  assert.equal(original.model, null);
  assert.match(original.title ?? "", /B-LIFT 27\.2 FIB/u);
  assert.match(original.longDescription ?? "", /27 m/u);
  assert.match(original.longDescription ?? "", /15,5 m/u);
  assert.match(original.longDescription ?? "", /250 kg/u);
  const snapshot = JSON.stringify(original);
  const document = reviewedCatalogModelIdentity(original, url);
  assert.deepEqual(document, { url, brand: "CTE", model: "B-LIFT 27.2" });
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  assert.equal(trace.originalRecordSha256, originalRecordFingerprint(original));
  assert.equal(JSON.stringify(original), snapshot);
  const entry = trace.entries.find((candidate) => candidate.field === field);
  assert.ok(entry && entry.scope === "document-reference" && entry.verification);
  assert.equal(entry.value, value);
  assert.deepEqual(entry.document, document);
  assert.deepEqual(entry.verification, reviewedModelDocumentVerification(entry.document, field, value));
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, value), "reused");
});

test("la evidencia B-LIFT solo acredita la altura y rechaza alteraciones y variantes", async () => {
  const { products } = await readPortableOriginal(process.cwd(), "gam");
  const original = products.find((candidate) => candidate.reference === "6190");
  assert.ok(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  const entry = trace.entries.find((candidate) => candidate.field === field);
  assert.ok(entry && entry.scope === "document-reference" && entry.verification);
  const replace = (replacement: typeof entry) => ({ ...trace, entries: trace.entries.map((candidate) =>
    candidate.field === field ? replacement : candidate) });
  for (const tampered of [
    { ...original, title: original.title?.replace("FIB", "OTRO") ?? null },
    { ...original, longDescription: `${original.longDescription} alterada` },
    { ...original, reference: "6191" },
    { ...original, brand: "CTE" },
    { ...original, model: "B-LIFT 27.2" }
  ]) {
    assert.equal(reviewedCatalogModelIdentity(tampered, url), null);
    assert.equal(classifyPublishedTechnicalSpec(tampered, trace, field, value), "pending");
  }
  assert.equal(reviewedCatalogModelIdentity(original, `${url}?revision=otra`), null);
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, "27 m"), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original,
    replace({ ...entry, document: { ...entry.document, url: `${url}?revision=otra` } }), field, value), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original,
    replace({ ...entry, document: { ...entry.document, model: "B-LIFT 27.2 OTRO" } }), field, value), "pending");
  const forgedSupport = "afirmación falsa con hash formalmente válido";
  const forged = { ...entry.verification, support: forgedSupport,
    claimSha256: technicalDocumentClaimSha256(entry.document, field, value,
      entry.verification.reviewedOn, forgedSupport) };
  assert.equal(classifyPublishedTechnicalSpec(original,
    replace({ ...entry, verification: forged }), field, value), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original,
    { ...trace, originalRecordSha256: "0".repeat(64) }, field, value), "pending");
  for (const unrelated of ["Potencia de motor", "Capacidad de cesta FIB", "Tipo de cesta"]) {
    assert.equal(reviewedModelDocumentVerification(entry.document, unrelated, value), null);
    assert.equal(classifyPublishedTechnicalSpec(original, trace, unrelated, value), "pending");
  }
});
