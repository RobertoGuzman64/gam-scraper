import assert from "node:assert/strict";
import test from "node:test";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import {
  isProductTechnicalProvenance, matchesTechnicalUnitListingVerification, technicalUnitListingClaimSha256
} from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/portable-original.js";
import type { ProductTechnicalProvenance, TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedUnitListingVerification } from "../../../technical/reviewed-unit-listing-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const reviewedLots = [
  { reference: "6993", fields: [
    ["JLG E300AJP · Altura de elevación anunciada", "11 m"],
    ["JLG E300AJP · Capacidad de cesta", "230 kg"],
    ["Haulotte Optimum 8 · Altura de elevación anunciada", "8 m"],
    ["Haulotte Optimum 8 · Capacidad de plataforma", "230 kg"]
  ] },
  { reference: "6994", fields: [
    ["Yale ERP16VT MWB · Altura de elevación anunciada", "5.500 mm"],
    ["Yale ERP16VT MWB · Capacidad de carga", "1.600 kg"]
  ] },
  { reference: "6995", fields: [
    ["Hyster S1.2 · Altura de elevación anunciada", "3.500 mm"],
    ["Hyster S1.2 · Capacidad de carga", "1.200 kg"],
    ["Yale ERP18VT MWB · Capacidad de carga", "1.800 kg"],
    ["Yale ERP18VT MWB · Tipo de carretilla", "Eléctrica triciclo"]
  ] }
] as const;

test("fase 50: diez afirmaciones verificadas de tres lotes se acreditan como datos de sus propias fichas", async () => {
  const originals = await readPortableOriginal(process.cwd(), "gam");
  let accredited = 0;
  for (const { reference, fields } of reviewedLots) {
    const original = originals.products.find((item) => item.reference === reference);
    assert.ok(original);
    assert.equal(original.brand, null);
    assert.equal(original.model, null);
    assert.equal(original.title, `Lote ${reference === "6993" ? "16" : reference === "6994" ? "17" : "18"}`);
    const unchanged = JSON.stringify(original);
    const prepared = prepareSourceProduct(original);
    assert.equal(JSON.stringify(original), unchanged);
    const trace = prepared.technicalProvenance;
    assert.ok(trace);
    assert.ok(isProductTechnicalProvenance(trace));
    assert.equal(trace.originalRecordSha256, originalRecordFingerprint(original));
    for (const [field, value] of fields) {
      assert.equal(prepared.product.spec[field], value);
      const entry: TechnicalSpecEvidence | undefined = trace.entries.find((candidate) => candidate.field === field);
      assert.ok(entry);
      assert.equal(entry.value, value);
      assert.equal(entry.scope, "unit-document");
      assert.ok(entry.scope === "unit-document");
      assert.deepEqual(entry.document, { url: original.url, brand: null, model: null });
      assert.ok(entry.verification);
      assert.equal(entry.verification.kind, "reviewed-unit-listing");
      assert.deepEqual(entry.verification,
        reviewedUnitListingVerification(original, entry.document, field, value));
      assert.ok(matchesTechnicalUnitListingVerification(entry.document, trace.originalRecordSha256,
        field, value, entry.verification));
      assert.equal(classifyPublishedTechnicalSpec(original, trace, field, value), "own");
      accredited += 1;
    }
  }
  assert.equal(accredited, 10);
});

test("fase 50: documentos, identidad, valores y pruebas cambiadas no acreditan una spec", async () => {
  const originals = await readPortableOriginal(process.cwd(), "gam");
  for (const { reference, fields } of reviewedLots) {
    const original = originals.products.find((item) => item.reference === reference);
    assert.ok(original);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    for (const [field, value] of fields) {
      const entry: TechnicalSpecEvidence | undefined = trace.entries.find((candidate) => candidate.field === field);
      assert.ok(entry && entry.scope === "unit-document" && entry.verification);
      assert.equal(classifyPublishedTechnicalSpec(original, trace, field, `${value} modificado`), "pending");
      assert.equal(classifyPublishedTechnicalSpec({ ...original, title: `${original.title} alterado` },
        trace, field, value), "pending");
      assert.equal(classifyPublishedTechnicalSpec({ ...original, reference: "otro-lote" },
        trace, field, value), "pending");
      assert.equal(classifyPublishedTechnicalSpec(original, {
        ...trace, originalRecordSha256: "0".repeat(64)
      }, field, value), "pending");

      const alteredDocument = { ...entry.document, url: `${entry.document.url}?edicion=otra` };
      const forgedDocument = { ...entry.verification, claimSha256: technicalUnitListingClaimSha256(
        alteredDocument, trace.originalRecordSha256, field, value,
        entry.verification.reviewedOn, entry.verification.support) };
      const changedDocument: ProductTechnicalProvenance = { ...trace, entries: trace.entries.map((candidate) =>
        candidate.field === field ? { ...entry, document: alteredDocument, verification: forgedDocument } : candidate) };
      assert.ok(isProductTechnicalProvenance(changedDocument));
      assert.equal(classifyPublishedTechnicalSpec(original, changedDocument, field, value), "pending");

      const support = "Afirmación que no figura en el anuncio original";
      const forgedSupport = { ...entry.verification, support, claimSha256: technicalUnitListingClaimSha256(
        entry.document, trace.originalRecordSha256, field, value, entry.verification.reviewedOn, support) };
      const changedSupport: ProductTechnicalProvenance = { ...trace, entries: trace.entries.map((candidate) =>
        candidate.field === field ? { ...entry, verification: forgedSupport } : candidate) };
      assert.ok(isProductTechnicalProvenance(changedSupport));
      assert.equal(classifyPublishedTechnicalSpec(original, changedSupport, field, value), "pending");
    }
  }
});

test("fase 50: campos no contrastados de los lotes permanecen pendientes", async () => {
  const originals = await readPortableOriginal(process.cwd(), "gam");
  const original = originals.products.find((item) => item.reference === "6994");
  assert.ok(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  for (const [field, value, expected] of [
    ["Yale MP16 · Accionamiento", "Eléctrico", "reused"],
    ["Yale MP16 · Ancho exterior de horquillas", "680 mm", "pending"]
  ] as const) {
    assert.equal(reviewedUnitListingVerification(original,
      { url: original.url, brand: null, model: null }, field, value), null);
    assert.equal(classifyPublishedTechnicalSpec(original, trace, field, value), expected);
  }
});
