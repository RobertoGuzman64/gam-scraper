import assert from "node:assert/strict";
import test from "node:test";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification } from "../../contracts/technical-provenance.js";
import { readPanelSnapshot } from "../../panel/evidence/read-panel-snapshot.js";
import { readPanelExplorer } from "../../panel/explorer/read-panel-explorer.js";
import { resolvePanelFieldProvenance } from "../../panel/explorer/field-provenance.js";
import { classifySpecAdditions } from "../../panel/explorer/spec-addition-classification.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { reviewedModelDocumentClaims, reviewedModelDocumentVerification } from
  "../shared/technical/evidence/reviewed-model-claims.js";

const references = [
  { providerId: "gam", reference: "5949", count: 5 },
  { providerId: "gam", reference: "2364", count: 4 },
  { providerId: "gam", reference: "6807", count: 3 },
  { providerId: "mercaeleva", reference: "M622-7084", count: 3 },
  { providerId: "mercaeleva", reference: "M091-1956", count: 2 },
  { providerId: "mercaeleva", reference: "M829-9712", count: 2 }
] as const;

const claims = reviewedModelDocumentClaims().slice(143, 162);

test("fase 29: las 19 afirmaciones revisadas se emiten durante la preparación sin mutar el producto", async () => {
  assert.equal(claims.length, 19);
  const seen = new Set<string>();
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const catalog = await readPortableOriginal(process.cwd(), providerId);
    for (const { reference, count } of references.filter((item) => item.providerId === providerId)) {
      const original = catalog.products.find((item) => item.reference === reference);
      assert.ok(original);
      const before = JSON.stringify(original);
      const prepared = prepareSourceProduct(original);
      assert.equal(JSON.stringify(original), before);
      assert.ok(prepared.technicalProvenance);
      assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
      const entries = prepared.technicalProvenance.entries.filter((entry) =>
        entry.scope === "model-document" && claims.some((claim) =>
          entry.document?.url === claim.document.url && entry.field === claim.field &&
          entry.value === claim.value && entry.verification?.claimSha256 === claim.verification.claimSha256));
      assert.equal(entries.length, count, reference);
      for (const entry of entries) {
        assert.equal(entry.scope, "model-document");
        assert.ok(entry.document);
        assert.ok(entry.verification);
        assert.equal(entry.document.brand, original.brand);
        assert.equal(entry.document.model, original.model);
        assert.ok(Object.values(prepared.product.spec).includes(entry.value));
        assert.ok(entry.mechanism.startsWith("src/preparation/"));
        assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
        seen.add(JSON.stringify([providerId, reference, entry.field, entry.value]));
      }
    }
  }
  assert.equal(seen.size, 19);
});

test("fase 29: documentos, marca, modelo y valores diferentes invalidan la acreditación", () => {
  for (const claim of claims) {
    assert.deepEqual(reviewedModelDocumentVerification(claim.document, claim.field, claim.value), claim.verification);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, url: claim.document.url + "-otra" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, brand: "MARCA DIFERENTE" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, model: "VARIANTE DIFERENTE" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field, claim.value + " alterado"), null);
    assert.equal(matchesTechnicalDocumentVerification(claim.document, claim.field, claim.value,
      { ...claim.verification, support: "texto alterado" }), false);
  }
});

test("fase 29: una publicación nueva utiliza la procedencia del motor sin auditoría histórica", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  for (const [providerId, reference] of [["gam", "5949"], ["mercaeleva", "M622-7084"]] as const) {
    const provider = snapshot.providers.find((item) => item.providerId === providerId);
    const catalog = await readPortableOriginal(root, providerId);
    const original = catalog.products.find((item) => item.reference === reference);
    const published = explorer.products.find((item) => item.providerId === providerId && item.reference === reference);
    assert.ok(provider);
    assert.ok(original);
    assert.ok(published?.published);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    const additions = published.changes.filter((item) => item.group === "technical" && item.change === "added" &&
      trace.entries.some((entry) => entry.field === item.field && entry.scope === "model-document" &&
        entry.verification !== undefined));
    assert.ok(additions.length > 0);
    const provenance = resolvePanelFieldProvenance(original, published.published, additions,
      provider, null, original.reference, original.url, trace);
    assert.ok(provenance.every((item) => item.scope === "model-document" && item.verification &&
      item.historicalApplication === "demonstrated"));
    const classify = (evidence = provenance) => classifySpecAdditions(additions, provider,
      original.reference, original.url, null, original, evidence);
    assert.ok(classify().every((item) => item.kind === "reused"));
    assert.ok(classify([]).every((item) => item.kind === "pending"));
  }
});
