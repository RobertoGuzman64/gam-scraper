import assert from "node:assert/strict";
import { copyFile, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readVerifiedManainRecordSource } from "../originals/manain-record-source.js";
import { runTechnicalPublication } from "../../../../cli/commands/catalog/publications/technical-publication.js";

const production = process.cwd();
const source = join(production, "catalogs", "providers", "manain");
const activeVersion = async (): Promise<string> => {
  const active: unknown = JSON.parse(await readFile(join(source, "technical", "active.json"), "utf8"));
  if (active === null || typeof active !== "object" || Array.isArray(active) ||
    !("sha256" in active) || typeof active.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(active.sha256)) {
    throw new Error("Índice técnico de prueba inválido");
  }
  return active.sha256;
};

const fixture = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "eqz-manain-source-"));
  const version = await activeVersion();
  const destination = join(root, "catalogs", "providers", "manain");
  const technical = join(destination, "technical");
  const snapshots = join(technical, "versions", version);
  await mkdir(join(destination, "records"), { recursive: true });
  await mkdir(snapshots, { recursive: true });
  await copyFile(join(source, "records", "manain-record.json"), join(destination, "records", "manain-record.json"));
  await copyFile(join(source, "technical", "active.json"), join(technical, "active.json"));
  for (const name of ["snapshot.json", "manifest.json"]) {
    await copyFile(join(source, "technical", "versions", version, name), join(snapshots, name));
  }
  return root;
};

test("Manain: verifica el registro parcial conservado contra su versión técnica activa", async () => {
  const verified = await readVerifiedManainRecordSource(production);
  assert.ok(verified.originalProducts.length > 0);
  assert.equal(verified.snapshot.quality, "partial");
  assert.equal(verified.snapshot.totals.ready + verified.snapshot.totals.review, verified.originalProducts.length);
  assert.equal(verified.snapshot.source.kind, "manain-record");
  assert.equal(verified.snapshot.source.kind === "manain-record" ? verified.snapshot.source.recordSha256 : null, verified.recordSha256);
});

test("Manain: rechaza alteraciones del registro y mantiene intacta la publicación técnica", async () => {
  const root = await fixture();
  try {
    const recordFile = join(root, "catalogs", "providers", "manain", "records", "manain-record.json");
    const before = await readFile(recordFile, "utf8");
    const verified = await readVerifiedManainRecordSource(root);
    const reference = verified.originalProducts[0]?.reference;
    assert.ok(reference);
    const tampered = before.replace(`"reference": "${reference}"`, `"reference": "${reference}-ALTERADA"`);
    assert.notEqual(tampered, before);
    await writeFile(recordFile, tampered);
    await assert.rejects(readVerifiedManainRecordSource(root), /Procedencia parcial/);
    await assert.rejects(runTechnicalPublication(["manain", "--ver", "--json"], root), /Procedencia parcial/);
    await writeFile(recordFile, before);
    assert.ok((await readVerifiedManainRecordSource(root)).snapshot.products.length > 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Manain: rechaza una versión técnica alterada y un registro enlazado", async (t) => {
  const root = await fixture();
  try {
    const manifestFile = join(root, "catalogs", "providers", "manain", "technical", "versions", await activeVersion(), "manifest.json");
    const original = await readFile(manifestFile, "utf8");
    await writeFile(manifestFile, original.replace('"partial"', '"complete"'));
    await assert.rejects(readVerifiedManainRecordSource(root), /alterado|Manifest|Corte técnico/);
    await writeFile(manifestFile, original);
    const recordFile = join(root, "catalogs", "providers", "manain", "records", "manain-record.json");
    const real = `${recordFile}.real`;
    const data = await readFile(recordFile);
    await rm(recordFile);
    await writeFile(real, data);
    try { await symlink(real, recordFile); }
    catch (error) {
      t.diagnostic(`Enlace simbólico no disponible: ${String(error)}`);
      return;
    }
    assert.equal((await lstat(recordFile)).isSymbolicLink(), true);
    await assert.rejects(readVerifiedManainRecordSource(root), /no regular/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
