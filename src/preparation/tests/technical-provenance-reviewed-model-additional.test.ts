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
  { providerId: "gam", reference: "212", count: 1 },
  { providerId: "gam", reference: "239", count: 1 },
  { providerId: "mercaeleva", reference: "M318-0509", count: 4 },
  { providerId: "mercaeleva", reference: "M451-2844", count: 4 },
  { providerId: "mercaeleva", reference: "M649-6453", count: 3 },
  { providerId: "mercaeleva", reference: "M141-6600", count: 4 },
  { providerId: "mercaeleva", reference: "M777-6495", count: 3 },
  { providerId: "mercaeleva", reference: "M829-9712", count: 2 },
  { providerId: "mercaeleva", reference: "M380-2365", count: 4 },
  { providerId: "mercaeleva", reference: "M238-0251", count: 3 }
] as const;

test("fase 27: las 29 verificaciones documentales son emitidas por el motor sin alterar el producto", async () => {
  const claims = reviewedModelDocumentClaims().slice(83, 112);
  assert.equal(claims.length, 29);
  const verified = new Set<string>();
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const catalog = await readPortableOriginal(process.cwd(), providerId);
    for (const { reference, count } of references.filter((item) => item.providerId === providerId)) {
      const original = catalog.products.find((item) => item.reference === reference);
      assert.ok(original);
      const unchanged = JSON.stringify(original);
      const prepared = prepareSourceProduct(original);
      assert.equal(JSON.stringify(original), unchanged);
      assert.ok(prepared.technicalProvenance);
      assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
      const entries = prepared.technicalProvenance.entries.filter((entry) =>
        entry.scope === "model-document" && claims.some((claim) => entry.document?.url === claim.document.url &&
          entry.field === claim.field && entry.value === claim.value &&
          entry.verification?.claimSha256 === claim.verification.claimSha256));
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
        verified.add(JSON.stringify([providerId, reference, entry.field]));
      }
    }
  }
  assert.equal(verified.size, 29);
});

test("fase 27: una fuente, marca, variante o valor diferente no convalida la prueba", () => {
  for (const claim of reviewedModelDocumentClaims().slice(83, 112)) {
    assert.deepEqual(reviewedModelDocumentVerification(claim.document, claim.field, claim.value), claim.verification);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, url: claim.document.url + "-diferente" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, brand: "MARCA DIFERENTE" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, model: "MODELO DIFERENTE" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field, claim.value + " alterado"), null);
    assert.equal(matchesTechnicalDocumentVerification(claim.document, claim.field, claim.value,
      { ...claim.verification, support: "prueba manipulada" }), false);
  }
});


test("fase 27: una publicación nueva clasifica la evidencia del motor sin consultar la auditoría histórica", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  for (const [providerId, reference] of [["gam", "239"], ["mercaeleva", "M318-0509"]] as const) {
    const provider = snapshot.providers.find((item) => item.providerId === providerId);
    assert.ok(provider);
    const catalog = await readPortableOriginal(root, providerId);
    const original = catalog.products.find((item) => item.reference === reference);
    const published = explorer.products.find((item) => item.providerId === providerId && item.reference === reference);
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
    const first = provenance[0];
    assert.ok(first?.document);
    assert.equal(classify([{ ...first, document: { ...first.document, model: "OTRA VARIANTE" } },
      ...provenance.slice(1)])[0]?.kind, "pending");
  }
});
