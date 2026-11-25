import assert from "node:assert/strict";
import test from "node:test";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification, matchesTechnicalUnitListingVerification,
  technicalDocumentClaimSha256, technicalUnitListingClaimSha256 } from "../../../../contracts/technical-provenance.js";
import type { ProductTechnicalProvenance, TechnicalDocumentReference, TechnicalDocumentVerification, TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentVerification } from "../../../technical/evidence/reviewed-model-claims.js";
import { reviewedUnitListingVerification } from "../../../technical/evidence/reviewed-unit-listing-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const cases = [
  { reference: "6806", kind: "own", fields: [
    ["Potencia de motor publicada para la unidad", "15,6 kW"],
    ["Sistema de frenos anunciado", "Disco delantero y tambor trasero"],
    ["Tipo de motor anunciado", "Eléctrico sin escobillas"]
  ] },
  { reference: "2185", kind: "reused", fields: [
    ["Dirección", "Eléctrica"],
    ["Velocidad máxima de desplazamiento", "9,6 km/h"]
  ] },
  { reference: "5254", kind: "reused", fields: [
    ["Caja de cambios del modelo", "Manual de 4 velocidades"],
    ["Distancia entre ejes del modelo", "2769 mm"],
    ["Tipo de tracción", "4x4 conectable"]
  ] }
] as const;

test("fase 51: ocho incorporaciones se acreditan sin alterar el original ni los valores", async () => {
  const { products } = await readPortableOriginal(process.cwd(), "gam");
  let credited = 0;
  for (const item of cases) {
    const original = products.find((product) => product.reference === item.reference);
    assert.ok(original);
    const unchanged = JSON.stringify(original);
    const prepared = prepareSourceProduct(original);
    const trace = prepared.technicalProvenance;
    assert.ok(trace && isProductTechnicalProvenance(trace));
    assert.equal(JSON.stringify(original), unchanged);
    for (const [field, value] of item.fields) {
      assert.equal(prepared.product.spec[field], value);
      const entry: TechnicalSpecEvidence | undefined = trace.entries.find((candidate) => candidate.field === field);
      assert.ok(entry);
      assert.equal(entry.value, value);
      assert.equal(classifyPublishedTechnicalSpec(original, trace, field, value), item.kind);
      assert.equal(entry.scope, item.kind === "own" ? "unit-document" : "model-document");
      assert.ok(entry.scope === "unit-document" || entry.scope === "model-document");
      assert.ok(entry.verification);
      if (entry.scope === "unit-document") {
        assert.deepEqual(entry.document, { url: original.url, brand: original.brand, model: original.model });
        assert.deepEqual(reviewedUnitListingVerification(original, entry.document, field, value), entry.verification);
        assert.ok(matchesTechnicalUnitListingVerification(entry.document, trace.originalRecordSha256,
          field, value, entry.verification));
      } else {
        assert.deepEqual(reviewedModelDocumentVerification(entry.document, field, value), entry.verification);
        assert.ok(matchesTechnicalDocumentVerification(entry.document, field, value, entry.verification));
      }
      credited++;
    }
  }
  assert.equal(credited, 8);
});

test("fase 51: un hash recalculado no valida documento, afirmación o identidad falsificados", async () => {
  const { products } = await readPortableOriginal(process.cwd(), "gam");
  for (const item of cases) {
    const original = products.find((product) => product.reference === item.reference);
    assert.ok(original);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    for (const [field, value] of item.fields) {
      const entry: TechnicalSpecEvidence | undefined = trace.entries.find((candidate) => candidate.field === field);
      assert.ok(entry && (entry.scope === "unit-document" || entry.scope === "model-document") && entry.verification);
      const withEntry = (replacement: TechnicalSpecEvidence): ProductTechnicalProvenance => ({ ...trace,
        entries: trace.entries.map((candidate) => candidate.field === field ? replacement : candidate)
      });
      assert.equal(classifyPublishedTechnicalSpec({ ...original, title: `${original.title} modificado` },
        trace, field, value), "pending");
      assert.equal(classifyPublishedTechnicalSpec({ ...original, model: "OTRO MODELO" },
        trace, field, value), "pending");
      assert.equal(classifyPublishedTechnicalSpec(original, trace, field, `${value} modificado`), "pending");
      const verification: TechnicalDocumentVerification = entry.verification;
      const forgery = (document: TechnicalDocumentReference, support: string): TechnicalDocumentVerification => ({
        ...verification,
        support,
        claimSha256: entry.scope === "unit-document"
          ? technicalUnitListingClaimSha256(document, trace.originalRecordSha256, field, value,
              verification.reviewedOn, support)
          : technicalDocumentClaimSha256(document, field, value, verification.reviewedOn, support)
      });
      const replacedDocument: TechnicalDocumentReference = { ...entry.document, url: `${entry.document.url}?otra=edicion` };
      assert.equal(classifyPublishedTechnicalSpec(original,
        withEntry({ ...entry, document: replacedDocument,
          verification: forgery(replacedDocument, verification.support) }), field, value), "pending");
      assert.equal(classifyPublishedTechnicalSpec(original,
        withEntry({ ...entry, verification: forgery(entry.document, "Afirmación falsa rehasheada") }),
        field, value), "pending");
      const { verification: unused, ...unverified } = entry;
      assert.ok(unused);
      assert.equal(classifyPublishedTechnicalSpec(original, withEntry(unverified), field, value), "pending");
    }
  }
});

test("fase 51: no se acredita una variante distinta ni quedan asociadas specs de otra ficha", async () => {
  const { products } = await readPortableOriginal(process.cwd(), "gam");
  const sources = ["6806", "2185", "5254"];
  for (const reference of sources) {
    const original = products.find((item) => item.reference === reference);
    assert.ok(original);
    const mutated = { ...original, specs: { ...original.specs, Longitud: "3620 mm" } };
    for (const [field, value] of cases.find((item) => item.reference === reference)?.fields ?? []) {
      const fresh = prepareSourceProduct(mutated).technicalProvenance;
      assert.ok(fresh);
      assert.equal(classifyPublishedTechnicalSpec(mutated, fresh, field, value), "pending");
    }
  }
  const original = products.find((item) => item.reference === "6994");
  assert.ok(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  for (const [field, value, expected] of [
    ["Yale MP16 · Accionamiento", "Eléctrico", "reused"],
    ["Yale MP16 · Ancho exterior de horquillas", "680 mm", "pending"]
  ] as const) {
    assert.equal(classifyPublishedTechnicalSpec(original, trace, field, value), expected);
  }
});
