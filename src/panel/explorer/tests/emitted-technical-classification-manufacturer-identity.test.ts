import assert from "node:assert/strict";
import test from "node:test";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import type { AuditEntry, FingerprintedAuditEntry, SpecAdditionAudit } from "../../evidence/spec-addition-audit.js";
import { classifySpecAdditions, loadSpecAdditionAudit } from "../spec-addition-classification.js";
import type { PanelFieldDifference } from "../types.js";

const cases = [
  { reference: "M971-8124", fields: ["Altura de plataforma", "Anchura con ejes recogidos"] },
  { reference: "M649-6453", fields: ["Longitud de plataforma"] }
] as const;

test("el panel representa tres acreditaciones del motor aunque el histórico contradiga su color", async () => {
  const root = process.cwd();
  const [snapshot, audit, originals] = await Promise.all([
    readPanelSnapshot(root), loadSpecAdditionAudit(root), readPortableOriginal(root, "mercaeleva")
  ]);
  assert.ok(audit);
  const provider = snapshot.providers.find((candidate) => candidate.providerId === "mercaeleva");
  assert.ok(provider);
  let inspected = 0;
  for (const item of cases) {
    const original = originals.products.find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    const emitted = prepareSourceProduct(original).technicalProvenance;
    assert.ok(emitted);
    for (const field of item.fields) {
      const entry = emitted.entries.find((candidate) => candidate.field === field);
      assert.ok(entry);
      assert.ok(entry.scope === "model-document");
      assert.ok(entry.verification);
      const differences: readonly PanelFieldDifference[] = [
        { field: entry.field, group: "technical", change: "added", before: null, after: entry.value }
      ];
      const historical: AuditEntry = {
        providerId: "mercaeleva", reference: original.reference, sourceUrl: original.url,
        field: entry.field, value: entry.value, kind: "own"
      };
      const contradictory: SpecAdditionAudit = audit.version === 2
        ? { ...audit, entries: [...audit.entries, { ...historical,
          originalRecordSha256: emitted.originalRecordSha256 } satisfies FingerprintedAuditEntry] }
        : { ...audit, entries: [...audit.entries, historical] };
      assert.equal(classifySpecAdditions(differences, provider, original.reference, original.url,
        audit, original, [], emitted)[0]?.kind, "reused");
      assert.equal(classifySpecAdditions(differences, provider, original.reference, original.url,
        contradictory, original, [], emitted)[0]?.kind, "reused");
      assert.equal(classifySpecAdditions(differences, provider, original.reference, original.url,
        contradictory, original, [], { ...emitted, originalRecordSha256: "0".repeat(64) })[0]?.kind, "pending");
      assert.equal(classifySpecAdditions(differences, provider, "REFERENCIA INCORRECTA", original.url,
        contradictory, original, [], emitted)[0]?.kind, "pending");
      inspected++;
    }
  }
  assert.equal(inspected, 3);
});
