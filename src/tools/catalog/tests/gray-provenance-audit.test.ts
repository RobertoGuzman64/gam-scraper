import assert from "node:assert/strict";
import test from "node:test";
import type { TechnicalSpecEvidence } from "../../../contracts/technical-provenance.js";
import { accreditedSourceRecord } from "../../../testing/domain-cases/accredited-source-samples.js";
import { evaluateGrayProvenance } from "../gray-provenance-evaluation.js";
import { grayProvenanceCsv, summarizeGrayProvenance } from "../gray-provenance-audit.js";
import type { GrayProvenanceCase } from "../technical-provenance-coverage.js";

const original = accreditedSourceRecord("gam-original", "4013");
const mechanism = "src/preparation/gam/technical/models/documented-warehouse-cleaning-and-lifting-specs.ts";
const field = "Depósito de recuperación";
const value = "200 l";
const document = { url: "https://example.org/technical/model", brand: original.brand, model: original.model };
const source: TechnicalSpecEvidence = { field, value, mechanism, scope: "model-document",
  sourceField: null, sourceValue: null, document };

test("fase 24: un documento de modelo no acredita automáticamente la gris", () => {
  const assessment = evaluateGrayProvenance(original, field, value, source);
  assert.equal(assessment.blocker, "model-document-not-verified");
  assert.equal(assessment.documentUrl, document.url);
  assert.equal(evaluateGrayProvenance(original, field, value,
    { ...source, scope: "unit-document", document: { ...document, url: original.url } }).blocker,
  "original-listing-without-value-proof");
  assert.equal(evaluateGrayProvenance(original, field, value,
    { ...source, scope: "unit-document" }).blocker, "unit-document-not-verified");
  assert.equal(evaluateGrayProvenance(original, field, value,
    { ...source, scope: "document-reference" }).blocker, "partial-document-identity");
  assert.equal(evaluateGrayProvenance(original, field, value,
    { field, value, mechanism, scope: "unknown", sourceField: null, sourceValue: null }).blocker, "unattributed");
  assert.equal(evaluateGrayProvenance(original, field, value, undefined).blocker, "not-reproduced");
});

test("fase 24: rechaza campo, valor, identidad o fuente propios adulterados", () => {
  assert.throws(() => evaluateGrayProvenance(original, "otro campo", value, source));
  assert.throws(() => evaluateGrayProvenance(original, field, "otro valor", source));
  assert.throws(() => evaluateGrayProvenance({ ...original, model: "VARIANTE DIFERENTE" }, field, value, source));
  assert.throws(() => evaluateGrayProvenance(original, field, value,
    { field, value, mechanism, scope: "unit", sourceField: "year", sourceValue: "año inventado" }));
  assert.equal(evaluateGrayProvenance({ ...original, specs: { ...original.specs, Campo: "valor" } }, field, value,
    { field, value, mechanism, scope: "unit", sourceField: "Campo", sourceValue: "valor" }).blocker,
  "original-field-replay-not-published");
});

test("fase 24: agrupa la investigación sin duplicar incorporaciones y exporta CSV escapado", () => {
  const sample: GrayProvenanceCase = { providerId: "gam", reference: original.reference,
    sourceUrl: original.url, originalRecordSha256: "a".repeat(64), field: 'Anchura "técnica"', value: "1,5\nmm",
    blocker: "model-document-not-verified", scope: "model-document",
    mechanism, documentUrl: document.url, sourceField: null };
  const audit = summarizeGrayProvenance([sample, { ...sample, field: "Altura" }]);
  assert.equal(audit.totals.gray, 2);
  assert.equal(audit.totals.products, 1);
  assert.equal(audit.totals.identifiedReference, 2);
  assert.equal(audit.groups.length, 1);
  assert.equal(audit.documents[0]?.additions, 2);
  assert.equal(audit.documents[0]?.products, 1);
  assert.match(grayProvenanceCsv(audit.cases), /"Anchura ""técnica""","1,5\nmm"/u);
  assert.throws(() => summarizeGrayProvenance([sample, sample]), /duplicada/u);
});
