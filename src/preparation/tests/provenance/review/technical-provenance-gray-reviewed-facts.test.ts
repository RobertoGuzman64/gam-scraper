import assert from "node:assert/strict";
import test from "node:test";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification } from "../../../../contracts/technical-provenance.js";
import type { TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentVerification } from "../../../technical/evidence/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const phase38DocumentCases = [
  { providerId: "gam", reference: "5918", fields: ["Número de plazas del modelo"] },
  { providerId: "gam", reference: "237", fields: ["Propulsión", "Descenso de carga"] },
  { providerId: "gam", reference: "2266", fields: ["Rotación del cabezal trilateral"] },
  { providerId: "gam", reference: "4817", fields: ["Tracción"] },
  { providerId: "mercaeleva", reference: "M913-0641", fields: ["Altura máxima de descarga"] }
] as const;

test("fase 38: seis acreditaciones nuevas requieren ficha exacta y afirmación documental comprobable", async () => {
  let verified = 0;
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const originals = await readPortableOriginal(process.cwd(), providerId);
    for (const item of phase38DocumentCases.filter((entry) => entry.providerId === providerId)) {
      const original = originals.products.find((candidate) => candidate.reference === item.reference);
      assert.ok(original);
      const before = JSON.stringify(original);
      const emitted = prepareSourceProduct(original).technicalProvenance;
      assert.ok(emitted);
      assert.ok(isProductTechnicalProvenance(emitted));
      assert.equal(emitted.originalRecordSha256, originalRecordFingerprint(original));
      assert.equal(JSON.stringify(original), before);
      for (const field of item.fields) {
        const entry: TechnicalSpecEvidence | undefined = emitted.entries.find((candidate) => candidate.field === field);
        assert.ok(entry);
        assert.equal(entry.scope, "model-document");
        assert.ok(entry.document);
        assert.ok(entry.verification);
        assert.equal(entry.document.brand, original.brand);
        assert.equal(entry.document.model, original.model);
        assert.deepEqual(reviewedModelDocumentVerification(entry.document, field, entry.value), entry.verification);
        assert.ok(matchesTechnicalDocumentVerification(entry.document, field, entry.value, entry.verification));
        assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, entry.value), "reused");
        assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, `${entry.value} modificado`), "pending");
        assert.equal(classifyPublishedTechnicalSpec({ ...original, model: "OTRO MODELO" }, emitted, field, entry.value), "pending");
        assert.equal(classifyPublishedTechnicalSpec(original, { ...emitted, originalRecordSha256: "0".repeat(64) }, field, entry.value), "pending");
        assert.equal(reviewedModelDocumentVerification({ ...entry.document, url: `${entry.document.url}-otra` }, field, entry.value), null);
        assert.equal(reviewedModelDocumentVerification({ ...entry.document, model: "OTRO MODELO" }, field, entry.value), null);
        assert.equal(reviewedModelDocumentVerification(entry.document, field, `${entry.value} modificado`), null);
        assert.ok(!matchesTechnicalDocumentVerification(entry.document, field, entry.value,
          { ...entry.verification, support: "evidencia alterada" }));
        verified++;
      }
    }
  }
  assert.equal(verified, 6);
});

test("fase 52: las referencias de otras máquinas del lote no heredan la identidad acreditada", async () => {
  const gam = await readPortableOriginal(process.cwd(), "gam");
  const cases = [
    { reference: "6971", fields: ["UniCarriers A1N1L18Q · Capacidad de carga", "UniCarriers A1N1L18Q · Altura de elevación"] }
  ] as const;
  for (const item of cases) {
    const original = gam.products.find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    const emitted = prepareSourceProduct(original).technicalProvenance;
    assert.ok(emitted);
    for (const field of item.fields) {
      const entry: TechnicalSpecEvidence | undefined = emitted.entries.find((candidate) => candidate.field === field);
      assert.ok(entry, `${item.reference}: ${field}`);
      assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, entry.value), "pending", `${item.reference}: ${field}`);
    }
  }
});

test("fase 38: una ficha con fuentes técnicas distintas conserva las acreditaciones anteriores", async () => {
  const originals = await readPortableOriginal(process.cwd(), "mercaeleva");
  const original = originals.products.find((candidate) => candidate.reference === "M913-0641");
  assert.ok(original);
  const emitted = prepareSourceProduct(original).technicalProvenance;
  assert.ok(emitted);
  const expected = [
    { field: "Profundidad máxima de excavación", url: "https://kuk.kubota-eu.com/constructionmachinery/products/u27-4/" },
    { field: "Anchura (mm)", url: "https://kuk.kubota-eu.com/constructionmachinery/products/u27-4/" },
    { field: "Fuerza máxima de excavación en cuchara", url: "https://kuk.kubota-eu.com/constructionmachinery/products/u27-4/" },
    { field: "Alcance máximo de excavación", url: "https://kuk.kubota-eu.com/constructionmachinery/products/u27-4/" },
    { field: "Altura máxima de descarga", url: "https://kubota.com.au/product/excavator-u27-4/" }
  ] as const;
  for (const { field, url } of expected) {
    const entry: TechnicalSpecEvidence | undefined = emitted.entries.find((candidate) => candidate.field === field);
    assert.ok(entry);
    assert.ok(entry.document);
    assert.equal(entry.document.url, url);
    assert.ok(entry.verification);
    assert.equal(classifyPublishedTechnicalSpec(original, emitted, field, entry.value), "reused");
  }
});
