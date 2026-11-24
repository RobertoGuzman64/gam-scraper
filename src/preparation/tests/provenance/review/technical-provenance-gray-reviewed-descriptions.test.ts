import assert from "node:assert/strict";
import test from "node:test";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification } from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentVerification } from "../../../technical/reviewed-model-claims.js";
import { reviewedUnitDescriptionEvidence } from "../../../technical/reviewed-unit-description-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const descriptionCases = [
  { reference: "243", facts: [
    { field: "Ruedas de carga", value: "Tándem", excerpt: "ruedas de carga tándem" },
    { field: "Timón y bomba de pistones", value: "Acero inoxidable", excerpt: "La transpaleta tiene el timón, la bomba de pistones, los ejes y el anclaje inoxidables." }
  ] },
  { reference: "244", facts: [
    { field: "Timón y bomba de pistones", value: "Acero inoxidable", excerpt: "La transpaleta tiene el timón, la bomba de pistones, los ejes y el anclaje inoxidables." },
    { field: "Restantes componentes exteriores", value: "Recubrimiento cromado", excerpt: "El resto de piezas cuentan con recubrimiento cromado." }
  ] },
  { reference: "6806", facts: [
    { field: "Batería anunciada", value: "Litio extraíble", excerpt: "su batería de litio es extraíble" }
  ] }
] as const;

const documentCases = [
  { reference: "M044-4093", fields: ["Altura de plataforma", "Alcance horizontal (m)"] },
  { reference: "M570-8735", fields: ["Centro de carga (mm)"] },
  { reference: "M484-4055", fields: ["Altura de plataforma", "Capacidad máxima de plataforma"] }
] as const;

test("fase 37: cinco incorporaciones proceden literalmente de tres fichas originales", async () => {
  const catalog = await readPortableOriginal(process.cwd(), "gam");
  let count = 0;
  for (const { reference, facts } of descriptionCases) {
    const original = catalog.products.find((item) => item.reference === reference);
    assert.ok(original);
    const before = JSON.stringify(original);
    const emitted = prepareSourceProduct(original).technicalProvenance;
    assert.ok(emitted);
    assert.ok(isProductTechnicalProvenance(emitted));
    assert.equal(emitted.originalRecordSha256, originalRecordFingerprint(original));
    assert.equal(JSON.stringify(original), before);
    for (const { field, value, excerpt } of facts) {
      assert.ok(original.longDescription?.includes(excerpt));
      assert.deepEqual(reviewedUnitDescriptionEvidence(original, field, value), {
        scope: "unit", sourceField: "longDescription", sourceValue: original.longDescription
      });
      const evidence: TechnicalSpecEvidence | undefined = emitted.entries.find((item) => item.field === field);
      assert.ok(evidence);
      assert.equal(evidence.value, value);
      assert.equal(evidence.scope, "unit");
      assert.equal(evidence.sourceField, "longDescription");
      assert.equal(evidence.sourceValue, original.longDescription);
      assert.equal(evidence.document, undefined);
      assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, value), "own");
      assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, `${value} modificado`), "pending");
      assert.equal(classifyPublishedTechnicalSpec({ ...original, title: `${original.title} alterado` },
        emitted, field, value), "pending");
      assert.equal(classifyPublishedTechnicalSpec(original,
        { ...emitted, originalRecordSha256: "0".repeat(64) }, field, value), "pending");
      const withoutExcerpt: ProductRecord = { ...original,
        longDescription: original.longDescription?.replace(excerpt, "") ?? null };
      assert.equal(reviewedUnitDescriptionEvidence(withoutExcerpt, field, value), null);
      assert.equal(reviewedUnitDescriptionEvidence({ ...original, reference: "otra" }, field, value), null);
      assert.equal(reviewedUnitDescriptionEvidence({ ...original, url: `${original.url}-otra` }, field, value), null);
      assert.equal(reviewedUnitDescriptionEvidence({ ...original, model: "OTRO MODELO" }, field, value), null);
      assert.equal(reviewedUnitDescriptionEvidence(original, field, `${value} alterado`), null);
      count += 1;
    }
  }
  assert.equal(count, 5);
});

test("fase 37: cinco datos técnicos quedan acreditados por documentos identificados", async () => {
  const catalog = await readPortableOriginal(process.cwd(), "mercaeleva");
  let count = 0;
  for (const { reference, fields } of documentCases) {
    const original = catalog.products.find((item) => item.reference === reference);
    assert.ok(original);
    const before = JSON.stringify(original);
    const emitted = prepareSourceProduct(original).technicalProvenance;
    assert.ok(emitted);
    assert.ok(isProductTechnicalProvenance(emitted));
    assert.equal(JSON.stringify(original), before);
    for (const field of fields) {
      const evidence: TechnicalSpecEvidence | undefined = emitted.entries.find((item) => item.field === field);
      assert.ok(evidence);
      assert.equal(evidence.scope, "model-document");
      assert.ok(evidence.document);
      assert.ok(evidence.verification);
      assert.equal(evidence.document.brand, original.brand);
      assert.equal(evidence.document.model, original.model);
      assert.deepEqual(reviewedModelDocumentVerification(evidence.document, field, evidence.value), evidence.verification);
      assert.equal(matchesTechnicalDocumentVerification(evidence.document, field, evidence.value,
        evidence.verification), true);
      assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, evidence.value), "reused");
      assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, `${evidence.value} alterado`), "pending");
      assert.equal(classifyPublishedTechnicalSpec({ ...original, model: "OTRO MODELO" },
        emitted, field, evidence.value), "pending");
      assert.equal(reviewedModelDocumentVerification({ ...evidence.document, url: `${evidence.document.url}-otra` },
        field, evidence.value), null);
      assert.equal(reviewedModelDocumentVerification({ ...evidence.document, model: "OTRO MODELO" },
        field, evidence.value), null);
      assert.equal(reviewedModelDocumentVerification(evidence.document, field, `${evidence.value} alterado`), null);
      assert.equal(matchesTechnicalDocumentVerification(evidence.document, field, evidence.value,
        { ...evidence.verification, support: "texto alterado" }), false);
      assert.equal(classifyPublishedTechnicalSpec(original, { ...emitted,
        originalRecordSha256: "0".repeat(64) }, field, evidence.value), "pending");
      count += 1;
    }
  }
  assert.equal(count, 5);
});
