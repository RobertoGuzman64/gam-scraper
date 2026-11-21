import assert from "node:assert/strict";
import test from "node:test";
import { inspectTechnicalProvenanceCoverage } from "../technical-provenance-coverage.js";
import { summarizeGrayProvenance } from "../gray-provenance-audit.js";

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


test("fase 55: equivalencia motor e histórico cuantifica deuda de publicación y bloquea la poda", async () => {
  const report = await inspectTechnicalProvenanceCoverage(process.cwd());
  const equivalence = report.equivalence;
  assert.equal(equivalence.mode, "motor-offline-rehearsal");
  assert.equal(report.classificationChanged, false);
  assert.deepEqual(equivalence.historical, { own: 1942, reused: 850, pending: 106 });
  assert.deepEqual(equivalence.motor, { own: 1840, reused: 334, pending: 724 });
  assert.deepEqual(equivalence.byHistorical, {
    own: { own: 1821, reused: 0, pending: 121 },
    reused: { own: 0, reused: 250, pending: 600 },
    pending: { own: 19, reused: 84, pending: 3 }
  });
  assert.equal(equivalence.resolvedPending, 103);
  assert.equal(equivalence.unresolvedPending, 3);
  assert.equal(equivalence.unresolvedCases.length, 3);
  assert.deepEqual(equivalence.unresolvedBlockers, {
    "model-document-not-verified": 1,
    "unattributed": 1,
    "unit-document-not-verified": 1
  });
  assert.equal(equivalence.unresolvedCases.filter((item) => item.providerId === "gam").length, 1);
  assert.equal(equivalence.unresolvedCases.filter((item) => item.providerId === "mercaeleva").length, 2);
  assert.equal(equivalence.historicalAtRisk, 721);
  assert.equal(equivalence.differences.length, 824);
  assert.equal(report.totals.historicalEmitted, 0);
  assert.equal(equivalence.providers.length, report.providers.length);
  assert.equal(equivalence.providers.reduce((sum, item) => sum + item.resolvedPending, 0),
    equivalence.resolvedPending);
  assert.equal(equivalence.providers.reduce((sum, item) => sum + item.unresolvedPending, 0),
    equivalence.unresolvedPending);
  assert.equal(equivalence.providers.reduce((sum, item) => sum + item.historicalAtRisk, 0),
    equivalence.historicalAtRisk);
  assert.equal(equivalence.differences.filter((item) => item.historical === "pending" && item.motor !== "pending").length,
    equivalence.resolvedPending);
  assert.equal(equivalence.differences.filter((item) => item.historical !== "pending" && item.motor === "pending").length,
    equivalence.historicalAtRisk);
  assert.equal(new Set(equivalence.differences.map((item) => JSON.stringify([
    item.providerId, item.reference, item.sourceUrl, item.field, item.value
  ]))).size, equivalence.differences.length);
  assert.ok(equivalence.differences.some((item) => item.providerId === "mercaeleva" &&
    item.reference === "M690-5522" && item.field === "Longitud de plataforma" &&
    item.historical === "pending" && item.motor === "reused" && item.reviewedFact));
  assert.ok(equivalence.historicalAtRisk > 0);
});
