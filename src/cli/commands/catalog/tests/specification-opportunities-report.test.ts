import assert from "node:assert/strict";
import test from "node:test";
import { formatSpecificationOpportunitiesReport } from "../specification-opportunities-report.js";
import type { SpecificationOpportunities } from "../../../../catalog/diagnostics/specification-opportunities.js";

const report: SpecificationOpportunities = {
  note: "Exploración, no obligación de publicación",
  criteria: { minimumTechnicalSpecs: 6, minimumModelPeers: 2 },
  totals: { belowTarget: 2, missingToTarget: 3, preparedEvidence: 0, sourceEvidence: 0,
    sameModelEvidence: 1, familyObservations: 0, withoutClues: 1 },
  cases: [
    { identity: "gam:ref:1", providerId: "gam", reference: "1", url: "https://example.com/1",
      title: "Equipo 1", family: "elevacion", origin: "original_canonico", technicalCount: 4,
      missingToTarget: 2, evidence: "mismo_modelo", preparedKeys: [], sourceKeys: [],
      sameModelKeys: ["Altura de trabajo (mm)"], familyKeys: [] },
    { identity: "gam:ref:2", providerId: "gam", reference: "2", url: "https://example.com/2",
      title: "Equipo 2", family: "elevacion", origin: "original_canonico", technicalCount: 5,
      missingToTarget: 1, evidence: "sin_pista", preparedKeys: [], sourceKeys: [], sameModelKeys: [], familyKeys: [] }
  ]
};

test("imprime el objetivo sin convertir pistas en incidencias y limita solo la vista textual", () => {
  const lines = formatSpecificationOpportunitiesReport(report, 1, true);
  assert.ok(lines.some((line) => line.includes("2 fichas por debajo")));
  assert.ok(lines.some((line) => line.includes("mismo modelo 1")));
  assert.ok(lines.some((line) => line.includes("TOP 1 de 2")));
  assert.ok(lines.some((line) => line.includes("Altura de trabajo (mm)")));
  assert.ok(lines.every((line) => !line.includes("https://example.com/2")));
  assert.equal(report.cases.length, 2);
  const brief = formatSpecificationOpportunitiesReport(report, 1);
  assert.equal(brief.length, 3);
  assert.ok(brief.every((line) => !line.includes("https://example.com/1")));
});
