import assert from "node:assert/strict";
import test from "node:test";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification } from "../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { readPanelSnapshot } from "../../panel/evidence/read-panel-snapshot.js";
import { readPanelExplorer } from "../../panel/explorer/read-panel-explorer.js";
import { classifySpecAdditions } from "../../panel/explorer/spec-addition-classification.js";
import { resolvePanelFieldProvenance } from "../../panel/explorer/field-provenance.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { reviewedModelDocumentClaims, reviewedModelDocumentVerification } from
  "../shared/technical/evidence/reviewed-model-claims.js";

const expected = [
  { providerId: "mercaeleva", reference: "M549-6792", count: 4 },
  { providerId: "mercaeleva", reference: "M731-0501", count: 4 },
  { providerId: "mercaeleva", reference: "M209-3306", count: 3 },
  { providerId: "mercaeleva", reference: "M971-8124", count: 2 },
  { providerId: "gam", reference: "4661", count: 1 }
] as const;
const claims = reviewedModelDocumentClaims().slice(190);

test("fase 32: las 14 acreditaciones del motor conservan fuente, mecanismo y valores comerciales", async () => {
  assert.equal(claims.length, 14);
  let total = 0;
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const catalog = await readPortableOriginal(process.cwd(), providerId);
    for (const { reference, count } of expected.filter((item) => item.providerId === providerId)) {
      const original = catalog.products.find((item) => item.reference === reference);
      assert.ok(original);
      const serialized = JSON.stringify(original);
      const prepared = prepareSourceProduct(original);
      assert.equal(JSON.stringify(original), serialized);
      assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
      const verified = prepared.technicalProvenance.entries.filter((entry) =>
        entry.scope === "model-document" && claims.some((claim) =>
          claim.document.url === entry.document.url && claim.field === entry.field &&
          claim.value === entry.value && claim.verification.claimSha256 === entry.verification?.claimSha256));
      assert.equal(verified.length, count, reference);
      for (const entry of verified) {
        assert.equal(entry.scope, "model-document");
        assert.equal(entry.document.brand, original.brand);
        assert.equal(entry.document.model, original.model);
        assert.ok(Object.values(prepared.product.spec).includes(entry.value));
        assert.ok(entry.mechanism.startsWith("src/preparation/"));
        assert.ok(entry.verification);
        assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
        total++;
      }
    }
  }
  assert.equal(total, 14);
});

test("fase 32: variantes, valores y referencias externas diferentes no acreditan", () => {
  for (const claim of claims) {
    assert.deepEqual(reviewedModelDocumentVerification(claim.document, claim.field, claim.value), claim.verification);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, url: claim.document.url + "-otra" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, brand: "OTRA MARCA" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, model: "OTRA VARIANTE" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field, "OTRO VALOR"), null);
    assert.equal(matchesTechnicalDocumentVerification(claim.document, claim.field, claim.value,
      { ...claim.verification, support: "texto cambiado" }), false);
  }
});

test("fase 32: una publicación nueva clasifica las evidencias sin consultar el histórico", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  for (const [providerId, reference] of [["gam", "4661"], ["mercaeleva", "M549-6792"]] as const) {
    const provider = snapshot.providers.find((item) => item.providerId === providerId);
    const original = (await readPortableOriginal(root, providerId)).products.find((item) => item.reference === reference);
    const published = explorer.products.find((item) => item.providerId === providerId && item.reference === reference);
    assert.ok(provider);
    assert.ok(original);
    assert.ok(published?.published);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    const additions = published.changes.filter((item) => item.group === "technical" && item.change === "added" &&
      trace.entries.some((entry) => entry.field === item.field && entry.scope === "model-document" && entry.verification &&
        claims.some((claim) => claim.field === entry.field && claim.document.url === entry.document?.url)));
    assert.ok(additions.length > 0);
    const provenance = resolvePanelFieldProvenance(original, published.published, additions,
      provider, null, original.reference, original.url, trace);
    assert.ok(provenance.every((entry) => entry.historicalApplication === "demonstrated" && entry.verification));
    const classify = (items = provenance) => classifySpecAdditions(additions, provider, original.reference,
      original.url, null, original, items);
    assert.ok(classify().every((item) => item.kind === "reused"));
    assert.ok(classify([]).every((item) => item.kind === "pending"));
    const first = provenance[0];
    assert.ok(first?.document);
    assert.ok(classify([{ ...first, document: { ...first.document, model: "OTRA VARIANTE" } },
      ...provenance.slice(1)])[0]?.kind === "pending");
  }
});
