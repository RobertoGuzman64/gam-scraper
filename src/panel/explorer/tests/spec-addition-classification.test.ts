import assert from "node:assert/strict";
import { test } from "node:test";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { readPanelExplorer } from "../read-panel-explorer.js";
import { classifySpecAdditions, loadSpecAdditionAudit } from "../spec-addition-classification.js";
import type { PanelFieldDifference } from "../types.js";

const difference = (field: string, after: string, change: PanelFieldDifference["change"] = "added"): PanelFieldDifference =>
  ({ field, group: "technical", before: null, after, change });

test("clasifica todas las specs realmente incorporadas y no colorea las modificadas", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const explorer = await readPanelExplorer(process.cwd(), snapshot);
  const counts = { own: 0, reused: 0, pending: 0 };
  for (const product of explorer.products) {
    const added = product.changes.filter((item) => item.group === "technical" && item.change === "added");
    assert.equal(product.specAdditions.length, added.length);
    for (const entry of product.specAdditions) {
      assert.equal(added.find((item) => item.field === entry.field)?.after, entry.value);
      counts[entry.kind]++;
    }
  }
  assert.deepEqual(counts, { own: 455, reused: 482, pending: 1961 });
});

test("la reutilización representa un perfil técnico común aplicado a varias fichas", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const source = snapshot.providers.find((item) => item.providerId === "mercaeleva");
  assert.ok(source);
  const shared = audit.entries.filter((item) => item.kind === "reused" &&
    ["M264-2806", "M082-5310"].includes(item.reference ?? "") && item.field === "Alcance horizontal (m)");
  assert.equal(shared.length, 2);
  assert.equal(new Set(shared.map((item) => item.reference)).size, 2);
  assert.equal(new Set(shared.map((item) => item.value)).size, 1);
  for (const item of shared) {
    assert.deepEqual(classifySpecAdditions([difference(item.field, item.value)], source,
      item.reference, item.sourceUrl, audit), [{ field: item.field, value: item.value, kind: "reused" }]);
  }
});

test("caduca la atribución si cambia el corte, la URL, el campo o el valor", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const example = audit.entries.find((item) => item.providerId === "gam" && item.kind === "own");
  assert.ok(example);
  const provider = snapshot.providers.find((item) => item.providerId === example.providerId);
  assert.ok(provider);
  const additions = [difference(example.field, example.value), difference("Campo cambiado", "7", "changed")];
  assert.deepEqual(classifySpecAdditions(additions, provider, example.reference, example.sourceUrl, audit),
    [{ field: example.field, value: example.value, kind: "own" }]);
  assert.equal(classifySpecAdditions(additions, provider, example.reference, example.sourceUrl + "-otra", audit)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions([difference(example.field, "valor distinto")], provider,
    example.reference, example.sourceUrl, audit)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions([difference("Clave distinta", example.value)], provider,
    example.reference, example.sourceUrl, audit)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions(additions, { ...provider,
    publication: { ...provider.publication, sha256: "f".repeat(64) }
  }, example.reference, example.sourceUrl, audit)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions(additions, provider, example.reference, example.sourceUrl, null)[0]?.kind, "pending");
});
