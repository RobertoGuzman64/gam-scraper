import assert from "node:assert/strict";
import test from "node:test";
import { hasCompleteCatalogAuditEvidence, hasUnresolvedCatalogAuditContracts } from "../audit-closure.js";
import { analyzeDescriptionCoverage } from "../description-coverage.js";
import { analyzeDescriptionPriorities } from "../description-priorities.js";
import { analyzeEditorialQuality } from "../editorial-quality.js";
import { analyzeSpecificationCoverage } from "../specification-coverage.js";
import { formatCatalogAuditClosureReport } from "../../../cli/commands/catalog/catalog-audit-closure-report.js";

const emptyEditorial = analyzeEditorialQuality([]);
const coverage = analyzeDescriptionCoverage([]);
const priorities = analyzeDescriptionPriorities([], emptyEditorial, emptyEditorial);
const specifications = analyzeSpecificationCoverage([]);

const completeCoverage = { ...coverage, totals: { ...coverage.totals, products: 1 } };
const completeSpecifications = { ...specifications, totals: {
  ...specifications.totals, products: 1, canonicalOriginals: 1
} };

test("el cierre exige originales canónicos y cobertura completa, no recuentos históricos", () => {
  assert.equal(hasCompleteCatalogAuditEvidence(coverage, specifications), false);
  assert.equal(hasCompleteCatalogAuditEvidence(completeCoverage, completeSpecifications), true);
  assert.equal(hasCompleteCatalogAuditEvidence(completeCoverage, {
    ...completeSpecifications, totals: { ...completeSpecifications.totals, reconstructedSources: 1 }
  }), false);
  assert.equal(hasCompleteCatalogAuditEvidence(completeCoverage, {
    ...completeSpecifications, totals: { ...completeSpecifications.totals, canonicalOriginals: 0 }
  }), false);
});

test("las contradicciones y pérdidas bloquean el cierre; las observaciones no", () => {
  assert.equal(hasUnresolvedCatalogAuditContracts(completeCoverage, priorities, completeSpecifications), false);
  const observed = { ...completeSpecifications, totals: {
    ...completeSpecifications.totals, observationalMissing: 4
  } };
  assert.equal(hasUnresolvedCatalogAuditContracts(completeCoverage, priorities, observed), false);
  for (const key of ["sourceNotPreserved", "lostAfterPublication", "ambiguousNormalization", "pendingPublication"] as const) {
    assert.equal(hasUnresolvedCatalogAuditContracts(completeCoverage, priorities, {
      ...completeSpecifications, totals: { ...completeSpecifications.totals, [key]: 1 }
    }), true, key);
  }
  assert.equal(hasUnresolvedCatalogAuditContracts({ ...completeCoverage, totals: {
    ...completeCoverage.totals, pending: { ...completeCoverage.totals.pending, description: 1 }
  } }, priorities, completeSpecifications), true);
  assert.equal(hasUnresolvedCatalogAuditContracts(completeCoverage, { ...priorities, totals: {
    ...priorities.totals, technical: 1
  } }, completeSpecifications), true);
});

test("el informe distingue cierre conforme, alcance limitado y contratos pendientes", () => {
  const render = (specs: typeof completeSpecifications) =>
    formatCatalogAuditClosureReport(completeCoverage, priorities, specs).join("\n");
  assert.match(render(completeSpecifications), /CONFORME EN ALCANCE COMPARADO/);
  assert.match(render({ ...completeSpecifications, totals: {
    ...completeSpecifications.totals, canonicalOriginals: 0
  } }), /ALCANCE LIMITADO/);
  assert.match(render({ ...completeSpecifications, totals: {
    ...completeSpecifications.totals, sourceNotPreserved: 1
  } }), /REQUIERE INTERVENCIÓN/);
});
