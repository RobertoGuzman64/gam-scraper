import assert from "node:assert/strict";
import test from "node:test";
import { formatSpecificationImprovementReport } from "../specification-improvement-report.js";
import type { SpecificationImprovementAudit } from "../../../../catalog/diagnostics/specification-improvement.js";

const report: SpecificationImprovementAudit = {
  note: "Solo oportunidades con evidencia comparable",
  criteria: { minimumTechnicalSpecs: 6, minimumComparable: 3, minimumObserved: 2,
    minimumCoveragePercent: 60, minimumSameModelPeers: 2 },
  totals: { products: 2, analyzedPriorityFamilies: 1, coveragePending: 1,
    differentiationPending: 1, totalPending: 2, controlledExceptions: 0,
    staleExceptions: 0, priorityP1: 1, priorityP2: 0, priorityP3: 1 },
  families: [{ name: "plataformas de tijera", priority: "P1", products: 1, pending: 1,
    coverage: 0, differentiation: 1 }],
  campaigns: [
    { providerId: "gam", family: "plataformas de tijera", priority: "P1", field: "Altura vertical declarada",
      kind: "diferenciacion", pending: 1, references: ["101"] },
    { providerId: "gam", family: "cobertura general", priority: "P3", field: "mínimo 6 specs",
      kind: "cobertura", pending: 1, references: ["102"] }
  ],
  cases: [{ id: "ejemplo", fingerprint: "a".repeat(64), providerId: "gam", reference: "101",
    url: "https://example.com/101", title: "Plataforma", priority: "P1", family: "plataformas de tijera",
    field: "Altura vertical declarada", kind: "diferenciacion", technicalCount: 7, missingToTarget: 0,
    status: "pendiente", evidence: { kind: "cohorte", observed: 3, comparable: 4 } },
  { id: "ejemplo2", fingerprint: "b".repeat(64), providerId: "gam", reference: "102",
    url: "https://example.com/102", title: "Barredora", priority: "P3", family: null,
    field: "mínimo 6 specs", kind: "cobertura", technicalCount: 4, missingToTarget: 2, status: "pendiente" }],
  staleExceptions: []
};

test("el reporte permite atacar campañas por subfamilia y mantiene la cola íntegra en JSON", () => {
  const lines = formatSpecificationImprovementReport(report, 1, true);
  assert.ok(lines.some((line) => line.includes("pendientes 2 | mínimo 6: 1 | diferenciación: 1")));
  assert.ok(lines.some((line) => line.includes("FAMILIA SPECS | P1 | plataformas de tijera")));
  assert.ok(lines.some((line) => line.includes("CAMPAÑAS SPECS | 2 grupos")));
  assert.ok(lines.some((line) => line.includes("evidencia cohorte 3/4")));
  assert.ok(lines.some((line) => line.includes("TOP 1 de 2")));
  assert.ok(lines.every((line) => !line.includes("https://example.com/102")));
  assert.equal(report.cases.length, 2);
});
