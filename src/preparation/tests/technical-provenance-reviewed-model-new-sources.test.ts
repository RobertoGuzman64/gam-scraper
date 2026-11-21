import assert from "node:assert/strict";
import test from "node:test";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification } from "../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { readPanelSnapshot } from "../../panel/evidence/read-panel-snapshot.js";
import { readPanelExplorer } from "../../panel/explorer/read-panel-explorer.js";
import { resolvePanelFieldProvenance } from "../../panel/explorer/field-provenance.js";
import { classifySpecAdditions } from "../../panel/explorer/spec-addition-classification.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { reviewedModelDocumentClaims, reviewedModelDocumentVerification } from
  "../shared/technical/evidence/reviewed-model-claims.js";

const references = [
  { providerId: "mercaeleva", reference: "M401-4335", count: 2 },
  { providerId: "mercaeleva", reference: "M239-8327", count: 2 },
  { providerId: "mercaeleva", reference: "M502-4867", count: 2 },
  { providerId: "mercaeleva", reference: "M200-9533", count: 3 },
  { providerId: "mercaeleva", reference: "M315-5925", count: 2 },
  { providerId: "mercaeleva", reference: "M055-1205", count: 2 },
  { providerId: "gam", reference: "2365", count: 2 }
] as const;

const claims = reviewedModelDocumentClaims().slice(175, 190);

test("fase 31: las quince afirmaciones verificadas se emiten desde el motor sin cambiar el producto", async () => {
  assert.equal(claims.length, 15);
  const seen = new Set<string>();
  for (const { providerId, reference, count } of references) {
    const catalog = await readPortableOriginal(process.cwd(), providerId);
    const original = catalog.products.find((item) => item.reference === reference);
    assert.ok(original);
    const before = JSON.stringify(original);
    const prepared = prepareSourceProduct(original);
    assert.equal(JSON.stringify(original), before);
    assert.ok(prepared.technicalProvenance);
    assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
    const actual = prepared.technicalProvenance.entries.filter((entry) =>
      entry.scope === "model-document" && claims.some((claim) =>
        entry.document?.url === claim.document.url && entry.field === claim.field &&
        entry.value === claim.value && entry.verification?.claimSha256 === claim.verification.claimSha256));
    assert.equal(actual.length, count, reference);
    for (const entry of actual) {
      assert.ok(entry.document);
      assert.ok(entry.verification);
      assert.equal(entry.document.brand, original.brand);
      assert.equal(entry.document.model, original.model);
      assert.ok(Object.values(prepared.product.spec).includes(entry.value));
      assert.ok(entry.mechanism.startsWith("src/preparation/"));
      assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
      seen.add(JSON.stringify([reference, entry.field, entry.value]));
    }
  }
  assert.equal(seen.size, 15);
});

test("fase 31: fuente, identidad, variante, campo y afirmación alterados no acreditan", () => {
  for (const claim of claims) {
    assert.deepEqual(reviewedModelDocumentVerification(claim.document, claim.field, claim.value), claim.verification);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, url: claim.document.url + "-distinta" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, brand: "Otra marca" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, model: "Otra variante" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field + " alterado", claim.value), null);
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field, claim.value + " alterado"), null);
    assert.equal(matchesTechnicalDocumentVerification(claim.document, claim.field, claim.value,
      { ...claim.verification, support: "afirmación diferente" }), false);
  }
});

test("fase 31: la nueva publicación clasifica la evidencia del motor sin auditoría histórica", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  for (const { providerId, reference, count } of references) {
    const provider = snapshot.providers.find((item) => item.providerId === providerId);
    const originals = await readPortableOriginal(root, providerId);
    assert.ok(provider);
    const original = originals.products.find((item) => item.reference === reference);
    const published = explorer.products.find((item) => item.providerId === providerId && item.reference === reference);
    assert.ok(original);
    assert.ok(published?.published);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    const additions = published.changes.filter((item) => item.group === "technical" && item.change === "added" &&
      trace.entries.some((entry) => entry.scope === "model-document" && entry.verification &&
        entry.field === item.field && claims.some((claim) => claim.document.url === entry.document?.url &&
          claim.field === entry.field && claim.value === entry.value)));
    assert.equal(additions.length, count, reference);
    const provenance = resolvePanelFieldProvenance(original, published.published, additions,
      provider, null, original.reference, original.url, trace);
    assert.equal(provenance.length, count, reference);
    assert.ok(provenance.every((item) => item.scope === "model-document" && item.verification &&
      item.historicalApplication === "demonstrated"));
    const classify = (evidence = provenance) => classifySpecAdditions(additions, provider,
      original.reference, original.url, null, original, evidence);
    assert.ok(classify().every((item) => item.kind === "reused"));
    assert.ok(classify([]).every((item) => item.kind === "pending"));
  }
});
