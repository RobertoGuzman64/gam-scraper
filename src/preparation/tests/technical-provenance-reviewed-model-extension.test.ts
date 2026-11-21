import assert from "node:assert/strict";
import test from "node:test";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification } from "../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { reviewedModelDocumentClaims, reviewedModelDocumentVerification } from
  "../shared/technical/evidence/reviewed-model-claims.js";

const gamReferences = ["218", "219", "220", "221", "226", "228", "233", "243", "244", "4028", "4040"] as const;
const mercaelevaReferences = ["M726-5166", "M569-9029", "M840-6795", "M177-1398",
  "M432-1479", "M913-0641", "M736-5615", "M028-8481", "M055-3461", "M579-8838",
  "M690-5522", "M940-3556", "M547-1056", "M805-9451"] as const;

test("fase 26: acredita 69 afirmaciones de fabricante sin modificar el enriquecimiento comercial", async () => {
  const claims = reviewedModelDocumentClaims();
  assert.ok(claims.length >= 112);
  const seen = new Set<string>();
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const references = providerId === "gam" ? gamReferences : mercaelevaReferences;
    const catalog = await readPortableOriginal(process.cwd(), providerId);
    for (const reference of references) {
      const original = catalog.products.find((item) => item.reference === reference);
      assert.ok(original);
      const unchanged = JSON.stringify(original);
      const prepared = prepareSourceProduct(original);
      assert.equal(JSON.stringify(original), unchanged);
      assert.ok(prepared.technicalProvenance);
      assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
      for (const entry of prepared.technicalProvenance.entries) {
        if (entry.scope !== "model-document" || !entry.verification) continue;
        assert.ok(entry.document);
        assert.equal(entry.document.brand, original.brand);
        assert.equal(entry.document.model, original.model);
        assert.ok(Object.values(prepared.product.spec).includes(entry.value));
        assert.ok(entry.mechanism.startsWith("src/preparation/"));
        assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
        assert.deepEqual(reviewedModelDocumentVerification(entry.document, entry.field, entry.value), entry.verification);
        seen.add(JSON.stringify([original.providerId, reference, entry.field, entry.value]));
      }
    }
  }
  assert.equal(seen.size, 69);
});

test("fase 26: las acreditaciones documentales no sobreviven a cambios de fuente, modelo o valor", async () => {
  for (const claim of reviewedModelDocumentClaims()) {
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field, claim.value)?.claimSha256,
      claim.verification.claimSha256);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, url: claim.document.url + "-otro" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, model: "VARIANTE DISTINTA" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, brand: "MARCA DISTINTA" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field, claim.value + " diferente"), null);
    assert.equal(matchesTechnicalDocumentVerification(claim.document, claim.field, claim.value,
      { ...claim.verification, support: "texto manipulado" }), false);
  }
  const catalog = await readPortableOriginal(process.cwd(), "mercaeleva");
  const original = catalog.products.find((item) => item.reference === "M569-9029");
  assert.ok(original);
  const prepared = prepareSourceProduct(original);
  const provenance = prepared.technicalProvenance;
  assert.ok(provenance);
  const evidence = provenance.entries.find((item) =>
    item.field === "Altura de plataforma" && item.scope === "model-document");
  assert.ok(evidence && evidence.scope === "model-document");
  assert.ok(evidence.verification);
  assert.ok(isProductTechnicalProvenance({ originalRecordSha256: provenance.originalRecordSha256,
    entries: [evidence] }));
  assert.equal(isProductTechnicalProvenance({ originalRecordSha256: provenance.originalRecordSha256,
    entries: [{ ...evidence, verification: { ...evidence.verification, support: "modificado" } }] }), false);
});
