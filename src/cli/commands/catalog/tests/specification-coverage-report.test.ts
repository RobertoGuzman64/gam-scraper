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
  const lines = formatSpecificationCoverageReport(report, 20, true);
  assert.match(lines[0] ?? "", /revisar 0.*hipótesis familiares solo en --detalle o --json/);
  assert.ok(lines.some((line) => line.includes("1 observaciones familiares no obligatorias")));
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
  const lines = formatSpecificationCoverageReport(changed, 1, true);
  assert.match(lines[0] ?? "", /revisar 1/);
  assert.ok(lines.some((line) => line.includes("REVISAR | diferencia_origen_preparacion")));
  assert.ok(lines.every((line) => !line.includes(" | 4 | Peso (kg)")));
  assert.ok(lines.every((line) => !line.includes("SIN INCIDENCIAS TÉCNICAS")));
});

test("la vista breve no imprime casos ni observaciones familiares como obligaciones", () => {
  const lines = formatSpecificationCoverageReport({ ...report, totals: { ...report.totals, sourceNotPreserved: 1 },
    cases: [...report.cases, { ...report.cases[0]!, identity: "gam:5", stage: "diferencia_origen_preparacion" }] }, 20);
  assert.ok(lines.some((line) => line.includes("revisar 1")));
  assert.ok(lines.some((line) => line.includes("consultar --detalle o --json")));
  assert.ok(lines.every((line) => !line.includes("gam:5")));
  assert.ok(lines.every((line) => !line.includes("observaciones familiares no obligatorias | 1")));
});


test("el resumen separa origen no utilizable, transformación acreditada y revisión real", () => {
  const cases: SpecificationCoverage["cases"] = [
    ...report.cases,
    { identity: "gam:1", providerId: "gam", reference: "1", url: "https://example.com/1",
      family: "maquinaria", origin: "original_canonico", key: "Horas (h)", stage: "reconciliacion_acreditada",
      reconciliation: { originalValue: "NA horas", destinationKeys: [], classification: "origen_no_utilizable" } },
    { identity: "gam:2", providerId: "gam", reference: "2", url: "https://example.com/2",
      family: "maquinaria", origin: "original_canonico", key: "Capacidad de carga (kg)", stage: "reconciliacion_acreditada",
      reconciliation: { originalValue: "5000 KG", destinationKeys: ["Capacidad de arrastre (kg)"],
        classification: "transformacion_acreditada" } },
    { identity: "gam:3", providerId: "gam", reference: "3", url: "https://example.com/3",
      family: "maquinaria", origin: "original_canonico", key: "Altura (mm)", stage: "diferencia_origen_preparacion" }
  ];
  const changed: SpecificationCoverage = { ...report, cases,
    totals: { ...report.totals, sourceNotPreserved: 1, accreditedReconciliations: 2 } };
  const lines = formatSpecificationCoverageReport(changed, 20, true);
  assert.match(lines[0] ?? "", /revisar 1.*reconciliaciones acreditadas 2.*origen no utilizable 1, transformación acreditada 1/);
  assert.ok(lines.some((line) => line.includes("REVISAR | diferencia_origen_preparacion")));
  assert.ok(lines.every((line) => !line.includes(" | 1 | Horas (h)")));
  assert.ok(lines.every((line) => !line.includes(" | 2 | Capacidad de carga (kg)")));
});
