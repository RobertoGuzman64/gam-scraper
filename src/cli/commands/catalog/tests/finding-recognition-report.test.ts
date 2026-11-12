import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { classifyCurrentAuditFindings } from "../../../../catalog/diagnostics/current-audit-findings.js";
import { fingerprintAuditedFinding } from "../../../../catalog/diagnostics/finding-recognitions.js";
import type { AuditedFinding, FindingRecognition, FindingRecognitionRegistry } from "../../../../catalog/diagnostics/finding-recognitions.js";
import { printClassifiedAccreditationFindings, printStaleFindingRecognitions } from "../../../reporting/finding-recognitions.js";

const finding: AuditedFinding = {
  providerId: "gam", reference: "TEST", sourceUrl: "https://supplier.test/machine",
  audit: "acreditacion_comercial", severity: "warn", field: "year", code: "ano-url-atributo-discordante",
  evidenceSha256: createHash("sha256").update("evidencia-test").digest("hex"),
  facts: [{ name: "urlYear", value: "2020" }, { name: "attributeYear", value: "2019" }]
};
const recognition: FindingRecognition = {
  finding, fingerprint: fingerprintAuditedFinding(finding),
  decision: {
    reviewedBy: "responsable-de-prueba", reviewedAt: "2026-11-10T11:00:00Z",
    rationale: "La contradicción debe seguir visible hasta que cambie la fuente.",
    evidence: [{ origin: finding.sourceUrl, content: "Dos años diferentes en la misma unidad." }]
  }
};
const empty: FindingRecognitionRegistry = { version: 1, recognitions: [] };
const recorded: FindingRecognitionRegistry = { version: 1, recognitions: [recognition] };

const capture = (print: () => void): string => {
  const lines: string[] = [];
  const previous = console.log;
  console.log = (...args: unknown[]): void => { lines.push(args.map(String).join(" ")); };
  try { print(); } finally { console.log = previous; }
  return lines.join("\n");
};

test("los avisos se presentan pendientes hasta disponer de reconocimiento acreditado", () => {
  const pending = classifyCurrentAuditFindings([finding], empty, "acreditacion_comercial");
  assert.equal(pending.findings[0]?.status, "pending");
  const output = capture(() => printClassifiedAccreditationFindings("gam", pending.findings));
  assert.match(output, /pendientes 1/);
  assert.match(output, /PENDIENTE/);
  assert.match(output, /ano-url-atributo-discordante/);
});

test("un reconocimiento cambia solo el estado del mismo hallazgo y conserva su huella", () => {
  const classified = classifyCurrentAuditFindings([finding], recorded, "acreditacion_comercial");
  assert.equal(classified.findings[0]?.status, "controlled");
  assert.match(capture(() => printClassifiedAccreditationFindings("gam", classified.findings)), /CONTROLADA/);
  const changed = { ...finding, facts: [{ name: "urlYear", value: "2021" }, ...finding.facts.slice(1)] };
  const reopened = classifyCurrentAuditFindings([changed], recorded, "acreditacion_comercial");
  assert.equal(reopened.findings[0]?.status, "pending");
  assert.equal(reopened.stale.length, 1);
  assert.match(capture(() => printStaleFindingRecognitions(reopened.stale)), /RECONOCIMIENTO CADUCADO/);
});

test("un auditor no acepta hallazgos de otro y no hereda sus reconocimientos", () => {
  assert.throws(() => classifyCurrentAuditFindings([finding], recorded, "coherencia_preparacion"), /ajenos/);
  assert.deepEqual(classifyCurrentAuditFindings([], recorded, "coherencia_preparacion"), { findings: [], stale: [] });
});
