import assert from "node:assert/strict";
import { test } from "node:test";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";
import { matchesTechnicalDocumentVerification, technicalDocumentClaimSha256 } from "../../contracts/technical-provenance.js";
import type { TechnicalSpecEvidence } from "../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { reviewedModelDocumentVerification } from "../shared/technical/evidence/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../technical-spec-classification.js";

const url = "https://www.automobile-catalog.com/make/alfa_romeo/spider_alfa_romeo/spider_serie_2/1973.html";
const facts = [
  ["Altura exterior del modelo", "1290 mm"],
  ["Anchura exterior del modelo", "1630 mm"],
  ["Distancia entre ejes del modelo", "2250 mm"],
  ["Longitud exterior del modelo", "4120 mm"],
  ["Tipo de tracción", "Trasera"],
  ["Transmisión del modelo", "Manual de 5 velocidades"]
] as const;

const originalWithTrace = async () => {
  const { products } = await readPortableOriginal(process.cwd(), "gam");
  const original = products.find((candidate) => candidate.reference === "6688");
  assert.ok(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  return { original, trace };
};

test("las seis características comunes del Spider Junior de 1973 están acreditadas sin inferir el motor", async () => {
  const { original, trace } = await originalWithTrace();
  assert.equal(original.brand, null);
  assert.equal(original.model, "SPIDE JUNIOR");
  assert.equal(original.year, "1973");
  assert.equal(trace.originalRecordSha256, originalRecordFingerprint(original));
  assert.equal(JSON.stringify(prepareSourceProduct(original).technicalProvenance), JSON.stringify(trace));
  for (const [field, value] of facts) {
    const evidence = trace.entries.find((candidate) => candidate.field === field);
    assert.ok(evidence && evidence.scope === "document-reference");
    assert.equal(evidence.value, value);
    assert.deepEqual(evidence.document, { url, brand: null, model: original.model });
    assert.ok(evidence.verification);
    assert.deepEqual(evidence.verification, reviewedModelDocumentVerification(evidence.document, field, value));
    assert.ok(matchesTechnicalDocumentVerification(evidence.document, field, value, evidence.verification));
    assert.equal(classifyPublishedTechnicalSpec(original, trace, field, value), "reused");
  }
  for (const unsupported of ["Cilindrada del motor", "Potencia del motor", "Versión 1300 Junior"]) {
    assert.equal(reviewedModelDocumentVerification({ url, brand: null, model: original.model }, unsupported, "1300"), null);
    assert.equal(classifyPublishedTechnicalSpec(original, trace, unsupported, "1300"), "pending");
  }
});

test("ninguna alteración documental o de identidad permite heredar las seis acreditaciones", async () => {
  const { original, trace } = await originalWithTrace();
  const field = facts[0][0];
  const value = facts[0][1];
  const evidence = trace.entries.find((candidate) => candidate.field === field);
  assert.ok(evidence && evidence.scope === "document-reference" && evidence.verification);
  const replace = (changed: TechnicalSpecEvidence) => ({ ...trace,
    entries: trace.entries.map((candidate) => candidate.field === field ? changed : candidate)
  });
  for (const altered of [
    { ...original, title: `${original.title} variante` },
    { ...original, year: "1976" },
    { ...original, model: "SPIDER 2000" },
    { ...original, reference: "6689" },
    { ...original, longDescription: `${original.longDescription} modificado` }
  ]) {
    assert.equal(classifyPublishedTechnicalSpec(altered, trace, field, value), "pending");
  }
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, "1300 mm"), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original,
    { ...trace, originalRecordSha256: "0".repeat(64) }, field, value), "pending");
  for (const document of [
    { ...evidence.document, url: `${url}?otra` },
    { ...evidence.document, model: "SPIDER 2000" },
    { ...evidence.document, brand: "ALFA ROMEO" }
  ]) {
    assert.equal(classifyPublishedTechnicalSpec(original, replace({ ...evidence, document }), field, value), "pending");
  }
  const { verification: removed, ...withoutVerification } = evidence;
  assert.ok(removed);
  assert.equal(classifyPublishedTechnicalSpec(original, replace(withoutVerification), field, value), "pending");
  const support = "texto no contrastado con huella recalculada";
  const forged = { ...evidence.verification, support,
    claimSha256: technicalDocumentClaimSha256(evidence.document, field, value, evidence.verification.reviewedOn, support) };
  assert.equal(classifyPublishedTechnicalSpec(original,
    replace({ ...evidence, verification: forged }), field, value), "pending");
});
