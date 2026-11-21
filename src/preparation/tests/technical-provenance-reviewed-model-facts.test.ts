import assert from "node:assert/strict";
import test from "node:test";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification } from "../../contracts/technical-provenance.js";
import { normalizeSpecKey } from "../../catalog/normalization/normalize-specs.js";
import { accreditedSourceRecord } from "../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { reviewedModelDocumentClaims, reviewedModelDocumentVerification } from
  "../shared/technical/evidence/reviewed-model-claims.js";

const references = ["211", "212", "227", "235", "236", "238", "242"] as const;

test("fase 25: catorce afirmaciones de siete fichas conservan fuente, modelo y valor", () => {
  const claims = reviewedModelDocumentClaims();
  assert.ok(claims.length >= 83);
  const originalClaims = new Set(claims.slice(0, 14).map((claim) => claim.verification.claimSha256));
  assert.equal(originalClaims.size, 14);
  const seen = new Set<string>();
  let verified = 0;
  for (const reference of references) {
    const original = accreditedSourceRecord("gam-original", reference);
    const before = JSON.stringify(original);
    const prepared = prepareSourceProduct(original);
    assert.equal(JSON.stringify(original), before);
    assert.ok(prepared.technicalProvenance);
    assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
    for (const entry of prepared.technicalProvenance.entries) {
      if (entry.scope !== "model-document" || !entry.verification ||
        !originalClaims.has(entry.verification.claimSha256)) continue;
      assert.equal(entry.document.brand, original.brand);
      assert.equal(entry.document.model, original.model);
      assert.equal(entry.value, prepared.product.spec[entry.field]);
      assert.ok(entry.mechanism.startsWith("src/preparation/"));
      assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
      assert.deepEqual(reviewedModelDocumentVerification(entry.document, entry.field, entry.value), entry.verification);
      const key = JSON.stringify([reference, entry.field]);
      assert.ok(!seen.has(key), key);
      seen.add(key);
      verified++;
    }
  }
  assert.equal(verified, 14);
  assert.equal(seen.size, 14);
});

test("fase 25: referencias ambiguas, variantes y valores diferentes no se acreditan", () => {
  for (const claim of reviewedModelDocumentClaims()) {
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field, claim.value)?.claimSha256,
      claim.verification.claimSha256);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, url: claim.document.url + "otra" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, model: "OTRA VARIANTE" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, brand: "OTRA MARCA" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field, claim.value + " alterado"), null);
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field + " alterado", claim.value), null);
    assert.equal(matchesTechnicalDocumentVerification(claim.document, claim.field, claim.value,
      { ...claim.verification, support: "frase manipulada" }), false);
  }
  const original = accreditedSourceRecord("gam-original", "211");
  const { technicalProvenance } = prepareSourceProduct(original);
  assert.ok(technicalProvenance);
  const evidence = technicalProvenance.entries.find((entry) => entry.field === normalizeSpecKey("Anchura de caja admitida"));
  assert.ok(evidence && evidence.scope === "model-document" && evidence.verification);
  assert.equal(isProductTechnicalProvenance({ ...technicalProvenance, entries: [
    { ...evidence, verification: { ...evidence.verification, support: "prueba manipulada" } }
  ] }), false);
  assert.equal(isProductTechnicalProvenance({ ...technicalProvenance, entries: [
    { ...evidence, scope: "unit-document" }
  ] }), false);
  assert.equal(isProductTechnicalProvenance({ ...technicalProvenance, entries: [
    { ...evidence, document: { ...evidence.document, url: "https://example.org/distinto" } }
  ] }), false);
});
