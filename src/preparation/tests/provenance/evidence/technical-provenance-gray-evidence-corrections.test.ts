import assert from "node:assert/strict";
import test from "node:test";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification, technicalDocumentClaimSha256 } from "../../../../contracts/technical-provenance.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { TechnicalDocumentVerification, TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentVerification } from "../../../technical/reviewed-model-claims.js";
import { reviewedUnitDescriptionEvidence } from "../../../technical/reviewed-unit-description-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const documents = [
  {
    reference: "M432-1479", model: "U10.3", field: "Altura máxima de descarga", value: "2215 mm",
    url: "https://www.kubota.com/products/machinery/singapore/pdf/1117_U10-3_200dpi.pdf",
    previous: ["Profundidad máxima de excavación", "Anchura mínima del chasis", "Longitud de transporte", "Anchura máxima del chasis extendido"]
  },
  {
    reference: "M238-0251", model: "150AETJC", field: "Altura de plataforma", value: "13 m",
    url: "https://www.grupogalindoalquiler.es/wp-content/uploads/2017/06/manitou-150-aetjc.pdf",
    previous: ["Alcance horizontal (m)", "Capacidad máxima de plataforma", "Anchura (mm)"]
  }
] as const;

test("dos fichas documentales de edición identificada producen trazas acreditadas sin perder fuentes previas", async () => {
  const originals = await readPortableOriginal(process.cwd(), "mercaeleva");
  for (const item of documents) {
    const original = originals.products.find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    const snapshot = JSON.stringify(original);
    const emitted = prepareSourceProduct(original).technicalProvenance;
    assert.ok(emitted);
    assert.ok(isProductTechnicalProvenance(emitted));
    assert.equal(original.model, item.model);
    assert.equal(emitted.originalRecordSha256, originalRecordFingerprint(original));
    assert.equal(JSON.stringify(original), snapshot);
    const entry: TechnicalSpecEvidence | undefined = emitted.entries.find((candidate) => candidate.field === item.field);
    assert.ok(entry);
    assert.equal(entry.scope, "model-document");
    assert.equal(entry.value, item.value);
    assert.ok(entry.document);
    assert.ok(entry.verification);
    assert.equal(entry.document.url, item.url);
    assert.deepEqual(reviewedModelDocumentVerification(entry.document, item.field, item.value), entry.verification);
    assert.ok(matchesTechnicalDocumentVerification(entry.document, item.field, item.value, entry.verification));
    assert.equal(classifyPublishedTechnicalSpec(original, emitted, item.field, item.value), "reused");
    for (const field of item.previous) {
      const older: TechnicalSpecEvidence | undefined = emitted.entries.find((candidate) => candidate.field === field);
      assert.ok(older);
      assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, older.value), "reused");
      assert.notEqual(older.document?.url, item.url);
    }
    assert.equal(classifyPublishedTechnicalSpec(original, emitted, item.field, `${item.value} alterado`), "pending");
    assert.equal(classifyPublishedTechnicalSpec({ ...original, model: "OTRO MODELO" }, emitted, item.field, item.value), "pending");
    assert.equal(classifyPublishedTechnicalSpec(original, { ...emitted, originalRecordSha256: "0".repeat(64) }, item.field, item.value), "pending");
    assert.equal(reviewedModelDocumentVerification({ ...entry.document, url: `${entry.document.url}-falso` }, item.field, item.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...entry.document, model: "OTRO MODELO" }, item.field, item.value), null);
    const forgedSupport = "afirmación no contrastada";
    const forged: TechnicalDocumentVerification = { ...entry.verification, support: forgedSupport,
      claimSha256: technicalDocumentClaimSha256(entry.document, item.field, item.value,
        entry.verification.reviewedOn, forgedSupport) };
    assert.equal(classifyPublishedTechnicalSpec(original, { ...emitted,
      entries: emitted.entries.map((candidate) => candidate.field === item.field
        ? { ...candidate, verification: forged } : candidate)
    }, item.field, item.value), "pending");
  }
});

test("tracción XCMG procede de un fragmento literal de la descripción del vendedor y conserva identidad y fingerprint", async () => {
  const originals = await readPortableOriginal(process.cwd(), "gam");
  const original = originals.products.find((item) => item.reference === "4814");
  assert.ok(original);
  const field = "Tracción";
  const value = "4×4";
  const excerpt = "su sistema de tracción en las cuatro ruedas";
  assert.ok(original.longDescription?.includes(excerpt));
  const snapshot = JSON.stringify(original);
  const emitted = prepareSourceProduct(original).technicalProvenance;
  assert.ok(emitted);
  assert.ok(isProductTechnicalProvenance(emitted));
  assert.equal(emitted.originalRecordSha256, originalRecordFingerprint(original));
  assert.equal(JSON.stringify(original), snapshot);
  assert.deepEqual(reviewedUnitDescriptionEvidence(original, field, value), {
    scope: "unit", sourceField: "longDescription", sourceValue: original.longDescription
  });
  const entry: TechnicalSpecEvidence | undefined = emitted.entries.find((candidate) => candidate.field === field);
  assert.ok(entry);
  assert.equal(entry.value, value);
  assert.equal(entry.scope, "unit");
  assert.equal(entry.sourceField, "longDescription");
  assert.equal(entry.sourceValue, original.longDescription);
  assert.equal(entry.document, undefined);
  assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, value), "own");
  assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, "4x2"), "pending");
  assert.equal(classifyPublishedTechnicalSpec({ ...original, title: `${original.title} cambiado` }, emitted, field, value), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original, { ...emitted, originalRecordSha256: "0".repeat(64) }, field, value), "pending");
  const withoutExcerpt: ProductRecord = { ...original,
    longDescription: original.longDescription?.replaceAll(excerpt, "") ?? null };
  assert.equal(reviewedUnitDescriptionEvidence(withoutExcerpt, field, value), null);
  assert.equal(reviewedUnitDescriptionEvidence({ ...original, reference: "otra" }, field, value), null);
  assert.equal(reviewedUnitDescriptionEvidence({ ...original, url: `${original.url}-cambiada` }, field, value), null);
  assert.equal(reviewedUnitDescriptionEvidence(original, field, "4x2"), null);
  const documentedMotor = emitted.entries.find((candidate) => candidate.field === "Tipo de motor");
  assert.ok(documentedMotor);
  assert.equal(classifyPublishedTechnicalSpec(original, emitted, documentedMotor.field, documentedMotor.value), "reused");
});
