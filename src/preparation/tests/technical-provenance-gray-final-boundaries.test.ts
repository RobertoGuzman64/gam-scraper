import assert from "node:assert/strict";
import test from "node:test";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";
import {
  isProductTechnicalProvenance, matchesTechnicalDocumentVerification, technicalDocumentClaimSha256
} from "../../contracts/technical-provenance.js";
import type {
  ProductTechnicalProvenance, TechnicalDocumentReference, TechnicalSpecEvidence
} from "../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { reviewedCatalogModelIdentity } from "../shared/technical/evidence/reviewed-catalog-model-identity.js";
import { reviewedModelDocumentVerification } from "../shared/technical/evidence/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../technical-spec-classification.js";

const replaceEvidence = (
  trace: ProductTechnicalProvenance, field: string, evidence: TechnicalSpecEvidence
): ProductTechnicalProvenance => ({
  ...trace, entries: trace.entries.map((entry) => entry.field === field ? evidence : entry)
});

const documentedClaim = (
  evidence: TechnicalSpecEvidence, document: TechnicalDocumentReference, support: string
): TechnicalSpecEvidence => {
  const reviewedOn = "2026-11-21";
  return {
    field: evidence.field, value: evidence.value, mechanism: evidence.mechanism,
    scope: "model-document", sourceField: null, sourceValue: null, document,
    verification: {
      kind: "reviewed-model-fact", reviewedOn, support,
      claimSha256: technicalDocumentClaimSha256(document, evidence.field, evidence.value, reviewedOn, support)
    }
  };
};

test("fase 54: la ficha Yale MP16 GAM-27465 no acredita la unidad desconocida del lote 17", async () => {
  const catalog = await readPortableOriginal(process.cwd(), "gam");
  const original = catalog.products.find((product) => product.reference === "6994");
  assert.ok(original);
  assert.equal(original.externalReference, "GAM-28543");
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace && isProductTechnicalProvenance(trace));
  assert.equal(trace.originalRecordSha256, originalRecordFingerprint(original));
  const field = "Yale MP16 · Ancho exterior de horquillas";
  const entry = trace.entries.find((item) => item.field === field);
  assert.ok(entry);
  assert.equal(entry.value, "680 mm");
  assert.equal(entry.scope, "unknown");
  const document = {
    url: "https://online.gamrentals.com/en/electric-pallets/6030-2021-yale-mp16-a428",
    brand: "Yale", model: "MP16"
  };
  assert.equal(reviewedCatalogModelIdentity(original, document.url), null);
  assert.equal(reviewedModelDocumentVerification(document, field, entry.value), null);
  const claim = documentedClaim(entry, document, "GAM-27465, serie A428T12632V: exterior de horquillas 680 mm; ficha de otra unidad que también enumera 800x670 mm");
  assert.ok(claim.scope === "model-document" && claim.verification);
  assert.ok(matchesTechnicalDocumentVerification(document, field, entry.value, claim.verification));
  assert.ok(isProductTechnicalProvenance(replaceEvidence(trace, field, claim)));
  assert.equal(classifyPublishedTechnicalSpec(original, replaceEvidence(trace, field, claim), field, entry.value), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, entry.value), "pending");
});

test("fase 54: las dos cestas disponibles en Genie no demuestran el montaje de M690-5522", async () => {
  const catalog = await readPortableOriginal(process.cwd(), "mercaeleva");
  const original = catalog.products.find((product) => product.reference === "M690-5522");
  assert.ok(original);
  assert.equal(original.model, "Z-34/22");
  assert.equal(original.year, "2019");
  assert.equal(original.serialNumber, null);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace && isProductTechnicalProvenance(trace));
  const field = "Anchura de plataforma";
  const entry = trace.entries.find((item) => item.field === field);
  assert.ok(entry);
  assert.equal(entry.value, "1,42 m");
  const document = {
    url: "https://www.genielift.com/docs/default-source/product-specifications/articulated-boom-lift/en/z-3422ic_spec_2019.pdf",
    brand: "Genie", model: "Z-34/22"
  };
  assert.equal(reviewedModelDocumentVerification(document, field, "1,42 m"), null);
  assert.equal(reviewedModelDocumentVerification(document, field, "1,17 m"), null);
  const claim = documentedClaim(entry, document, "Genie Z-34/22 IC 2019, página 2: plataforma estándar de 1,42 m y alternativa de 1,17 m; unidad sin configuración verificada");
  assert.ok(claim.scope === "model-document" && claim.verification);
  assert.ok(matchesTechnicalDocumentVerification(document, field, entry.value, claim.verification));
  assert.ok(isProductTechnicalProvenance(replaceEvidence(trace, field, claim)));
  assert.equal(classifyPublishedTechnicalSpec(original, replaceEvidence(trace, field, claim), field, entry.value), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, entry.value), "pending");
});

test("fase 54: una ficha EDP 20 o EDP 2000 INOX no acredita el Stöcklin EDP-2000 publicado", async () => {
  const catalog = await readPortableOriginal(process.cwd(), "mercaeleva");
  const original = catalog.products.find((product) => product.reference === "M879-4639");
  assert.ok(original);
  assert.equal(original.model, "EDP-2000");
  assert.equal(original.serialNumber, null);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace && isProductTechnicalProvenance(trace));
  const field = "Centro de carga (mm)";
  const entry = trace.entries.find((item) => item.field === field);
  assert.ok(entry);
  assert.equal(entry.value, "600 mm");
  const documents = [
    {
      url: "https://www.stoecklin.com/fileadmin/user_upload/Produktdatenbl%C3%A4tter/2.2.4_Produktdatenbl%C3%A4tter_Inox-Kompetenz/Deutsch/EDP_2000_Inox_web_de.pdf",
      brand: "Stöcklin", model: "EDP 2000 INOX"
    },
    {
      url: "https://www.nhk-stapler.de/media/pages/produkte/stoecklin/niederhubwagen/3522de263b-1698911630/edp_20_de_web.pdf",
      brand: "Stöcklin", model: "EDP 20"
    }
  ] as const;
  for (const document of documents) {
    assert.equal(reviewedModelDocumentVerification(document, field, entry.value), null);
    const claim = documentedClaim(entry, document, "Ficha de fabricante para otra variante: Lastschwerpunktabstand c = 600 mm");
    assert.ok(claim.scope === "model-document" && claim.verification);
    assert.ok(matchesTechnicalDocumentVerification(document, field, entry.value, claim.verification));
    assert.ok(isProductTechnicalProvenance(replaceEvidence(trace, field, claim)));
    assert.equal(classifyPublishedTechnicalSpec(original, replaceEvidence(trace, field, claim), field, entry.value), "pending");
    const mistakenModel = documentedClaim(entry, { ...document, model: "EDP-2000" },
      "Valor 600 mm de otra variante, no de la referencia publicada");
    assert.ok(mistakenModel.scope === "model-document" && mistakenModel.verification);
    assert.ok(matchesTechnicalDocumentVerification(mistakenModel.document, field, entry.value, mistakenModel.verification));
    assert.equal(classifyPublishedTechnicalSpec(original, replaceEvidence(trace, field, mistakenModel), field, entry.value), "pending");
  }
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, entry.value), "pending");
});
