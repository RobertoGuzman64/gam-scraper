import assert from "node:assert/strict";
import test from "node:test";
import { inspectTechnicalProvenanceCoverage } from "../technical-provenance-coverage.js";
import { summarizeGrayProvenance } from "../gray-provenance-audit.js";
import { compareTechnicalFields } from "../../../panel/explorer/field-differences.js";

test("fase 18: cobertura offline separa traza reproducible, fuente acreditada y publicación histórica", async () => {
  const report = await inspectTechnicalProvenanceCoverage(process.cwd());
  assert.equal(report.mode, "historical-rehearsal");
  assert.equal(report.classificationChanged, false);
  assert.equal(report.providers.length, 3);
  assert.equal(report.totals.additions, report.providers.reduce((sum, item) => sum + item.additions, 0));
  assert.equal(report.totals.replayed + report.totals.missing, report.totals.additions);
  assert.equal(report.totals.unitSource + report.totals.modelDocument + report.totals.unitDocument +
    report.totals.documentReference + report.totals.unknownSource, report.totals.replayed);
  assert.equal(report.totals.classification.own + report.totals.classification.reused +
    report.totals.classification.pending, report.totals.additions);
  assert.ok(report.totals.unitSource > 0);
  assert.ok(report.totals.unknownSource > 0);
  assert.ok(report.totals.modelDocument > 0);
  assert.ok(report.totals.reviewedModelFacts >= 204);
  assert.equal(report.totals.reviewedModelFactsByClassification.own, 0);
  assert.ok(report.totals.reviewedModelFactsByClassification.reused >= 204);
  assert.equal(report.totals.reviewedModelFactsByClassification.reused +
    report.totals.reviewedModelFactsByClassification.pending, report.totals.reviewedModelFacts);
  assert.ok(report.totals.unitDocument > 0);
  assert.ok(report.totals.documentReference > 0);
  assert.equal(report.totals.modelDocumentByClassification.own + report.totals.modelDocumentByClassification.reused +
    report.totals.modelDocumentByClassification.pending, report.totals.modelDocument);
  assert.equal(report.totals.unitDocumentByClassification.own + report.totals.unitDocumentByClassification.reused +
    report.totals.unitDocumentByClassification.pending, report.totals.unitDocument);
  assert.equal(report.totals.documentReferenceByClassification.own +
    report.totals.documentReferenceByClassification.reused +
    report.totals.documentReferenceByClassification.pending, report.totals.documentReference);
  assert.equal(report.totals.unitByClassification.own + report.totals.unitByClassification.reused +
    report.totals.unitByClassification.pending, report.totals.unitSource);
  assert.equal(report.totals.unknownByClassification.own + report.totals.unknownByClassification.reused +
    report.totals.unknownByClassification.pending, report.totals.unknownSource);
  assert.equal(report.totals.missingByClassification.own + report.totals.missingByClassification.reused +
    report.totals.missingByClassification.pending, report.totals.missing);
  assert.equal(Object.values(report.unattributedMechanisms).reduce((sum, count) => sum + count, 0),
    report.totals.unknownSource);
  assert.equal(report.grayCases.length, report.totals.classification.pending);
  assert.equal(Object.values(report.grayBlockers).reduce((sum, count) => sum + (count ?? 0), 0),
    report.totals.classification.pending);
  const audit = summarizeGrayProvenance(report.grayCases);
  assert.equal(audit.totals.gray, report.totals.classification.pending);
  assert.equal(audit.totals.identifiedReference + audit.totals.noReference, audit.totals.gray);
  assert.ok(audit.groups.length > 0);
  assert.ok(audit.documents.length > 0);
  assert.equal(new Set(audit.cases.map((item) => JSON.stringify([
    item.providerId, item.reference, item.sourceUrl, item.field
  ]))).size, audit.totals.gray);
  assert.equal(report.totals.unitByClassification.reused, 0);

  assert.ok(Object.keys(report.mechanisms).some((key) =>
    key === "src/preparation/gam/technical/models/documented-modula-storage-specs.ts"));
  assert.ok(Object.keys(report.mechanisms).some((key) =>
    key === "src/preparation/mercaeleva/technical/evidence/documented-platform-technical-specs.ts"));
});


test("equivalencia motor y explorador preserva pendiente y separa tres retiradas", async () => {
  const report = await inspectTechnicalProvenanceCoverage(process.cwd());
  const equivalence = report.equivalence;
  assert.equal(equivalence.mode, "motor-offline-rehearsal");
  assert.equal(report.classificationChanged, false);
  const expected = { own: 1840, reused: 334, pending: 724 };
  assert.deepEqual(equivalence.historical, expected);
  assert.deepEqual(equivalence.motor, expected);
  assert.deepEqual(equivalence.byHistorical, {
    own: { own: 1840, reused: 0, pending: 0 },
    reused: { own: 0, reused: 334, pending: 0 },
    pending: { own: 0, reused: 0, pending: 724 }
  });
  assert.equal(equivalence.resolvedPending, 0);
  assert.equal(equivalence.unresolvedPending, 724);
  assert.equal(equivalence.unresolvedCases.length, 724);
  assert.equal(equivalence.historicalAtRisk, 0);
  assert.equal(equivalence.differences.length, 0);
  assert.equal(report.totals.historicalEmitted, 0);
  assert.equal(equivalence.providers.length, report.providers.length);
  assert.equal(equivalence.providers.reduce((sum, item) => sum + item.unresolvedPending, 0),
    equivalence.unresolvedPending);
  assert.equal(Object.values(equivalence.unresolvedBlockers).reduce((sum, count) => sum + count, 0),
    equivalence.unresolvedPending);
  assert.equal(report.withdrawn.fromPreparation, 3);
  assert.equal(report.withdrawn.stillInHistoricalPublication, 3);
  assert.deepEqual(report.withdrawn.cases.map((item) => [item.providerId, item.reference, item.field, item.value]), [
    ["gam", "6994", "Yale MP16 · Ancho exterior de horquillas", "680 mm"],
    ["mercaeleva", "M690-5522", "Anchura de plataforma", "1,42 m"],
    ["mercaeleva", "M879-4639", "Centro de carga", "600 mm"]
  ]);
  assert.ok(report.withdrawn.cases.every((item) => item.published));
  for (const withdrawn of report.withdrawn.cases) {
    const added = compareTechnicalFields({}, { [withdrawn.field]: withdrawn.value })
      .find((item) => item.change === "added");
    assert.ok(added);
    assert.ok(equivalence.unresolvedCases.some((item) => item.providerId === withdrawn.providerId &&
      item.reference === withdrawn.reference && item.field === added.field && item.value === withdrawn.value));
  }
});
