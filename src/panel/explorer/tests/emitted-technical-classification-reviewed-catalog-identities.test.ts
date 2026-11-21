import assert from "node:assert/strict";
import { test } from "node:test";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import type { AuditEntry, FingerprintedAuditEntry, SpecAdditionAudit } from "../../evidence/spec-addition-audit.js";
import { classifySpecAdditions, loadSpecAdditionAudit } from "../spec-addition-classification.js";
import { resolvePanelFieldProvenance } from "../field-provenance.js";
import { readPanelExplorer } from "../read-panel-explorer.js";
import type { PanelFieldDifference } from "../types.js";

const references = [
  { reference: "6805", fields: ["Dimensiones exteriores", "Tipo de frenos"] },
  { reference: "6189", fields: ["Altura sobre obstáculos"] }
] as const;

test("el panel representa las acreditaciones de identidad revisada sin consultar la decisión histórica", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const provider = snapshot.providers.find((item) => item.providerId === "gam");
  assert.ok(provider);
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit);
  const originals = await readPortableOriginal(root, "gam");
  let count = 0;
  for (const item of references) {
    const original = originals.products.find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    const emitted = prepareSourceProduct(original).technicalProvenance;
    assert.ok(emitted);
    const changes: readonly PanelFieldDifference[] = emitted.entries.filter((entry) =>
      item.fields.some((field) => entry.field === field)).map((entry) => ({
      field: entry.field, group: "technical", change: "added", before: null, after: entry.value
    }));
    assert.equal(changes.length, item.fields.length);
    const contrary: readonly AuditEntry[] = changes.map((change) => ({
      providerId: "gam", reference: original.reference, sourceUrl: original.url,
      field: change.field, value: change.after ?? "", kind: "own"
    }));
    const contradictory: SpecAdditionAudit = audit.version === 2 ? {
      ...audit, entries: [...audit.entries, ...contrary.map((entry): FingerprintedAuditEntry => ({
        ...entry, originalRecordSha256: emitted.originalRecordSha256
      }))]
    } : { ...audit, entries: [...audit.entries, ...contrary] };
    const classify = (matrix: SpecAdditionAudit = audit) =>
      classifySpecAdditions(changes, provider, original.reference, original.url, matrix, original, [], emitted);
    assert.ok(classify().every((entry) => entry.kind === "reused"));
    assert.ok(classify(contradictory).every((entry) => entry.kind === "reused"));
    assert.ok(classifySpecAdditions(changes, provider, original.reference, original.url, audit,
      original, [], { ...emitted, originalRecordSha256: "0".repeat(64) })
      .every((entry) => entry.kind === "pending"));
    assert.ok(classifySpecAdditions(changes, provider, "referencia-distinta", original.url, audit,
      original, [], emitted).every((entry) => entry.kind === "pending"));
    count += changes.length;
  }
  assert.equal(count, 3);
});


test("el explorador interpreta la traza revisada sin exigir marca ni modelo estructurados", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const provider = snapshot.providers.find((candidate) => candidate.providerId === "gam");
  assert.ok(provider);
  const { products } = await readPortableOriginal(root, "gam");
  for (const item of references) {
    const original = products.find((candidate) => candidate.reference === item.reference);
    const published = explorer.products.find((candidate) => candidate.providerId === "gam" &&
      candidate.reference === item.reference);
    assert.ok(original);
    assert.ok(published?.published);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    const changes: readonly PanelFieldDifference[] = trace.entries.filter((entry) =>
      item.fields.some((field) => field === entry.field)).map((entry) => ({
      field: entry.field, group: "technical", change: "added", before: null, after: entry.value
    }));
    const verified = resolvePanelFieldProvenance(original, published.published, changes,
      provider, null, original.reference, original.url, trace);
    assert.equal(verified.length, item.fields.length);
    assert.ok(verified.every((entry) => entry.scope === "document-reference" &&
      entry.status === "mechanism-compatible" && entry.historicalApplication === "demonstrated" &&
      entry.verification !== undefined && entry.document?.brand !== null && entry.document?.model !== null));
  }
});
