import assert from "node:assert/strict";
import test from "node:test";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification, technicalDocumentClaimSha256 } from "../../../../contracts/technical-provenance.js";
import type { ProductTechnicalProvenance, TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentVerification } from "../../../technical/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const cases = [
  { reference: "M055-3461", brand: "Genie", model: "Z-45/25J", year: "2014",
    field: "Altura de plataforma", value: "13,8 m",
    document: "https://manuals.genielift.com/operators/english/82600.pdf" },
  { reference: "M055-3461", brand: "Genie", model: "Z-45/25J", year: "2014",
    field: "Alcance horizontal (m)", value: "7,7 m",
    document: "https://manuals.genielift.com/operators/english/82600.pdf" },
  { reference: "M005-5167", brand: "Manitou", model: "MT1440 SLT", year: "2012",
    field: "Tracción", value: "4x4", document: "https://www.truckscout24.de/tsp/ts-208-19-367" }
] as const;

const override = (trace: ProductTechnicalProvenance, field: string, entry: TechnicalSpecEvidence): ProductTechnicalProvenance => ({
  ...trace, entries: trace.entries.map((candidate) => candidate.field === field ? entry : candidate)
});

test("fase 53: tres afirmaciones de modelo con fuente y huella exactas", async () => {
  const originalCatalog = await readPortableOriginal(process.cwd(), "mercaeleva");
  for (const item of cases) {
    const original = originalCatalog.products.find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    assert.equal(original.brand, item.brand);
    assert.equal(original.model, item.model);
    assert.equal(original.year, item.year);
    const before = JSON.stringify(original);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace && isProductTechnicalProvenance(trace));
    assert.equal(JSON.stringify(original), before);
    assert.equal(trace.originalRecordSha256, originalRecordFingerprint(original));
    const entry = trace.entries.find((candidate) => candidate.field === item.field);
    assert.ok(entry && entry.scope === "model-document");
    assert.equal(entry.value, item.value);
    assert.equal(entry.document.url, item.document);
    assert.equal(entry.document.brand, item.brand);
    assert.equal(entry.document.model, item.model);
    assert.ok(entry.verification);
    assert.deepEqual(entry.verification,
      reviewedModelDocumentVerification(entry.document, item.field, item.value));
    assert.ok(matchesTechnicalDocumentVerification(entry.document, item.field, item.value, entry.verification));
    assert.equal(classifyPublishedTechnicalSpec(original, trace, item.field, item.value), "reused");
    assert.equal(classifyPublishedTechnicalSpec(original, trace, item.field, `${item.value} alterado`), "pending");
    assert.equal(classifyPublishedTechnicalSpec({ ...original, year: "2010" }, trace, item.field, item.value), "pending");
    assert.equal(classifyPublishedTechnicalSpec({ ...original, model: "MODELO INCOMPATIBLE" }, trace,
      item.field, item.value), "pending");
    assert.equal(classifyPublishedTechnicalSpec(original, { ...trace, originalRecordSha256: "0".repeat(64) },
      item.field, item.value), "pending");
  }
});

test("fase 53: no aceptamos identidades documentales ni afirmaciones sustituidas aunque se recalculen hashes", async () => {
  const catalog = await readPortableOriginal(process.cwd(), "mercaeleva");
  for (const item of cases) {
    const original = catalog.products.find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    const entry = trace.entries.find((candidate) => candidate.field === item.field);
    assert.ok(entry && entry.scope === "model-document" && entry.verification);
    const revised = { ...entry.document, url: `${entry.document.url}?revision=no-acreditada` };
    const swappedDocument = { ...entry, document: revised, verification: {
      ...entry.verification,
      claimSha256: technicalDocumentClaimSha256(revised, item.field, item.value,
        entry.verification.reviewedOn, entry.verification.support)
    } };
    assert.ok(isProductTechnicalProvenance(override(trace, item.field, swappedDocument)));
    assert.equal(classifyPublishedTechnicalSpec(original, override(trace, item.field, swappedDocument),
      item.field, item.value), "pending");
    const alteredSupport = "afirmación externa sin cotejo";
    const swappedProof = { ...entry, verification: {
      ...entry.verification, support: alteredSupport,
      claimSha256: technicalDocumentClaimSha256(entry.document, item.field, item.value,
        entry.verification.reviewedOn, alteredSupport)
    } };
    assert.ok(isProductTechnicalProvenance(override(trace, item.field, swappedProof)));
    assert.equal(classifyPublishedTechnicalSpec(original, override(trace, item.field, swappedProof),
      item.field, item.value), "pending");
    assert.equal(reviewedModelDocumentVerification({ ...entry.document, model: "variante-distinta" },
      item.field, item.value), null);
    assert.equal(reviewedModelDocumentVerification(entry.document, item.field, `${item.value} falso`), null);
  }
});

test("fase 53: las tres specs retiradas no heredan acreditaciones", async () => {
  const [mercaeleva, gam] = await Promise.all([
    readPortableOriginal(process.cwd(), "mercaeleva"), readPortableOriginal(process.cwd(), "gam")
  ]);
  for (const item of [
    { reference: "M690-5522", field: "Anchura de plataforma", value: "1,42 m" },
    { reference: "M879-4639", field: "Centro de carga (mm)", value: "600 mm" }
  ] as const) {
    const original = mercaeleva.products.find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    assert.equal(classifyPublishedTechnicalSpec(original, trace, item.field, item.value), "pending");
  }
  const yale = gam.products.find((candidate) => candidate.reference === "6994");
  assert.ok(yale);
  const trace = prepareSourceProduct(yale).technicalProvenance;
  assert.ok(trace);
  assert.equal(classifyPublishedTechnicalSpec(yale, trace, "Yale MP16 · Ancho exterior de horquillas", "680 mm"),
    "pending");
});
