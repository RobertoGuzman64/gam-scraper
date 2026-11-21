import assert from "node:assert/strict";
import { test } from "node:test";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import type { AuditEntry, FingerprintedAuditEntry, SpecAdditionAudit } from "../../evidence/spec-addition-audit.js";
import { classifySpecAdditions, loadSpecAdditionAudit } from "../spec-addition-classification.js";
import type { PanelFieldDifference } from "../types.js";

test("el panel utiliza la acreditación de CTE emitida por el motor pese a la matriz histórica", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit);
  const { products } = await readPortableOriginal(root, "gam");
  const original = products.find((candidate) => candidate.reference === "6190");
  assert.ok(original);
  const provider = snapshot.providers.find((candidate) => candidate.providerId === "gam");
  assert.ok(provider);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  const evidence = trace.entries.find((candidate) => candidate.field === "Altura de plataforma");
  assert.ok(evidence);
  const changes: readonly PanelFieldDifference[] = [
    { field: evidence.field, group: "technical", change: "added", before: null, after: evidence.value }
  ];
  const contradiction: AuditEntry = { providerId: "gam", reference: original.reference,
    sourceUrl: original.url, field: evidence.field, value: evidence.value, kind: "own" };
  const contradictory: SpecAdditionAudit = audit.version === 2
    ? { ...audit, entries: [...audit.entries, { ...contradiction,
      originalRecordSha256: trace.originalRecordSha256 } satisfies FingerprintedAuditEntry] }
    : { ...audit, entries: [...audit.entries, contradiction] };
  const classify = (matrix: SpecAdditionAudit, emission = trace) =>
    classifySpecAdditions(changes, provider, original.reference, original.url, matrix, original, [], emission);
  assert.equal(classify(audit)[0]?.kind, "reused");
  assert.equal(classify(contradictory)[0]?.kind, "reused");
  assert.equal(classify(audit, { ...trace, originalRecordSha256: "0".repeat(64) })[0]?.kind, "pending");
  assert.equal(classifySpecAdditions(changes, provider, "otra-referencia", original.url,
    audit, original, [], trace)[0]?.kind, "pending");
});
