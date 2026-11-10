import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { classifyFindingRecognitions, fingerprintAuditedFinding } from "../finding-recognitions.js";
import type { AuditedFinding, FindingRecognition, FindingRecognitionRegistry } from "../finding-recognitions.js";

const sha = (value: string): string => createHash("sha256").update(value).digest("hex");

const finding = (): AuditedFinding => ({
  providerId: "gam", reference: "5961", sourceUrl: "https://supplier.test/5961",
  audit: "acreditacion_comercial", severity: "warn", field: "year", code: "ano-url-atributo-discordante",
  evidenceSha256: sha("original-publicacion-comercial"),
  facts: [{ name: "urlYear", value: "2018" }, { name: "attributeYear", value: "2015" }]
});

const recognition = (item: AuditedFinding = finding()): FindingRecognition => ({
  finding: item, fingerprint: fingerprintAuditedFinding(item),
  decision: { reviewedBy: "responsable-auditoria", reviewedAt: "2026-11-10T11:00:00Z",
    rationale: "Se investigó la contradicción de año, pero el fabricante no confirmó el año de la unidad.",
    evidence: [{ origin: "https://supplier.test/5961", content: "Anuncio de la unidad con años discordantes." }] }
});

const registry = (...items: readonly FindingRecognition[]): FindingRecognitionRegistry =>
  ({ version: 1, recognitions: items });

test("no reconoce incidencias mientras no haya una decisión individual", () => {
  const actual = finding();
  const original = JSON.stringify(actual);
  assert.deepEqual(classifyFindingRecognitions([actual], registry()), {
    findings: [{ finding: actual, fingerprint: fingerprintAuditedFinding(actual), status: "pending", recognition: null }],
    stale: []
  });
  assert.equal(JSON.stringify(actual), original);
});

test("solo controla el hallazgo con la misma identidad, código, campo, hechos y procedencia", () => {
  const original = finding();
  const approved = recognition(original);
  const changed = [
    { ...original, reference: "6870" },
    { ...original, providerId: "gomariz" },
    { ...original, sourceUrl: "https://supplier.test/otro" },
    { ...original, code: "ano-descripcion-atributo-discordante" },
    { ...original, field: "title" },
    { ...original, audit: "coherencia_preparacion" as const, severity: "revisar" as const },
    { ...original, facts: [{ name: "urlYear", value: "2018" }, { name: "attributeYear", value: "2016" }] },
    { ...original, evidenceSha256: sha("nueva-publicacion") }
  ];
  const result = classifyFindingRecognitions([original, ...changed], registry(approved));
  assert.deepEqual(result.findings.map((item) => item.status),
    ["controlled", "pending", "pending", "pending", "pending", "pending", "pending", "pending", "pending"]);
  assert.deepEqual(result.stale, []);
  assert.equal(classifyFindingRecognitions(changed, registry(approved)).stale.length, 1);
});

test("la huella es independiente del orden de hechos sin debilitar sus nombres o valores", () => {
  const original = finding();
  assert.equal(fingerprintAuditedFinding(original),
    fingerprintAuditedFinding({ ...original, facts: [...original.facts].reverse() }));
  assert.notEqual(fingerprintAuditedFinding(original), fingerprintAuditedFinding({
    ...original, facts: [{ name: "urlYear", value: "2018" }, { name: "sourceYear", value: "2015" }]
  }));
});

test("distingue dos contradicciones independientes de una misma unidad y código", () => {
  const first = finding();
  const second = { ...first, evidenceSha256: sha("otro-contenido"),
    facts: [{ name: "urlYear", value: "2018" }, { name: "attributeYear", value: "2014" }] };
  const result = classifyFindingRecognitions([first, second], registry(recognition(first)));
  assert.deepEqual(result.findings.map((item) => item.status), ["controlled", "pending"]);
});

test("un reconocimiento caducado sigue visible cuando el detector deja de emitir el aviso", () => {
  const approved = recognition();
  assert.deepEqual(classifyFindingRecognitions([], registry(approved)), { findings: [], stale: [approved] });
});

test("rechaza huellas no correspondientes a la evidencia y aprobaciones incompletas", () => {
  const item = recognition();
  assert.throws(() => classifyFindingRecognitions([finding()], registry({ ...item, fingerprint: sha("incorrecta") })),
    /Reconocimiento sin huella/);
  assert.throws(() => classifyFindingRecognitions([finding()], registry({
    ...item, decision: { ...item.decision, evidence: [] }
  })), /Reconocimiento sin huella/);
  assert.throws(() => classifyFindingRecognitions([finding()], registry({
    ...item, decision: { ...item.decision, rationale: " " }
  })), /Reconocimiento sin huella/);
  assert.throws(() => classifyFindingRecognitions([finding()], registry(item, item)), /duplicados/);
});

test("no acepta un reconocimiento con hechos vacíos o valores sin contexto", () => {
  assert.throws(() => fingerprintAuditedFinding({ ...finding(), facts: [] }), /Hallazgo sin identidad/);
  assert.throws(() => fingerprintAuditedFinding({ ...finding(), facts: [
    { name: "year", value: "2018" }, { name: "year", value: "2015" }
  ] }), /Hallazgo sin identidad/);
  assert.throws(() => fingerprintAuditedFinding({ ...finding(), evidenceSha256: "insegura" }), /Hallazgo sin identidad/);
});
