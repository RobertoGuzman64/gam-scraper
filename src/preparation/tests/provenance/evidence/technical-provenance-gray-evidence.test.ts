import assert from "node:assert/strict";
import { test } from "node:test";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";
import { matchesTechnicalDocumentVerification, technicalDocumentClaimSha256 } from "../../../../contracts/technical-provenance.js";
import { reviewedModelDocumentClaims } from "../../../technical/reviewed-model-claims.js";
import type { TechnicalDocumentVerification, TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";

const cases = [
  { reference: "231", model: "Logitilt LT", fields: ["Recorrido de elevación", "Altura de trabajo con caja inclinada"] },
  { reference: "232", model: "Logitilt LTS", fields: ["Recorrido de elevación", "Altura de trabajo con caja inclinada"] },
  { reference: "239", model: "LogiQ 200/300", fields: ["Longitud de horquillas", "Altura mínima de horquillas"] },
  { reference: "240", model: "Logitilt LTI", fields: ["Recorrido de elevación", "Altura de trabajo con caja inclinada"] },
  { reference: "234", model: "Mover", fields: ["Acceso del operador", "Panel de control"] }
] as const;

test("fase 33: diez specs pendientes tienen fuente del fabricante y afirmación verificable en el motor", async () => {
  const originals = await readPortableOriginal(process.cwd(), "gam");
  const claims = reviewedModelDocumentClaims();
  for (const item of cases) {
    const original = originals.products.find((entry) => entry.reference === item.reference);
    assert.ok(original);
    assert.equal(original.model, item.model);
    const result = prepareSourceProduct(original);
    assert.ok(result.technicalProvenance);
    for (const field of item.fields) {
      const entry: TechnicalSpecEvidence | undefined = result.technicalProvenance.entries.find((evidence) => evidence.field === field);
      assert.ok(entry);
      assert.equal(entry.scope, "model-document");
      if (entry.scope !== "model-document") continue;
      const verification: TechnicalDocumentVerification | undefined = entry.verification;
      assert.ok(verification);
      assert.ok(claims.some((claim) => claim.document.url === entry.document.url &&
        claim.document.brand === original.brand && claim.document.model === original.model &&
        claim.field === field && claim.value === entry.value &&
        claim.verification.claimSha256 === verification.claimSha256));
      assert.ok(matchesTechnicalDocumentVerification(entry.document, field, entry.value, verification));
      assert.equal(classifyPublishedTechnicalSpec(original, result.technicalProvenance, field, entry.value), "reused");
      assert.equal(classifyPublishedTechnicalSpec({ ...original, title: `${original.title} alterado` },
        result.technicalProvenance, field, entry.value), "pending");
      assert.equal(classifyPublishedTechnicalSpec(original, result.technicalProvenance, field, `${entry.value} alterado`), "pending");
      assert.equal(classifyPublishedTechnicalSpec(original, { ...result.technicalProvenance,
        entries: result.technicalProvenance.entries.map((evidence) => evidence.field !== field ? evidence :
          { ...entry, document: { ...entry.document, model: "modelo distinto" } }) }, field, entry.value), "pending");
      assert.equal(classifyPublishedTechnicalSpec(original, { ...result.technicalProvenance,
        entries: result.technicalProvenance.entries.map((evidence) => evidence.field !== field ? evidence :
          { ...entry, verification: { ...verification, support: "afirmación alterada" } }) }, field, entry.value), "pending");
      const support = "afirmación inventada pero con hash formalmente correcto";
      const invented: TechnicalDocumentVerification = { ...verification, support, claimSha256: technicalDocumentClaimSha256(
        entry.document, field, entry.value, verification.reviewedOn, support) };
      assert.ok(matchesTechnicalDocumentVerification(entry.document, field, entry.value, invented));
      assert.equal(classifyPublishedTechnicalSpec(original, { ...result.technicalProvenance,
        entries: result.technicalProvenance.entries.map((evidence) => evidence.field !== field ? evidence :
          { ...entry, verification: invented }) }, field, entry.value), "pending");
    }
  }
});
