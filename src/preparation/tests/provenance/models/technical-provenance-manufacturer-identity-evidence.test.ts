import assert from "node:assert/strict";
import test from "node:test";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import { matchesTechnicalDocumentVerification, technicalDocumentClaimSha256 } from "../../../../contracts/technical-provenance.js";
import type { TechnicalDocumentVerification, TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentVerification } from "../../../technical/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const cases = [
  {
    reference: "M971-8124", model: "S-125",
    verified: [
      { field: "Altura de plataforma", value: "38,1 m", url: "https://manuals.genielift.com/operators/english/228459.pdf" },
      { field: "Anchura con ejes recogidos", value: "2,5 m", url: "https://manuals.genielift.com/operators/english/228459.pdf" }
    ],
    previous: ["Alcance horizontal (m)", "Capacidad máxima de plataforma"]
  },
  {
    reference: "M649-6453", model: "SJ9250",
    verified: [
      { field: "Longitud de plataforma", value: "4,27 m", url: "https://www.skyjack.com/sites/default/files/specifications/SJ9250_RT.pdf" }
    ],
    previous: ["Altura de plataforma", "Anchura (mm)", "Anchura de plataforma"]
  }
] as const;

test("manuales de fabricante verifican tres specs con modelo, valor y URL exactos conservando fuentes anteriores", async () => {
  const originals = await readPortableOriginal(process.cwd(), "mercaeleva");
  let accredited = 0;
  for (const item of cases) {
    const original = originals.products.find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    assert.equal(original.model, item.model);
    const unchanged = JSON.stringify(original);
    const emitted = prepareSourceProduct(original).technicalProvenance;
    assert.ok(emitted);
    assert.equal(JSON.stringify(original), unchanged);
    assert.equal(emitted.originalRecordSha256, originalRecordFingerprint(original));
    for (const claim of item.verified) {
      const entry: TechnicalSpecEvidence | undefined = emitted.entries.find((candidate) => candidate.field === claim.field);
      assert.ok(entry);
      assert.equal(entry.scope, "model-document");
      assert.equal(entry.value, claim.value);
      assert.equal(entry.document?.url, claim.url);
      assert.equal(entry.document?.brand, original.brand);
      assert.equal(entry.document?.model, original.model);
      assert.ok(entry.verification);
      assert.deepEqual(reviewedModelDocumentVerification(entry.document, entry.field, entry.value), entry.verification);
      assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
      assert.equal(classifyPublishedTechnicalSpec(original, emitted, entry.field, entry.value), "reused");
      assert.equal(classifyPublishedTechnicalSpec(original, emitted, entry.field, `${entry.value} inválido`), "pending");
      assert.equal(classifyPublishedTechnicalSpec({ ...original, model: "OTRO MODELO" }, emitted, entry.field, entry.value), "pending");
      assert.equal(classifyPublishedTechnicalSpec(original, { ...emitted, originalRecordSha256: "0".repeat(64) }, entry.field, entry.value), "pending");
      assert.equal(reviewedModelDocumentVerification({ ...entry.document, url: `${entry.document.url}-falso` }, entry.field, entry.value), null);
      assert.equal(reviewedModelDocumentVerification({ ...entry.document, model: "MODELO DIFERENTE" }, entry.field, entry.value), null);
      assert.equal(reviewedModelDocumentVerification(entry.document, entry.field, `${entry.value} falso`), null);
      const support = "evidencia inventada";
      const invented: TechnicalDocumentVerification = {
        ...entry.verification, support,
        claimSha256: technicalDocumentClaimSha256(entry.document, entry.field, entry.value, entry.verification.reviewedOn, support)
      };
      assert.equal(classifyPublishedTechnicalSpec(original, { ...emitted,
        entries: emitted.entries.map((candidate) => candidate.field === entry.field
          ? { ...candidate, verification: invented } : candidate)
      }, entry.field, entry.value), "pending");
      accredited++;
    }
    for (const field of item.previous) {
      const prior: TechnicalSpecEvidence | undefined = emitted.entries.find((candidate) => candidate.field === field);
      assert.ok(prior);
      assert.ok(prior.document);
      assert.notEqual(prior.document.url, item.verified[0].url);
      assert.equal(classifyPublishedTechnicalSpec(original, emitted, prior.field, prior.value), "reused");
    }
  }
  assert.equal(accredited, 3);
});
