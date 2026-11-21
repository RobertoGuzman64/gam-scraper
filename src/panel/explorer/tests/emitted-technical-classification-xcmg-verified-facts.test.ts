import assert from "node:assert/strict";
import { test } from "node:test";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import type { AuditEntry, FingerprintedAuditEntry, SpecAdditionAudit } from "../../evidence/spec-addition-audit.js";
import { classifySpecAdditions, loadSpecAdditionAudit } from "../spec-addition-classification.js";
import type { PanelFieldDifference } from "../types.js";

test("el panel presenta el diésel XCMG del motor y no el color de la matriz heredada", async () => {
  const root = process.cwd();
  const [snapshot, audit, originals] = await Promise.all([
    readPanelSnapshot(root), loadSpecAdditionAudit(root), readPortableOriginal(root, "gam")
  ]);
  assert.ok(audit);
  const provider = snapshot.providers.find((candidate) => candidate.providerId === "gam");
  const original = originals.products.find((candidate) => candidate.reference === "4814");
  assert.ok(provider);
  assert.ok(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  const entry = trace.entries.find((candidate) => candidate.field === "Tipo de motor");
  assert.ok(entry && entry.scope === "model-document" && entry.verification);
  assert.equal(entry.value, "Diésel");
  const differences: readonly PanelFieldDifference[] = [
    { field: entry.field, group: "technical", change: "added", before: null, after: entry.value }
  ];
  const historical: AuditEntry = {
    providerId: "gam", reference: original.reference, sourceUrl: original.url,
    field: entry.field, value: entry.value, kind: "own"
  };
  const contradictory: SpecAdditionAudit = audit.version === 2
    ? { ...audit, entries: [...audit.entries, { ...historical,
      originalRecordSha256: trace.originalRecordSha256 } satisfies FingerprintedAuditEntry] }
    : { ...audit, entries: [...audit.entries, historical] };
  const classify = (emitted = trace, reference = original.reference) =>
    classifySpecAdditions(differences, provider, reference, original.url,
      contradictory, original, [], emitted)[0]?.kind;
  assert.equal(classify(), "reused");
  assert.equal(classify({ ...trace, originalRecordSha256: "0".repeat(64) }), "pending");
  assert.equal(classify(trace, "OTRA REFERENCIA"), "pending");
  assert.equal(classifySpecAdditions(differences, provider, original.reference, original.url,
    contradictory, original, [], { ...trace,
      entries: trace.entries.map((candidate) => {
        if (candidate.field !== entry.field || candidate.scope !== "model-document") return candidate;
        const { verification: excluded, ...withoutVerification } = candidate;
        assert.ok(excluded);
        return withoutVerification;
      }) })[0]?.kind, "pending");
});

test("el panel muestra la potencia original del XT4014KH aunque la matriz indique reutilización", async () => {
  const root = process.cwd();
  const [snapshot, audit, originals] = await Promise.all([
    readPanelSnapshot(root), loadSpecAdditionAudit(root), readPortableOriginal(root, "gam")
  ]);
  assert.ok(audit);
  const provider = snapshot.providers.find((candidate) => candidate.providerId === "gam");
  const original = originals.products.find((candidate) => candidate.reference === "4817");
  assert.ok(provider);
  assert.ok(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  const entry = trace.entries.find((candidate) => candidate.field === "Potencia nominal del motor");
  assert.ok(entry && entry.scope === "unit");
  assert.equal(entry.value, "74 kW");
  assert.ok(audit.entries.some((candidate) => candidate.providerId === "gam" &&
    candidate.reference === original.reference && candidate.field === entry.field &&
    candidate.value === entry.value && candidate.kind === "own"));
  const differences: readonly PanelFieldDifference[] = [
    { field: entry.field, group: "technical", change: "added", before: null, after: entry.value }
  ];
  const historical: AuditEntry = {
    providerId: "gam", reference: original.reference, sourceUrl: original.url,
    field: entry.field, value: entry.value, kind: "reused"
  };
  const contradictory: SpecAdditionAudit = audit.version === 2
    ? { ...audit, entries: [...audit.entries, { ...historical,
      originalRecordSha256: trace.originalRecordSha256 } satisfies FingerprintedAuditEntry] }
    : { ...audit, entries: [...audit.entries, historical] };
  const classify = (emitted = trace, source = original) => classifySpecAdditions(differences, provider,
    original.reference, original.url, contradictory, source, [], emitted)[0]?.kind;
  assert.equal(classify(), "own");
  assert.equal(classify({ ...trace, originalRecordSha256: "0".repeat(64) }), "pending");
  assert.equal(classify(trace, { ...original, title: `${original.title} cambiado` }), "pending");
});
