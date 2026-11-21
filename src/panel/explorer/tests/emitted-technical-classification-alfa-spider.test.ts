import assert from "node:assert/strict";
import { test } from "node:test";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import type { AuditEntry, FingerprintedAuditEntry, SpecAdditionAudit } from "../../evidence/spec-addition-audit.js";
import { classifySpecAdditions, loadSpecAdditionAudit } from "../spec-addition-classification.js";
import type { PanelFieldDifference } from "../types.js";

test("la procedencia acreditada de seis campos Alfa Romeo prevalece sobre la matriz histórica", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit);
  const provider = snapshot.providers.find((candidate) => candidate.providerId === "gam");
  assert.ok(provider);
  const { products } = await readPortableOriginal(root, "gam");
  const original = products.find((candidate) => candidate.reference === "6688");
  assert.ok(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  const fields = [
    "Altura exterior del modelo", "Anchura exterior del modelo", "Distancia entre ejes del modelo",
    "Longitud exterior del modelo", "Tipo de tracción", "Transmisión del modelo"
  ] as const;
  const differences: readonly PanelFieldDifference[] = fields.map((field) => {
    const entry = trace.entries.find((candidate) => candidate.field === field);
    assert.ok(entry && entry.scope === "document-reference" && entry.verification);
    return { field, group: "technical", change: "added", before: null, after: entry.value };
  });
  const contradictory: readonly AuditEntry[] = differences.map((difference) => ({
    providerId: "gam", reference: original.reference, sourceUrl: original.url,
    field: difference.field, value: difference.after ?? "", kind: "own"
  }));
  const withConflict: SpecAdditionAudit = audit.version === 2
    ? { ...audit, entries: [...audit.entries, ...contradictory.map((entry) => ({ ...entry,
      originalRecordSha256: trace.originalRecordSha256 } satisfies FingerprintedAuditEntry))] }
    : { ...audit, entries: [...audit.entries, ...contradictory] };
  const classify = (matrix: SpecAdditionAudit, emitted = trace) =>
    classifySpecAdditions(differences, provider, original.reference, original.url, matrix, original, [], emitted);
  assert.deepEqual(classify(audit).map((entry) => entry.kind), fields.map(() => "reused"));
  assert.deepEqual(classify(withConflict).map((entry) => entry.kind), fields.map(() => "reused"));
  assert.deepEqual(classify(audit, { ...trace, originalRecordSha256: "0".repeat(64) })
    .map((entry) => entry.kind), fields.map(() => "pending"));
});
