import assert from "node:assert/strict";
import { test } from "node:test";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import type { AuditEntry, FingerprintedAuditEntry, SpecAdditionAudit } from "../../evidence/spec-addition-audit.js";
import { classifySpecAdditions, loadSpecAdditionAudit } from "../spec-addition-classification.js";
import type { PanelFieldDifference } from "../types.js";

test("el panel conserva la elevación acreditada por el motor frente a una matriz contradictoria", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit);
  const provider = snapshot.providers.find((candidate) => candidate.providerId === "gam");
  assert.ok(provider);
  const { products } = await readPortableOriginal(root, "gam");
  const original = products.find((candidate) => candidate.reference === "237");
  assert.ok(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  const field = "Elevación";
  const evidence = trace.entries.find((candidate) => candidate.field === field);
  assert.ok(evidence && evidence.scope === "model-document" && evidence.verification);
  const differences: readonly PanelFieldDifference[] = [
    { field, group: "technical", change: "added", before: null, after: evidence.value }
  ];
  const contradiction: AuditEntry = {
    providerId: "gam", reference: original.reference, sourceUrl: original.url,
    field, value: evidence.value, kind: "own"
  };
  const conflicting: SpecAdditionAudit = audit.version === 2
    ? { ...audit, entries: [...audit.entries, { ...contradiction,
      originalRecordSha256: trace.originalRecordSha256 } satisfies FingerprintedAuditEntry] }
    : { ...audit, entries: [...audit.entries, contradiction] };
  const classify = (matrix: SpecAdditionAudit, emitted = trace) =>
    classifySpecAdditions(differences, provider, original.reference, original.url, matrix, original, [], emitted);
  assert.deepEqual(classify(audit).map((entry) => entry.kind), ["reused"]);
  assert.deepEqual(classify(conflicting).map((entry) => entry.kind), ["reused"]);
  assert.deepEqual(classify(audit, { ...trace, originalRecordSha256: "0".repeat(64) })
    .map((entry) => entry.kind), ["pending"]);
});
