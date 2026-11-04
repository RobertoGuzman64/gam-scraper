import assert from "node:assert/strict";
import test from "node:test";
import { formatSpecificationCoverageReport } from "../specification-coverage-report.js";
import type { SpecificationCoverage } from "../../../../catalog/diagnostics/specification-coverage.js";

const report: SpecificationCoverage = {
  note: "Cobertura observada, no obligatoria",
  criteria: { minimumFamily: 5, minimumObserved: 3, minimumCoveragePercent: 60 },
  totals: {
    products: 5, canonicalOriginals: 5, reconstructedSources: 0,
    pendingPublication: 0, sourceNotPreserved: 0, accreditedReconciliations: 0,
    lostAfterPublication: 0, ambiguousNormalization: 0, observationalMissing: 1
  },
  patterns: [],
  cases: [{ identity: "gam:4", providerId: "gam", reference: "4", url: "https://example.com/4",
    family: "maquinaria", origin: "original_canonico", key: "Peso (kg)", stage: "sin_evidencia_directa" }]
};

test("las observaciones estadísticas no generan una cola operativa ni desaparecen del JSON", () => {
  const lines = formatSpecificationCoverageReport(report, 20);
  assert.match(lines[0] ?? "", /revisar 0.*observaciones familiares no obligatorias 1/);
  assert.ok(lines.some((line) => line.includes("SIN INCIDENCIAS TÉCNICAS")));
  assert.ok(lines.some((line) => line.includes("1 casos en JSON")));
  assert.ok(lines.every((line) => !line.includes(" | 4 | Peso (kg)")));
  assert.equal(report.cases.length, 1);
});

test("una diferencia comprobable sí sale en la cola, sin convertir ausencias familiares en tareas", () => {
  const changed: SpecificationCoverage = {
    ...report,
    totals: { ...report.totals, sourceNotPreserved: 1 },
    cases: [...report.cases, { identity: "gam:1", providerId: "gam", reference: "1",
      url: "https://example.com/1", family: "maquinaria", origin: "original_canonico",
      key: "Peso (kg)", stage: "diferencia_origen_preparacion" }]
  };
  const lines = formatSpecificationCoverageReport(changed, 1);
  assert.match(lines[0] ?? "", /revisar 1/);
  assert.ok(lines.some((line) => line.includes("REVISAR | diferencia_origen_preparacion")));
  assert.ok(lines.every((line) => !line.includes(" | 4 | Peso (kg)")));
  assert.ok(lines.every((line) => !line.includes("SIN INCIDENCIAS TÉCNICAS")));
});
