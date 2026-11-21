import assert from "node:assert/strict";
import test from "node:test";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import type { AuditEntry, FingerprintedAuditEntry, SpecAdditionAudit } from "../../evidence/spec-addition-audit.js";
import { classifySpecAdditions, loadSpecAdditionAudit } from "../spec-addition-classification.js";
import type { PanelFieldDifference } from "../types.js";

const cases = [
  { providerId: "mercaeleva", reference: "M432-1479", field: "Altura máxima de descarga", kind: "reused" },
  { providerId: "mercaeleva", reference: "M238-0251", field: "Altura de plataforma", kind: "reused" },
  { providerId: "gam", reference: "4814", field: "Tracción", kind: "own" }
] as const;

test("el panel representa las tres decisiones productivas aunque la matriz histórica indique otro color", async () => {
  const root = process.cwd();
  const [snapshot, audit, gam, mercaeleva] = await Promise.all([
    readPanelSnapshot(root), loadSpecAdditionAudit(root),
    readPortableOriginal(root, "gam"), readPortableOriginal(root, "mercaeleva")
  ]);
  assert.ok(audit);
  for (const item of cases) {
    const original = (item.providerId === "gam" ? gam.products : mercaeleva.products)
      .find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    const provider = snapshot.providers.find((candidate) => candidate.providerId === item.providerId);
    assert.ok(provider);
    const emitted = prepareSourceProduct(original).technicalProvenance;
    assert.ok(emitted);
    const evidence = emitted.entries.find((candidate) => candidate.field === item.field);
    assert.ok(evidence);
    const differences: readonly PanelFieldDifference[] = [
      { field: evidence.field, group: "technical", change: "added", before: null, after: evidence.value }
    ];
    const contradictoryKind = item.kind === "own" ? "reused" : "own";
    const historical: AuditEntry = {
      providerId: item.providerId, reference: original.reference, sourceUrl: original.url,
      field: item.field, value: evidence.value, kind: contradictoryKind
    };
    const contradictory: SpecAdditionAudit = audit.version === 2
      ? { ...audit, entries: [...audit.entries, { ...historical,
        originalRecordSha256: emitted.originalRecordSha256 } satisfies FingerprintedAuditEntry] }
      : { ...audit, entries: [...audit.entries, historical] };
    const classify = (matrix: SpecAdditionAudit) => classifySpecAdditions(differences, provider,
      original.reference, original.url, matrix, original, [], emitted);
    assert.equal(classify(audit)[0]?.kind, item.kind);
    assert.equal(classify(contradictory)[0]?.kind, item.kind);
    assert.equal(classifySpecAdditions(differences, provider, original.reference, original.url,
      audit, original, [], { ...emitted, originalRecordSha256: "0".repeat(64) })[0]?.kind, "pending");
    assert.equal(classifySpecAdditions(differences, provider, "referencia-falsa", original.url,
      audit, original, [], emitted)[0]?.kind, "pending");
  }
});
