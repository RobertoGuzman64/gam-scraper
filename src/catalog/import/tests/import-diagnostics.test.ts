import assert from "node:assert/strict";
import test from "node:test";
import { buildImportDiagnostics, classifyImportIssue, importIssueCode } from "../preparation/import-diagnostics.js";
import { buildOfflineDiagnostics, issueCode } from "../preparation/offline-diagnostics.js";
import type { PreparedProduct } from "../preparation/contracts.js";
import type { OfflinePreparation } from "../preparation/offline-document.js";
import { formatImportDiagnostics } from "../../../cli/reporting/import-diagnostics.js";
import { formatDetailedValidation } from "../../../cli/reporting/detailed-validation.js";

const entry = (reference: string, issues: readonly string[], excel: readonly string[], createMany: readonly string[]): PreparedProduct => ({
  status: issues.length > 0 ? "review" : "ready", issues,
  importIssues: { excel, createMany },
  product: {
    providerId: "gam", sourceUrl: `https://example.test/${reference}`, reference, title: "Máquina",
    categorySellID: 2, category: "Equipos", condition: "Segunda_Mano", price: null,
    description_title: "Máquina", description: null, description_general: "Dato del proveedor",
    image: "https://example.test/image.jpg", images: ["https://example.test/image.jpg"], spec: {}, attributes: []
  }
});

const required = "Atributo obligatorio ausente: Tipo de mástil";
const description = "Descripción corta ausente: solo hay descripción general y el backend exige una descripción corta";

test("diferencia ausencias, contradicciones y restricciones por receptor sin alterar la calidad", () => {
  const rows = [
    entry("A", [], [required, description, "Precio ausente o inválido"], [required, description]),
    entry("B", ["Atributo contradictorio: Tipo de mástil"], [required], [required]),
    entry("C", ["Atributo rechazado por seguridad: Capacidad de carga"], [], []),
    entry("D", [], ["Precio ausente o inválido"], []),
    entry("E", [], [], [])
  ];
  const snapshot = JSON.stringify(rows);
  const diagnostic = buildImportDiagnostics(rows);
  assert.deepEqual({ excel: [diagnostic.excel.eligible, diagnostic.excel.blocked, diagnostic.excel.blockedByQuality, diagnostic.excel.blockedByContractOnly],
    createMany: [diagnostic.createMany.eligible, diagnostic.createMany.blocked, diagnostic.createMany.blockedByQuality, diagnostic.createMany.blockedByContractOnly] },
    { excel: [1, 4, 2, 2], createMany: [2, 3, 2, 1] });
  assert.deepEqual(diagnostic.createMany.issues.filter((issue) => issue.code === "required_attribute:Tipo de mástil")
    .map(({ classification, affected, only }) => ({ classification, affected, only })), [
    { classification: "asociado_calidad", affected: 1, only: 1 },
    { classification: "sin_valor_confirmado", affected: 1, only: 0 }
  ]);
  assert.equal(issueCode("Atributo contradictorio: Tipo de mástil"), "quality.attribute_contradiction:Tipo de mástil");
  assert.equal(issueCode("Atributo rechazado por seguridad: Capacidad de carga"), "quality.attribute_rejected:Capacidad de carga");
  assert.equal(issueCode("Atributo no normalizable: Modelo"), "quality.attribute_invalid:Modelo");
  assert.equal(importIssueCode(required), "required_attribute:Tipo de mástil");
  assert.equal(classifyImportIssue(required, []), "sin_valor_confirmado");
  assert.equal(classifyImportIssue(required, ["Atributo contradictorio: Tipo de mástil"]), "asociado_calidad");
  assert.equal(JSON.stringify(rows), snapshot);
});

test("JSON y CLI informan calidad y elegibilidad de forma independiente también en fichas ready", () => {
  const rows = [
    entry("A", [], [required, description], [required, description]),
    entry("B", ["Atributo contradictorio: Tipo de mástil"], [required], [required]),
    entry("C", [], [], [])
  ];
  const report: OfflinePreparation = {
    version: 1, quality: "complete", published: true, preparedAt: "2026-10-22T23:03:29.000Z",
    source: { providerId: "gam", prefix: "scrape-gam", scope: "1234567890abcdef", catalogSha256: "a".repeat(64), productCount: 3 },
    fingerprints: { rulesVersion: 1, rulesSha256: "a".repeat(64), categorySnapshotSha256: "b".repeat(64), attributeSnapshotSha256: "c".repeat(64) },
    totals: { ready: 2, review: 1 }, identities: ["gam:A", "gam:B", "gam:C"], products: rows
  };
  const diagnostics = buildOfflineDiagnostics(report);
  assert.equal(diagnostics.totals.ready, 2);
  assert.equal(diagnostics.totals.review, 1);
  assert.equal(diagnostics.totals.incidences, 1);
  assert.equal(diagnostics.importation.createMany.eligible, 1);
  assert.equal(diagnostics.importation.createMany.blockedByContractOnly, 1);
  assert.equal(diagnostics.issues[0]?.classification, "contradiccion");
  const summary = formatImportDiagnostics(rows).join("\n");
  assert.match(summary, /Importación Excel: 1 elegibles \| 2 bloqueados \(1 por calidad; 1 solo por contrato\)/);
  assert.match(summary, /Importación create\/many: 1 elegibles \| 2 bloqueados/);
  const detailed = [...formatDetailedValidation(rows)].join("\n");
  assert.match(detailed, /GAM \| A \| calidad: ready \| 2 requisitos de receptor/);
  assert.match(detailed, /\[required_attribute:Tipo de mástil\] sin_valor_confirmado/);
  assert.match(detailed, /GAM \| B \| calidad: review/);
});

test("informe histórico sin clasificación de importación no se presenta como elegible", () => {
  const { importIssues, ...historical } = entry("A", [], [], []);
  assert.deepEqual(formatImportDiagnostics([historical]), [
    "  Elegibilidad Excel/create-many: no registrada en este informe histórico; generar preparación actual para evaluarla"
  ]);
  assert.deepEqual(importIssues, { excel: [], createMany: [] });
});
