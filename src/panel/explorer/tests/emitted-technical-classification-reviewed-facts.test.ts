import assert from "node:assert/strict";
import test from "node:test";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import type { AuditEntry, FingerprintedAuditEntry, SpecAdditionAudit } from "../../evidence/spec-addition-audit.js";
import { classifySpecAdditions, loadSpecAdditionAudit } from "../spec-addition-classification.js";
import type { PanelFieldDifference } from "../types.js";

const references = [
  { providerId: "gam", reference: "5918", fields: ["Número de plazas del modelo"] },
  { providerId: "gam", reference: "237", fields: ["Propulsión", "Descenso de carga"] },
  { providerId: "gam", reference: "2266", fields: ["Rotación del cabezal trilateral"] },
  { providerId: "gam", reference: "4817", fields: ["Tracción"] },
  { providerId: "mercaeleva", reference: "M913-0641", fields: ["Altura máxima de descarga"] }
] as const;

test("fase 38: las seis decisiones del motor prevalecen sobre la matriz histórica, sin pérdida de trazabilidad", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit);
  let classified = 0;
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const originals = await readPortableOriginal(root, providerId);
    const provider = snapshot.providers.find((entry) => entry.providerId === providerId);
    assert.ok(provider);
    for (const item of references.filter((entry) => entry.providerId === providerId)) {
      const original = originals.products.find((entry) => entry.reference === item.reference);
      assert.ok(original);
      const emitted = prepareSourceProduct(original).technicalProvenance;
      assert.ok(emitted);
      const changes: readonly PanelFieldDifference[] = emitted.entries.filter((entry) =>
        item.fields.some((field) => field === entry.field)).map((entry) => ({
        field: entry.field, group: "technical", change: "added", before: null, after: entry.value
      }));
      assert.equal(changes.length, item.fields.length);
      const historical: readonly AuditEntry[] = changes.map((change) => ({
        providerId, reference: original.reference, sourceUrl: original.url,
        field: change.field, value: change.after ?? "", kind: "own"
      }));
      const contradictory: SpecAdditionAudit = audit.version === 2
        ? { ...audit, entries: [...audit.entries, ...historical.map((entry): FingerprintedAuditEntry => ({
          ...entry, originalRecordSha256: emitted.originalRecordSha256
        }))] }
        : { ...audit, entries: [...audit.entries, ...historical] };
      const classify = (matrix: SpecAdditionAudit = audit) =>
        classifySpecAdditions(changes, provider, original.reference, original.url, matrix, original, [], emitted);
      assert.ok(classify().every((entry) => entry.kind === "reused"));
      assert.ok(classify(contradictory).every((entry) => entry.kind === "reused"));
      assert.ok(classifySpecAdditions(changes, provider, original.reference, original.url,
        audit, original, [], { ...emitted, originalRecordSha256: "0".repeat(64) })
        .every((entry) => entry.kind === "pending"));
      assert.ok(classifySpecAdditions(changes, provider, "referencia-falsa", original.url,
        audit, original, [], emitted).every((entry) => entry.kind === "pending"));
      classified += changes.length;
    }
  }
  assert.equal(classified, 6);
});
