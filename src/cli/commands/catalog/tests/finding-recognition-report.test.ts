import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { originalSources } from "../../../../infrastructure/filesystem/catalog/original-catalog-sources.js";
import { loadImportCatalog } from "../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { prepareImportBatch } from "../../../../preparation/batch-identity.js";
import { analyzePresentationConsistency } from "../../../../commercial/diagnostics/presentation-consistency.js";
import { observePreparationCoherenceFindings } from "../../../../commercial/diagnostics/audited-findings.js";
import { printPreparationCoherenceReport } from "../../../reporting/preparation-coherence.js";
import { auditCommercialCatalogWithFindings } from "../../../../commercial/export/commercial-audit.js";
import { classifyCurrentAuditFindings } from "../../../../catalog/diagnostics/current-audit-findings.js";
import { fingerprintAuditedFinding } from "../../../../catalog/diagnostics/finding-recognitions.js";
import type { AuditedFinding, FindingRecognition, FindingRecognitionRegistry } from "../../../../catalog/diagnostics/finding-recognitions.js";
import { printCommercialAuditReport } from "../../../reporting/commercial-audit.js";
import { printStaleFindingRecognitions } from "../../../reporting/finding-recognitions.js";

const root = fileURLToPath(new URL("../../../../../", import.meta.url));
const empty: FindingRecognitionRegistry = { version: 1, recognitions: [] };
const audited = await auditCommercialCatalogWithFindings(root);

const recognition = (finding: AuditedFinding): FindingRecognition => ({
  finding, fingerprint: fingerprintAuditedFinding(finding),
  decision: { reviewedBy: "auditoria-de-prueba", reviewedAt: "2026-11-10T11:00:00Z",
    rationale: "Caso simulado para probar el aislamiento de la clasificación.",
    evidence: [{ origin: finding.sourceUrl, content: "Evidencia simulada solo en test." }] }
});

const capture = (render: () => void): string[] => {
  const lines: string[] = [];
  const original = console.log;
  const previous = process.exitCode;
  const originalWrite = process.stdout.write;
  console.log = (...values: unknown[]): void => { lines.push(values.map(String).join(" ")); };
  function write(buffer: string | Uint8Array, cb?: (err?: Error | null) => void): boolean;
  function write(str: string | Uint8Array, encoding?: BufferEncoding, cb?: (err?: Error | null) => void): boolean;
  function write(str: string | Uint8Array, encoding?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void): boolean {
    lines.push(String(str).trimEnd());
    if (typeof encoding === "function") encoding();
    else cb?.();
    return true;
  }
  process.stdout.write = write;
  try { render(); } finally {
    console.log = original;
    process.stdout.write = originalWrite;
    process.exitCode = previous;
  }
  return lines;
};

test("integra cada aviso de acreditación sin alterar el contrato JSON existente", async () => {
  assert.equal(audited.findings.length, audited.report.providers.reduce((sum, provider) =>
    sum + provider.accreditation.summary.pending, 0));
  const initial = classifyCurrentAuditFindings(audited.findings, empty, "acreditacion_comercial");
  assert.equal(initial.findings.length, 12);
  assert.ok(initial.findings.every((item) => item.status === "pending"));
  const baseline = capture(() => printCommercialAuditReport(audited.report, "--acreditacion", undefined, undefined));
  const integrated = capture(() => printCommercialAuditReport(audited.report, "--acreditacion", undefined, undefined, initial));
  for (const expected of ["ano-url-atributo-discordante: 9", "altura-titulo-resumen-discordante: 1",
    "capacidad-titulo-spec-discordante: 2", "0 infracciones"]) {
    assert.ok(integrated.some((line) => line.includes(expected)));
    assert.ok(baseline.some((line) => line.includes(expected)));
  }
  const legacyJson = capture(() => printCommercialAuditReport(audited.report, "--acreditacion-json", undefined, undefined, initial));
  assert.deepEqual(JSON.parse(legacyJson.join("\n")), {
    version: 1, providers: audited.report.providers.map((item) => item.accreditation)
  });
  assert.deepEqual(JSON.parse(capture(() => printCommercialAuditReport(
    audited.report, "--json", undefined, undefined, initial)).join("\n")), audited.report);
});

test("controla una sola unidad manteniendo la otra y los grupos pendientes operativos", async () => {
  const first = audited.findings.find((item) => item.code === "ano-url-atributo-discordante");
  assert.ok(first);
  const registry: FindingRecognitionRegistry = { version: 1, recognitions: [recognition(first)] };
  const classification = classifyCurrentAuditFindings(audited.findings, registry, "acreditacion_comercial");
  assert.equal(classification.findings.filter((item) => item.status === "controlled").length, 1);
  const accreditation = capture(() => printCommercialAuditReport(audited.report, "--acreditacion",
    undefined, undefined, classification));
  assert.ok(accreditation.some((line) => line.includes("ano-url-atributo-discordante: 8")));
  assert.ok(accreditation.some((line) => line.includes("CONTROLADA | GAM | ano-url-atributo-discordante: 1")));
  assert.equal(accreditation.some((line) => line.includes("WARN | GAM | ano-url-atributo-discordante: 9")), false);
  assert.ok(accreditation.some((line) => line.includes("0 infracciones")));
  const review = capture(() => printCommercialAuditReport(audited.report, "--revision", undefined, undefined, classification));
  assert.ok(review.some((line) => line.includes("señales 8 pendientes · 1 controladas")));
  assert.ok(review.some((line) => line.includes("CONTROLADA INDIVIDUAL | ano-url-atributo-discordante")));
  assert.ok(review.some((line) => line.includes(`CONTROLADA | ${first.reference}`)));
  assert.equal(review.some((line) => line.includes(`Caso: ${first.sourceUrl}`)), false);
});

test("reabre avisos cambiados y no confunde reconocimientos de otros auditores", async () => {
  const first = audited.findings[0];
  assert.ok(first);
  const registry: FindingRecognitionRegistry = { version: 1, recognitions: [recognition(first)] };
  const changed = { ...first, facts: first.facts.map((fact, index) => index === 0
    ? { ...fact, value: `${fact.value}-nuevo` } : fact) };
  const reopened = classifyCurrentAuditFindings([changed], registry, "acreditacion_comercial");
  assert.equal(reopened.findings[0]?.status, "pending");
  assert.equal(reopened.stale.length, 1);
  const messages = capture(() => printStaleFindingRecognitions(reopened.stale));
  assert.ok(messages.some((line) => line.includes("RECONOCIMIENTO CADUCADO")));
  assert.ok(messages.some((line) => line.includes(first.code)));
  const otherAudit = classifyCurrentAuditFindings([], registry, "coherencia_preparacion");
  assert.deepEqual(otherAudit, { findings: [], stale: [] });
  assert.throws(() => classifyCurrentAuditFindings([first], registry, "coherencia_preparacion"), /ajenos/);
});


test("sin pendientes reconocidos no hay WARN nuevos y las detecciones originales se conservan", () => {
  const registry: FindingRecognitionRegistry = {
    version: 1, recognitions: audited.findings.map(recognition)
  };
  const classification = classifyCurrentAuditFindings(audited.findings, registry, "acreditacion_comercial");
  const output = capture(() => printCommercialAuditReport(audited.report, "--acreditacion",
    undefined, undefined, classification));
  assert.equal(classification.findings.filter((item) => item.status === "pending").length, 0);
  assert.equal(output.filter((line) => line.startsWith("WARN | ")).length, 0);
  assert.ok(output.some((line) => line.includes("INCIDENCIAS ACREDITACIÓN | pendientes 0 | controladas 10")));
  assert.ok(output.some((line) => line.includes("INCIDENCIAS ACREDITACIÓN | pendientes 0 | controladas 2")));
  assert.ok(output.some((line) => line.includes("1334 productos · 7342 atributos · 0 infracciones")));
  const review = capture(() => printCommercialAuditReport(audited.report, "--revision",
    undefined, undefined, classification));
  assert.ok(review.some((line) => line.includes("CONTROLADA INDIVIDUAL | ano-url-atributo-discordante")));
  assert.equal(review.some((line) => line.includes("MEDIA | acreditacion | ano-url-atributo-discordante")), false);
});

test("la coherencia conserva sus ocho revisiones y no acepta reconocimientos comerciales", async () => {
  const catalog = await loadImportCatalog();
  const products = [];
  const evidence = [];
  for (const providerId of ["gam", "gomariz", "mercaeleva"]) {
    const original = await originalSources(root, providerId);
    assert.ok(original);
    const sources = [...original.values()];
    const prepared = prepareImportBatch(sources, catalog);
    for (const [index, item] of prepared.products.entries()) {
      const source = sources[index];
      assert.ok(source);
      products.push(item.product);
      evidence.push({ source, product: item.product });
    }
  }
  const report = analyzePresentationConsistency(products);
  const observed = observePreparationCoherenceFindings(evidence, report);
  assert.equal(report.defects, 0);
  assert.equal(observed.length, 8);
  const commercial = audited.findings.find((item) => item.reference === "M062-8951");
  const coherence = observed.find((item) => item.reference === "M062-8951");
  assert.ok(commercial && coherence);
  const registry: FindingRecognitionRegistry = { version: 1, recognitions: [recognition(commercial)] };
  const initial = classifyCurrentAuditFindings(observed, registry, "coherencia_preparacion");
  assert.equal(initial.findings.filter((item) => item.status === "controlled").length, 0);
  const acknowledged = classifyCurrentAuditFindings(observed, {
    version: 1, recognitions: [...registry.recognitions, recognition(coherence)]
  }, "coherencia_preparacion");
  const output = capture(() => printPreparationCoherenceReport(report, acknowledged));
  assert.ok(output.some((line) => line.includes("8 casos para revisar")));
  assert.ok(output.some((line) => line.includes("COHERENCIA INDIVIDUAL | pendientes 7 | controladas 1")));
  assert.ok(output.some((line) => line.includes("CONTROLADA mercaeleva:M062-8951")));
  assert.ok(output.some((line) => line.includes("REVISAR mercaeleva:M119-9334")));
  const changed = observed.map((item) => item === coherence
    ? { ...item, evidenceSha256: "e".repeat(64) } : item);
  const reopened = classifyCurrentAuditFindings(changed, {
    version: 1, recognitions: [...registry.recognitions, recognition(coherence)]
  }, "coherencia_preparacion");
  assert.equal(reopened.findings.filter((item) => item.status === "pending").length, 8);
  assert.equal(reopened.stale.length, 1);
  const reopenedOutput = capture(() => {
    printPreparationCoherenceReport(report, reopened);
    printStaleFindingRecognitions(reopened.stale);
  });
  assert.ok(reopenedOutput.some((line) => line.includes("COHERENCIA INDIVIDUAL | pendientes 8 | controladas 0")));
  assert.ok(reopenedOutput.some((line) => line.includes("REVISAR mercaeleva:M062-8951")));
  assert.ok(reopenedOutput.some((line) => line.includes("RECONOCIMIENTO CADUCADO") && line.includes("M062-8951")));
});

test("una contradicción cambiada reaparece como WARN aunque todas las anteriores estén reconocidas", () => {
  const original = audited.findings.find((item) => item.code === "ano-url-atributo-discordante");
  assert.ok(original);
  const registry: FindingRecognitionRegistry = { version: 1, recognitions: audited.findings.map(recognition) };
  const changed: AuditedFinding = { ...original, evidenceSha256: "f".repeat(64),
    facts: original.facts.map((fact, index) => index === 0 ? { ...fact, value: `${fact.value}-cambiado` } : fact) };
  const observed = audited.findings.map((item) => item === original ? changed : item);
  const classified = classifyCurrentAuditFindings(observed, registry, "acreditacion_comercial");
  assert.equal(classified.findings.filter((item) => item.status === "pending").length, 1);
  assert.equal(classified.findings.filter((item) => item.status === "controlled").length, observed.length - 1);
  assert.deepEqual(classified.stale.map((item) => item.fingerprint), [fingerprintAuditedFinding(original)]);
  const output = capture(() => {
    printCommercialAuditReport(audited.report, "--acreditacion", undefined, undefined, classified);
    printStaleFindingRecognitions(classified.stale);
  });
  assert.ok(output.some((line) => line.includes("WARN | GAM | ano-url-atributo-discordante: 1")));
  assert.ok(output.some((line) => line.includes("CONTROLADA | GAM | ano-url-atributo-discordante: 8")));
  assert.ok(output.some((line) => line.includes("RECONOCIMIENTO CADUCADO") && line.includes(original.code)));
  const review = capture(() => printCommercialAuditReport(audited.report, "--revision",
    undefined, undefined, classified));
  assert.ok(review.some((line) => line.includes("señales 1 pendientes · 8 controladas")));
  assert.ok(review.some((line) => line.includes(`Caso: ${changed.sourceUrl}`)));
});

test("los reconocimientos no permiten ocultar bloqueantes ni alterar la acreditación JSON", () => {
  const registry: FindingRecognitionRegistry = { version: 1, recognitions: audited.findings.map(recognition) };
  const classified = classifyCurrentAuditFindings(audited.findings, registry, "acreditacion_comercial");
  const first = audited.report.providers[0];
  assert.ok(first);
  const blocker = { reason: "identidad-contra-original", affected: 1, examples: [audited.findings[0]?.sourceUrl ?? ""] };
  const blockedReport = { ...audited.report, providers: audited.report.providers.map((provider) => provider === first
    ? { ...provider, accreditation: { ...provider.accreditation,
      summary: { ...provider.accreditation.summary, blocking: provider.accreditation.summary.blocking + 1 },
      blocking: [...provider.accreditation.blocking, blocker] } } : provider) };
  const output = capture(() => {
    printCommercialAuditReport(blockedReport, "--acreditacion", undefined, undefined, classified);
    assert.equal(process.exitCode, 1);
  });
  assert.ok(output.some((line) => line.includes("BLOQUEANTE identidad-contra-original: 1")));
  assert.ok(output.some((line) => line.includes("1 infracciones")));
  assert.equal(output.filter((line) => line.startsWith("WARN | ")).length, 0);
  const accreditation = capture(() => printCommercialAuditReport(blockedReport, "--acreditacion-json",
    undefined, undefined, classified));
  assert.deepEqual(JSON.parse(accreditation.join("\n")), {
    version: 1, providers: blockedReport.providers.map((item) => item.accreditation)
  });
});
