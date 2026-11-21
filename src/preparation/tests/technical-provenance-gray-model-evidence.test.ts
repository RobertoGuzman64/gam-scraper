import assert from "node:assert/strict";
import { test } from "node:test";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { classifyPublishedTechnicalSpec } from "../technical-spec-classification.js";
import { reviewedModelDocumentVerification } from "../shared/technical/evidence/reviewed-model-claims.js";
import { matchesTechnicalDocumentVerification, technicalDocumentClaimSha256 } from "../../contracts/technical-provenance.js";
import type { ProductTechnicalProvenance, TechnicalDocumentVerification, TechnicalSpecEvidence } from "../../contracts/technical-provenance.js";

const cases = [
  { provider: "gam", reference: "6690", model: "304 S CABRIOLET", fields: [
    "Caja de cambios", "Cilindrada del motor", "Potencia máxima DIN", "Tipo de tracción"
  ] },
  { provider: "mercaeleva", reference: "M329-6156", model: "SNAKE 2010 PLUS", fields: [
    "Anchura de plataforma", "Longitud de plataforma"
  ] },
  { provider: "mercaeleva", reference: "M061-0041", model: "200ATJ", fields: ["Altura de plataforma"] },
  { provider: "mercaeleva", reference: "M091-1956", model: "800AJ", fields: [
    "Anchura (mm)", "Capacidad máxima de plataforma"
  ] },
  { provider: "mercaeleva", reference: "M622-7084", model: "E600JP", fields: ["Anchura (mm)"] }
] as const;

const overwrite = (trace: ProductTechnicalProvenance, field: string, replacement: TechnicalSpecEvidence): ProductTechnicalProvenance => ({
  ...trace, entries: trace.entries.map((entry) => entry.field === field ? replacement : entry)
});

test("fase 36: diez acreditaciones ligadas a la ficha original y a un hecho documental exacto", async () => {
  const originals = await Promise.all([
    readPortableOriginal(process.cwd(), "gam"), readPortableOriginal(process.cwd(), "mercaeleva")
  ]);
  let count = 0;
  for (const item of cases) {
    const provider = originals.find((catalog) => catalog.providerId === item.provider);
    assert.ok(provider);
    const original = provider.products.find((product) => product.reference === item.reference);
    assert.ok(original);
    assert.equal(original.model, item.model);
    const prepared = prepareSourceProduct(original);
    const trace = prepared.technicalProvenance;
    assert.ok(trace);
    for (const field of item.fields) {
      const entry: TechnicalSpecEvidence | undefined = trace.entries.find((candidate) => candidate.field === field);
      assert.ok(entry);
      assert.equal(entry.scope, item.provider === "gam" ? "document-reference" : "model-document");
      if (entry.scope !== "model-document" && entry.scope !== "document-reference") continue;
      assert.ok(entry.verification);
      assert.ok(entry.value.length > 0);
      assert.equal(entry.document.model, original.model);
      assert.equal(entry.document.brand, original.brand);
      assert.ok(matchesTechnicalDocumentVerification(entry.document, field, entry.value, entry.verification));
      assert.deepEqual(reviewedModelDocumentVerification(entry.document, field, entry.value), entry.verification);
      assert.equal(classifyPublishedTechnicalSpec(original, trace, field, entry.value), "reused");
      count++;
    }
  }
  assert.equal(count, 10);
});

test("fase 36: identidad, documentación y huellas manipuladas no acreditan el campo", async () => {
  for (const item of cases) {
    const originals = await readPortableOriginal(process.cwd(), item.provider);
    const original = originals.products.find((product) => product.reference === item.reference);
    assert.ok(original);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    for (const field of item.fields) {
      const entry: TechnicalSpecEvidence | undefined = trace.entries.find((candidate) => candidate.field === field);
      assert.ok(entry && (entry.scope === "model-document" || entry.scope === "document-reference") && entry.verification);
      assert.equal(classifyPublishedTechnicalSpec({ ...original, model: "MODELO NO ACREDITADO" }, trace, field, entry.value), "pending");
      assert.equal(classifyPublishedTechnicalSpec({ ...original, title: `${original.title} alterado` }, trace, field, entry.value), "pending");
      assert.equal(classifyPublishedTechnicalSpec(original, trace, field, `${entry.value} alterado`), "pending");
      assert.equal(classifyPublishedTechnicalSpec(original,
        overwrite(trace, field, { ...entry, document: { ...entry.document, url: "https://no-es-la-fuente.test/" } }),
        field, entry.value), "pending");
      const { verification: removed, ...withoutVerification } = entry;
      assert.ok(removed);
      assert.equal(classifyPublishedTechnicalSpec(original, overwrite(trace, field, withoutVerification), field, entry.value), "pending");
      const support = "afirmación sin revisión con huella reconstruida";
      const forged: TechnicalDocumentVerification = { ...entry.verification, support,
        claimSha256: technicalDocumentClaimSha256(entry.document, field, entry.value, entry.verification.reviewedOn, support) };
      assert.ok(matchesTechnicalDocumentVerification(entry.document, field, entry.value, forged));
      assert.equal(classifyPublishedTechnicalSpec(original,
        overwrite(trace, field, { ...entry, verification: forged }), field, entry.value), "pending");
    }
  }
});

test("fase 53: variantes de almacén no verificadas permanecen pendientes", async () => {
  for (const item of [
    { provider: "mercaeleva", reference: "M879-4639", field: "Centro de carga (mm)" },
  ] as const) {
    const originals = await readPortableOriginal(process.cwd(), item.provider);
    const original = originals.products.find((product) => product.reference === item.reference);
    assert.ok(original);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    const entry = trace.entries.find((candidate) => candidate.field === item.field);
    assert.ok(entry);
    assert.equal("verification" in entry ? entry.verification : undefined, undefined);
    assert.equal(classifyPublishedTechnicalSpec(original, trace, item.field, entry.value), "pending");
  }
});
