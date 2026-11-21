import assert from "node:assert/strict";
import { test } from "node:test";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";
import { technicalDocumentClaimSha256, matchesTechnicalDocumentVerification } from "../../contracts/technical-provenance.js";
import type { TechnicalSpecEvidence } from "../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { reviewedCatalogModelIdentity } from "../shared/technical/evidence/reviewed-catalog-model-identity.js";
import { reviewedModelDocumentVerification } from "../shared/technical/evidence/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../technical-spec-classification.js";

const cases = [
  { reference: "6805", brand: "LVNENG", model: "LX05", url: "https://www.lvnengebike.com/LX05.html",
    fields: ["Dimensiones exteriores", "Tipo de frenos"] },
  { reference: "6189", brand: "CTE", model: "MP 24 C", url: "https://ctelift.com/nuovi-prodotti-cte-2021/",
    fields: ["Altura sobre obstáculos"] }
] as const;

test("la identidad documental revisada permite tres acreditaciones sin alterar la ficha original", async () => {
  const { products } = await readPortableOriginal(process.cwd(), "gam");
  let credited = 0;
  for (const item of cases) {
    const original = products.find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    assert.equal(original.brand, null);
    assert.equal(original.model, null);
    const before = JSON.stringify(original);
    const fingerprint = originalRecordFingerprint(original);
    const document = reviewedCatalogModelIdentity(original, item.url);
    assert.deepEqual(document, { url: item.url, brand: item.brand, model: item.model });
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    assert.equal(trace.originalRecordSha256, fingerprint);
    assert.equal(JSON.stringify(original), before);
    for (const field of item.fields) {
      const entry: TechnicalSpecEvidence | undefined = trace.entries.find((candidate) => candidate.field === field);
      assert.ok(entry && entry.scope === "document-reference");
      assert.ok(entry.verification);
      assert.deepEqual(entry.document, document);
      assert.deepEqual(reviewedModelDocumentVerification(entry.document, field, entry.value), entry.verification);
      assert.ok(matchesTechnicalDocumentVerification(entry.document, field, entry.value, entry.verification));
      assert.equal(classifyPublishedTechnicalSpec(original, trace, field, entry.value), "reused");
      credited++;
    }
  }
  assert.equal(credited, 3);
});

test("fichas, modelos y afirmaciones sustituidas no obtienen acreditación", async () => {
  const { products } = await readPortableOriginal(process.cwd(), "gam");
  for (const item of cases) {
    const original = products.find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    const entry: TechnicalSpecEvidence | undefined = trace.entries.find((candidate) => candidate.field === item.fields[0]);
    assert.ok(entry && entry.scope === "document-reference" && entry.verification);
    const update = (replacement: TechnicalSpecEvidence) => ({ ...trace,
      entries: trace.entries.map((candidate) => candidate.field === entry.field ? replacement : candidate)
    });
    for (const tampered of [
      { ...original, title: `${original.title} - otro` },
      { ...original, longDescription: `${original.longDescription} - otro` },
      { ...original, brand: item.brand },
      { ...original, model: item.model },
      { ...original, reference: "999999" }
    ]) {
      assert.equal(reviewedCatalogModelIdentity(tampered, item.url), null);
      assert.equal(classifyPublishedTechnicalSpec(tampered, trace, entry.field, entry.value), "pending");
    }
    assert.equal(reviewedCatalogModelIdentity(original, `${item.url}incorrecto`), null);
    assert.equal(classifyPublishedTechnicalSpec(original, trace, entry.field, `${entry.value} modificado`), "pending");
    assert.equal(classifyPublishedTechnicalSpec(original,
      update({ ...entry, document: { ...entry.document, url: "https://example.org/otra-ficha" } }),
      entry.field, entry.value), "pending");
    assert.equal(classifyPublishedTechnicalSpec(original,
      update({ ...entry, document: { ...entry.document, model: "OTRO MODELO" } }),
      entry.field, entry.value), "pending");
    assert.equal(classifyPublishedTechnicalSpec(original,
      update({ ...entry, document: { ...entry.document, brand: "OTRA MARCA" } }),
      entry.field, entry.value), "pending");
    const { verification: excluded, ...withoutVerification } = entry;
    assert.ok(excluded);
    assert.equal(classifyPublishedTechnicalSpec(original, update(withoutVerification),
      entry.field, entry.value), "pending");
    const forgedSupport = "documentación falsa con hash formalmente correcto";
    const forgery = { ...entry.verification, support: forgedSupport,
      claimSha256: technicalDocumentClaimSha256(entry.document, entry.field, entry.value,
        entry.verification.reviewedOn, forgedSupport) };
    assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, forgery));
    assert.equal(classifyPublishedTechnicalSpec(original,
      update({ ...entry, verification: forgery }), entry.field, entry.value), "pending");
  }
});

test("los lotes y variantes no identificados no se acreditan a partir del título", async () => {
  const { products } = await readPortableOriginal(process.cwd(), "gam");
  for (const [reference, field] of [
    ["6994", "Yale MP16 · Ancho exterior de horquillas"]
  ] as const) {
    const original = products.find((candidate) => candidate.reference === reference);
    assert.ok(original);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    const entry: TechnicalSpecEvidence | undefined = trace.entries.find((candidate) => candidate.field === field);
    assert.equal(entry, undefined);
    assert.equal(classifyPublishedTechnicalSpec(original, trace, field, "680 mm"), "pending");
  }
});
