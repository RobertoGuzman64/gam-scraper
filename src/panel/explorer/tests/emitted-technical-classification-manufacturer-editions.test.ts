import assert from "node:assert/strict";
import { test } from "node:test";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import type { AuditEntry, FingerprintedAuditEntry, SpecAdditionAudit } from "../../evidence/spec-addition-audit.js";
import { classifySpecAdditions, loadSpecAdditionAudit } from "../spec-addition-classification.js";
import type { PanelFieldDifference } from "../types.js";

test("el panel usa la acreditación JLG 2015 del motor aunque la matriz histórica discrepe", async () => {
  const root = process.cwd();
  const [snapshot, audit, originals] = await Promise.all([
    readPanelSnapshot(root), loadSpecAdditionAudit(root), readPortableOriginal(root, "mercaeleva")
  ]);
  assert.ok(audit);
  const provider = snapshot.providers.find((candidate) => candidate.providerId === "mercaeleva");
  const original = originals.products.find((candidate) => candidate.reference === "M209-3306");
  assert.ok(provider);
  assert.ok(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  const entry = trace.entries.find((candidate) => candidate.field === "Altura de plataforma");
  assert.ok(entry && entry.scope === "model-document" && entry.verification);
  assert.equal(entry.value, "20,31 m");
  const differences: readonly PanelFieldDifference[] = [
    { field: entry.field, group: "technical", change: "added", before: null, after: entry.value }
  ];
  const historical: AuditEntry = {
    providerId: "mercaeleva", reference: original.reference, sourceUrl: original.url,
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
