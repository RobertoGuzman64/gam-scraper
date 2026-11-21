import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { productIdentity } from "../../explorer/explorer-identity.js";
import { loadSpecAdditionAudit, originalRecordFingerprint } from "../spec-addition-audit.js";

test("las decisiones históricas se conservan y las 204 acreditaciones documentales tienen huella real", async () => {
  const root = process.cwd();
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit);
  assert.equal(audit.version, 2);
  if (audit.version !== 2) return;
  assert.equal(audit.entries.length, 2792);
  assert.equal(createHash("sha256").update(JSON.stringify(audit.entries.slice(0, 2588))).digest("hex"),
    "6ea60125a30082b4e4d6b7fd6e4a623766ce931c0bcbe14b69cb72b30946b948");
  const counts = { own: 0, reused: 0 };
  const sourceRecords = new Set<string>();
  for (const providerId of ["gam", "gomariz", "mercaeleva"] as const) {
    const catalog = await readPortableOriginal(root, providerId);
    const originals = new Map(catalog.products.map((item) => [productIdentity(providerId, item.reference, item.url), item]));
    for (const entry of audit.entries.filter((item) => item.providerId === providerId)) {
      const key = productIdentity(entry.providerId, entry.reference, entry.sourceUrl);
      const original = originals.get(key);
      assert.ok(original, key);
      assert.equal(entry.originalRecordSha256, originalRecordFingerprint(original), key);
      sourceRecords.add(key);
      counts[entry.kind]++;
    }
  }
  assert.deepEqual(counts, { own: 1942, reused: 850 });
  assert.equal(sourceRecords.size, 1086);
});

test("la huella es estable al reordenar propiedades y cambia al cambiar la ficha", async () => {
  const original = (await readPortableOriginal(process.cwd(), "gam")).products[0];
  assert.ok(original);
  const { model, ...rest } = original;
  assert.equal(originalRecordFingerprint(original), originalRecordFingerprint({ model, ...rest }));
  assert.notEqual(originalRecordFingerprint(original), originalRecordFingerprint({ ...original, title: "Otro título" }));
});

test("la carga distingue el sidecar histórico del migrado y rechaza huellas no válidas", async () => {
  const root = await mkdtemp(join(tmpdir(), "eqz-audit-"));
  const path = join(root, "src", "panel", "evidence", "spec-addition-audit.json");
  try {
    await mkdir(join(root, "src", "panel", "evidence"), { recursive: true });
    const sha = "a".repeat(64);
    const cuts = Object.fromEntries(["gam", "gomariz", "mercaeleva"].map((providerId) =>
      [providerId, { originalSha256: sha, publicationSha256: sha }]));
    const entry = { providerId: "gam", reference: "1", sourceUrl: "https://example.org/1",
      field: "Potencia", value: "2 kW", kind: "own" };
    await writeFile(path, JSON.stringify({ version: 1, cuts, entries: [entry] }));
    assert.equal((await loadSpecAdditionAudit(root))?.version, 1);
    await writeFile(path, JSON.stringify({ version: 2, cuts, entries: [entry] }));
    await assert.rejects(loadSpecAdditionAudit(root), /inválida/);
    await writeFile(path, JSON.stringify({ version: 2, cuts, entries: [
      { ...entry, originalRecordSha256: sha }, { ...entry, originalRecordSha256: sha }
    ] }));
    await assert.rejects(loadSpecAdditionAudit(root), /duplicada/);
    await writeFile(path, JSON.stringify({ version: 2, cuts, entries: [{ ...entry, originalRecordSha256: sha }] }));
    assert.equal((await loadSpecAdditionAudit(root))?.version, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
