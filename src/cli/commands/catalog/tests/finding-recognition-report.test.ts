import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { originalSources } from "../../../../infrastructure/filesystem/catalog/original-catalog-sources.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
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
import { loadFindingRecognitionRegistry } from "../../../../infrastructure/filesystem/catalog/finding-recognition-store.js";
import { loadCommercialReference } from "../../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { loadCommercialPublicationInputs } from "../../../../commercial/export/commercial-inputs.js";
import { planCommercialExport } from "../../../../commercial/projection/export-projection.js";
import { accreditCommercialPlan } from "../../../../commercial/diagnostics/commercial-accreditation.js";
import { observeCommercialAccreditationFindings } from "../../../../commercial/diagnostics/audited-findings.js";

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
  assert.equal(initial.findings.length, 4);
  assert.ok(initial.findings.every((item) => item.status === "pending"));
  const baseline = capture(() => printCommercialAuditReport(audited.report, "--acreditacion", undefined, undefined));
  const integrated = capture(() => printCommercialAuditReport(audited.report, "--acreditacion", undefined, undefined, initial));
  for (const expected of ["ano-url-atributo-discordante: 3", "altura-titulo-resumen-discordante: 1",
    "0 infracciones"]) {
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
  assert.ok(accreditation.some((line) => line.includes("ano-url-atributo-discordante: 2")));
  assert.ok(accreditation.some((line) => line.includes("CONTROLADA | GAM | ano-url-atributo-discordante: 1")));
  assert.equal(accreditation.some((line) => line.includes("WARN | GAM | ano-url-atributo-discordante: 3")), false);
  assert.ok(accreditation.some((line) => line.includes("0 infracciones")));
  const review = capture(() => printCommercialAuditReport(audited.report, "--revision", undefined, undefined, classification));
  assert.ok(review.some((line) => line.includes("señales 2 pendientes · 1 controladas")));
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
  assert.ok(output.some((line) => line.includes("INCIDENCIAS ACREDITACIÓN | pendientes 0 | controladas 4")));
  assert.equal(output.some((line) => line.includes("capacidad-titulo-spec-discordante")), false);
  assert.ok(output.some((line) => line.includes("1334 productos · 7344 atributos · 0 infracciones")));
  const review = capture(() => printCommercialAuditReport(audited.report, "--revision",
    undefined, undefined, classification));
  assert.ok(review.some((line) => line.includes("CONTROLADA INDIVIDUAL | ano-url-atributo-discordante")));
  assert.equal(review.some((line) => line.includes("MEDIA | acreditacion | ano-url-atributo-discordante")), false);
});

test("la coherencia conserva las revisiones restantes y no acepta reconocimientos comerciales", async () => {
  const catalog = await loadImportCatalog();
  const products = [];
  const evidence = [];
  for (const providerId of ["gam", "gomariz", "mercaeleva"]) {
    let sources: readonly ProductRecord[];
    if (providerId === "gomariz") {
      sources = (await readCanonicalCatalog("src/testing/fixtures/gomariz/regression-143/scrape-gomariz-catalog.json")).products;
    } else {
      const original = await originalSources(root, providerId);
      assert.ok(original);
      sources = [...original.values()];
    }
    assert.ok(sources.length);
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
  assert.equal(observed.length, 2);
  const officialRegistry = await loadFindingRecognitionRegistry(root);
  const official = classifyCurrentAuditFindings(observed, officialRegistry, "coherencia_preparacion");
  assert.equal(official.findings.filter((item) => item.status === "pending").length, 0);
  assert.deepEqual(official.findings.filter((item) => item.status === "controlled")
    .map((item) => `${item.finding.providerId}:${item.finding.reference}`).sort(),
    ["gam:6934", "gomariz:TE1772"]);
  assert.equal(official.stale.length, 0);
  const officialOutput = capture(() => printPreparationCoherenceReport(report, official));
  assert.ok(officialOutput.some((line) => line.includes("COHERENCIA INDIVIDUAL | pendientes 0 | controladas 2")));
  for (const reference of ["6934", "TE1772"]) {
    const original = observed.find((item) => item.reference === reference);
    assert.ok(original);
    const changedFinding = observed.map((item) => item === original
      ? { ...item, evidenceSha256: "f".repeat(64) } : item);
    const reopenedFinding = classifyCurrentAuditFindings(changedFinding, officialRegistry, "coherencia_preparacion");
    assert.equal(reopenedFinding.findings.filter((item) => item.status === "pending").length, 1);
    assert.equal(reopenedFinding.findings.filter((item) => item.status === "controlled").length, 1);
    assert.equal(reopenedFinding.stale.filter((item) => item.finding.reference === reference).length, 1);
  }
  const commercial = audited.findings.find((item) => item.reference === "4796");
  const coherence = observed.find((item) => item.reference === "6934");
  assert.ok(commercial && coherence);
  const registry: FindingRecognitionRegistry = { version: 1, recognitions: [recognition(commercial)] };
  const initial = classifyCurrentAuditFindings(observed, registry, "coherencia_preparacion");
  assert.equal(initial.findings.filter((item) => item.status === "controlled").length, 0);
  const acknowledged = classifyCurrentAuditFindings(observed, {
    version: 1, recognitions: [...registry.recognitions, recognition(coherence)]
  }, "coherencia_preparacion");
  const output = capture(() => printPreparationCoherenceReport(report, acknowledged));
  assert.ok(output.some((line) => line.includes("2 casos para revisar")));
  assert.ok(output.some((line) => line.includes("COHERENCIA INDIVIDUAL | pendientes 1 | controladas 1")));
  assert.ok(output.some((line) => line.includes("CONTROLADA gam:6934")));
  assert.ok(output.some((line) => line.includes("REVISAR gomariz:TE1772")));
  const changed = observed.map((item) => item === coherence
    ? { ...item, evidenceSha256: "e".repeat(64) } : item);
  const reopened = classifyCurrentAuditFindings(changed, {
    version: 1, recognitions: [...registry.recognitions, recognition(coherence)]
  }, "coherencia_preparacion");
  assert.equal(reopened.findings.filter((item) => item.status === "pending").length, 2);
  assert.equal(reopened.stale.length, 1);
  const reopenedOutput = capture(() => {
    printPreparationCoherenceReport(report, reopened);
    printStaleFindingRecognitions(reopened.stale);
  });
  assert.ok(reopenedOutput.some((line) => line.includes("COHERENCIA INDIVIDUAL | pendientes 2 | controladas 0")));
  assert.ok(reopenedOutput.some((line) => line.includes("REVISAR gam:6934")));
  assert.ok(reopenedOutput.some((line) => line.includes("RECONOCIMIENTO CADUCADO") && line.includes("6934")));
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
  assert.ok(output.some((line) => line.includes("CONTROLADA | GAM | ano-url-atributo-discordante: 2")));
  assert.ok(output.some((line) => line.includes("RECONOCIMIENTO CADUCADO") && line.includes(original.code)));
  const review = capture(() => printCommercialAuditReport(audited.report, "--revision",
    undefined, undefined, classified));
  assert.ok(review.some((line) => line.includes("señales 1 pendientes · 2 controladas")));
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

test("el logo comercial no caduca un reconocimiento de año y un cambio de año sí lo hace", async () => {
  const [catalog, references] = await Promise.all([loadImportCatalog(), loadCommercialReference()]);
  const gam = (await loadCommercialPublicationInputs(root, catalog)).find((provider) => provider.providerId === "gam");
  assert.ok(gam);
  const projected = planCommercialExport(gam.entries, gam.providerId, gam.publicationSha256,
    catalog, references.brandLogos, null, null);
  const accreditation = accreditCommercialPlan(gam.entries, projected, catalog, references.brandLogos, null);
  const observed = observeCommercialAccreditationFindings(gam.entries, projected.products, accreditation);
  const finding = observed.find((item) => item.reference === "6236");
  assert.ok(finding);
  const alternativeLogo = references.brandLogos.find((logo) => logo.id !== 18);
  assert.ok(alternativeLogo);
  const differentLogo = projected.products.map((product) => product.reference === "6236"
    ? { ...product, logoID: alternativeLogo.id } : product);
  const logoFinding = observeCommercialAccreditationFindings(gam.entries, differentLogo, accreditation)
    .find((item) => item.reference === "6236");
  assert.ok(logoFinding);
  assert.equal(fingerprintAuditedFinding(logoFinding), fingerprintAuditedFinding(finding));
  const differentYear = projected.products.map((product) => product.reference === "6236"
    ? { ...product, attributes: product.attributes.map((attribute) => attribute.attributeID === 117
      ? { ...attribute, value: 2019 } : attribute) } : product);
  const yearFinding = observeCommercialAccreditationFindings(gam.entries, differentYear, accreditation)
    .find((item) => item.reference === "6236");
  assert.ok(yearFinding);
  assert.notEqual(fingerprintAuditedFinding(yearFinding), fingerprintAuditedFinding(finding));
});

test("los reconocimientos de año de GAM son individuales tras corregir las discrepancias acreditadas", async () => {
  const registry = await loadFindingRecognitionRegistry(root);
  const expected = [
    { reference: "5961", urlYear: "2018", attributeYear: "2015" },
    { reference: "6236", urlYear: "2017", attributeYear: "2018" },
    { reference: "6921", urlYear: "2017", attributeYear: "2016" }
  ];
  assert.equal(registry.recognitions.length, expected.length + 3);
  assert.deepEqual(registry.recognitions.filter((item) => item.finding.code === "ano-url-atributo-discordante")
    .map((item) => item.finding.reference), expected.map((item) => item.reference));
  for (const item of expected) {
    const record = registry.recognitions.find((recognition) => recognition.finding.reference === item.reference);
    assert.ok(record);
    assert.equal(record.finding.providerId, "gam");
    assert.equal(record.finding.audit, "acreditacion_comercial");
    assert.equal(record.finding.code, "ano-url-atributo-discordante");
    assert.equal(record.finding.facts.find((fact) => fact.name === "urlYear")?.value, item.urlYear);
    assert.equal(record.finding.facts.find((fact) => fact.name === "attributeYear")?.value, item.attributeYear);
    assert.ok(record.decision.evidence.some((evidence) => evidence.origin === record.finding.sourceUrl ||
      evidence.origin.includes(`/${item.reference}-${item.urlYear}-`)));
    assert.ok(record.decision.evidence.some((evidence) =>
      evidence.origin === "catalogs/providers/gam/original/scrape-gam-catalog.json"));
  }
  const classified = classifyCurrentAuditFindings(audited.findings, registry, "acreditacion_comercial");
  assert.equal(classified.stale.length, 0);
  assert.deepEqual(classified.findings.filter((item) => item.status === "controlled")
    .map((item) => item.finding.reference).sort(), ["4796", "5961", "6236", "6921"]);
  assert.deepEqual(classified.findings.filter((item) => item.status === "pending" &&
    item.finding.code === "ano-url-atributo-discordante")
    .map((item) => item.finding.reference).sort(), []);
  assert.equal(classified.findings.filter((item) => item.status === "pending").length, 0);
  const output = capture(() => printCommercialAuditReport(audited.report, "--acreditacion",
    undefined, undefined, classified));
  assert.equal(output.some((line) => line.includes("WARN | GAM | ano-url-atributo-discordante")), false);
  assert.ok(output.some((line) => line.includes("CONTROLADA | GAM | ano-url-atributo-discordante: 3")));
  assert.ok(output.some((line) => line.includes("CONTROLADA | GAM | altura-titulo-resumen-discordante: 1")));
  assert.equal(output.some((line) => line.includes("WARN | MERCAELEVA | capacidad-titulo-spec-discordante")), false);
  assert.ok(output.some((line) => line.includes("0 infracciones")));
});

test("cada reconocimiento GAM caduca de forma aislada cuando cambia su evidencia", async () => {
  const registry = await loadFindingRecognitionRegistry(root);
  for (const reference of ["5961", "6236", "6921"]) {
    const original = audited.findings.find((finding) => finding.reference === reference);
    assert.ok(original);
    const changed = audited.findings.map((finding) => finding === original
      ? { ...finding, evidenceSha256: "a".repeat(64) } : finding);
    const reopened = classifyCurrentAuditFindings(changed, registry, "acreditacion_comercial");
    assert.equal(reopened.findings.filter((item) => item.status === "controlled").length, 3);
    assert.equal(reopened.findings.filter((item) => item.status === "pending").length, 1);
    assert.equal(reopened.stale.length, 1);
    assert.equal(reopened.stale[0]?.finding.reference, reference);
    const output = capture(() => {
      printCommercialAuditReport(audited.report, "--acreditacion", undefined, undefined, reopened);
      printStaleFindingRecognitions(reopened.stale);
    });
    assert.ok(output.some((line) => line.includes("WARN | GAM | ano-url-atributo-discordante: 1")));
    assert.ok(output.some((line) => line.includes("RECONOCIMIENTO CADUCADO") && line.includes(reference)));
  }
});

test("la evidencia individual de altura y capacidad conserva los valores técnicos conflictivos", async () => {
  const registry = await loadFindingRecognitionRegistry(root);
  const commercial = classifyCurrentAuditFindings(audited.findings, registry, "acreditacion_comercial");
  const expected = [
    { providerId: "gam", reference: "4796", code: "altura-titulo-resumen-discordante", facts: {
      titleMetres: "32", summaryMetres: "40", technicalMetres: "40", assessment: "unresolved",
      sourceModel: JSON.stringify("XGS32ACKⅡ"),
      sourceTitle: JSON.stringify("Plataforma telescópica eléctrica 32M XCMG XGS32ACK Ⅱ"),
      sourceTechnicalHeight: JSON.stringify("40 metros")
    } }
  ] as const;
  for (const item of expected) {
    const finding = commercial.findings.find((entry) => entry.finding.providerId === item.providerId &&
      entry.finding.reference === item.reference);
    assert.ok(finding);
    assert.equal(finding.status, "controlled");
    assert.equal(finding.finding.code, item.code);
    for (const [key, expectedValue] of Object.entries(item.facts)) {
      assert.equal(finding.finding.facts.find((fact) => fact.name === key)?.value, expectedValue);
    }
  }
  assert.equal(commercial.findings.filter((item) => item.status === "controlled").length, 4);
  assert.equal(commercial.findings.filter((item) => item.status === "pending").length, 0);
  assert.equal(commercial.stale.length, 0);
});

test("la consola separa la contradicción documental controlada sin reabrir capacidades corregidas", async () => {
  const registry = await loadFindingRecognitionRegistry(root);
  const classified = classifyCurrentAuditFindings(audited.findings, registry, "acreditacion_comercial");
  const output = capture(() => printCommercialAuditReport(audited.report, "--acreditacion",
    undefined, undefined, classified));
  assert.ok(output.some((line) => line.includes("CONTROLADA | GAM | altura-titulo-resumen-discordante: 1")));
  assert.equal(output.filter((line) => line.startsWith("WARN | ")).length, 0);
  assert.equal(output.filter((line) => line.includes("WARN | MERCAELEVA | capacidad-titulo-spec-discordante")).length, 0);
  assert.equal(classified.findings.filter((item) => item.status === "pending").length, 0);
});

test("los hechos originales de altura y capacidad son individuales e invalidan el reconocimiento si cambian", () => {
  const unresolved = audited.findings.filter((finding) => finding.code === "altura-titulo-resumen-discordante" ||
    finding.code === "capacidad-titulo-spec-discordante");
  assert.equal(unresolved.length, 1);
  for (const finding of unresolved) {
    const sourceFact = finding.code === "altura-titulo-resumen-discordante" ? "sourceTechnicalHeight" : "sourceCapacity";
    const original = finding.facts.find((fact) => fact.name === sourceFact);
    assert.ok(original);
    const registry: FindingRecognitionRegistry = { version: 1, recognitions: [recognition(finding)] };
    const changed = unresolved.map((candidate) => candidate === finding ? {
      ...candidate, facts: candidate.facts.map((fact) => fact.name === sourceFact
        ? { ...fact, value: JSON.stringify("evidencia actualizada") } : fact)
    } : candidate);
    const result = classifyCurrentAuditFindings(changed, registry, "acreditacion_comercial");
    assert.equal(result.findings.filter((item) => item.status === "controlled").length, 0);
    assert.equal(result.stale.length, 1);
    assert.equal(result.stale[0]?.finding.reference, finding.reference);
    assert.equal(result.findings.filter((item) => item.status === "pending").length, 1);
  }
});

test("reconocer una discordancia de altura no reconoce un hallazgo de capacidad nuevo", () => {
  const height = audited.findings.find((finding) => finding.reference === "4796");
  assert.ok(height);
  const capacity: AuditedFinding = { ...height, providerId: "mercaeleva", reference: "M062-8951",
    sourceUrl: "https://sales.mercaeleva.com/es/for-sale/machine/MB-EFL303-M062-8951",
    field: "capacity", code: "capacidad-titulo-spec-discordante",
    facts: [{ name: "technicalCapacity", value: JSON.stringify("2500 kg") },
      { name: "sourceCapacity", value: JSON.stringify("2500 kg") }] };
  const controlled = classifyCurrentAuditFindings([...audited.findings, capacity], {
    version: 1, recognitions: [recognition(height)]
  }, "acreditacion_comercial");
  assert.equal(controlled.findings.find((item) => item.finding.reference === height.reference)?.status, "controlled");
  assert.equal(controlled.findings.find((item) => item.finding.reference === capacity.reference)?.status, "pending");
  const changed = { ...capacity, facts: [{ name: "technicalCapacity", value: JSON.stringify("3000 kg") },
    { name: "sourceCapacity", value: JSON.stringify("2500 kg") }] };
  const reopened = classifyCurrentAuditFindings([...audited.findings, changed], {
    version: 1, recognitions: [recognition(capacity)]
  }, "acreditacion_comercial");
  assert.equal(reopened.findings.find((item) => item.finding.reference === capacity.reference)?.status, "pending");
  assert.equal(reopened.stale[0]?.finding.reference, capacity.reference);
});

test("GAM 4796 registra una contradicción del proveedor sin certificar altura y reabre ante cambios", async () => {
  const registry = await loadFindingRecognitionRegistry(root);
  const recognition = registry.recognitions.find((item) => item.finding.reference === "4796");
  const observed = audited.findings.find((item) => item.reference === "4796");
  assert.ok(recognition && observed);
  assert.equal(recognition.finding.code, "altura-titulo-resumen-discordante");
  assert.equal(recognition.fingerprint, fingerprintAuditedFinding(observed));
  assert.match(recognition.decision.rationale, /no se certifica la altura física/);
  assert.ok(recognition.decision.evidence.some((item) => item.origin === observed.sourceUrl));
  assert.ok(recognition.decision.evidence.some((item) => item.origin.includes("xcmg.com")));
  const changed = { ...observed, facts: observed.facts.map((fact) => fact.name === "sourceTechnicalHeight"
    ? { ...fact, value: JSON.stringify("32,5 metros") } : fact) };
  const classified = classifyCurrentAuditFindings([changed], registry, "acreditacion_comercial");
  assert.equal(classified.findings[0]?.status, "pending");
  assert.equal(classified.stale.length, 4);
  assert.equal(classified.stale.find((item) => item.finding.reference === "4796")?.fingerprint,
    recognition.fingerprint);
});
