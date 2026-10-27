import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../scripts/migrate-storage.mjs");
const hash = (value: string): string => createHash("sha256").update(value).digest("hex");

const fixture = async (): Promise<{ root: string; cleanup: () => Promise<void> }> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-storage-migration-"));
  await mkdir(join(root, "scripts"));
  await copyFile(script, join(root, "scripts", "migrate-storage.mjs"));
  const directory = join(root, "data", "referencia");
  await mkdir(directory, { recursive: true });
  const report = JSON.stringify({ version: 1, currentRunId: "run-1", previousRunId: null, baseline: "initial" });
  const catalogs = ["gam", "gomariz", "mercaeleva"].map((providerId) => {
    const raw = JSON.stringify({ providerId });
    return { providerId, raw, sha256: hash(raw) };
  });
  for (const { providerId, raw } of catalogs) await writeFile(join(directory, `${providerId}.json`), raw);
  await writeFile(join(directory, "diferencias.json"), report);
  await writeFile(join(directory, "manifest.json"), JSON.stringify({
    version: 1,
    catalogs: catalogs.map(({ providerId, sha256 }) => ({ providerId, sha256 })),
    differencesSha256: hash(report)
  }));
  await mkdir(join(root, "storage", "campanas"), { recursive: true });
  await mkdir(join(root, "storage", "scraped", "campanas"), { recursive: true });
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
};

const migrate = (root: string, args: readonly string[] = []): { readonly status: number | null; readonly stderr: string } => {
  const result = spawnSync(process.execPath, [join(root, "scripts", "migrate-storage.mjs"), ...args], {
    cwd: root, encoding: "utf8", timeout: 5000
  });
  return { status: result.status, stderr: result.stderr };
};

test("migrates legacy reference and empty campaign directories without changing SHA256", async () => {
  const { root, cleanup } = await fixture();
  try {
    const oldReport = await readFile(join(root, "data", "referencia", "diferencias.json"));
    assert.equal(migrate(root).status, 0);
    assert.deepEqual((await readdir(join(root, "data", "reference"))).sort(),
      ["differences.json", "gam.json", "gomariz.json", "manifest.json", "mercaeleva.json"].sort());
    assert.deepEqual(await readFile(join(root, "data", "reference", "differences.json")), oldReport);
    await assert.rejects(lstat(join(root, "data", "referencia")), { code: "ENOENT" });
    await lstat(join(root, "storage", "campaigns"));
    await lstat(join(root, "storage", "scraped", "campaigns"));
    assert.equal(migrate(root).status, 0);
  } finally { await cleanup(); }
});

test("rejects altered legacy reference without moving or deleting it", async () => {
  const { root, cleanup } = await fixture();
  try {
    await writeFile(join(root, "data", "referencia", "gam.json"), "{}");
    const result = migrate(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /SHA256 mismatch/);
    await lstat(join(root, "data", "referencia", "gam.json"));
    await assert.rejects(lstat(join(root, "data", "reference")), { code: "ENOENT" });
  } finally { await cleanup(); }
});

test("blocks migration when legacy campaign data is still present", async () => {
  const { root, cleanup } = await fixture();
  try {
    await writeFile(join(root, "storage", "campanas", "do-not-remove.txt"), "preserved");
    const result = migrate(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Complete and clean the campaign/);
    assert.equal(await readFile(join(root, "storage", "campanas", "do-not-remove.txt"), "utf8"), "preserved");
    await lstat(join(root, "data", "referencia"));
    await assert.rejects(lstat(join(root, "data", "reference")), { code: "ENOENT" });
  } finally { await cleanup(); }
});

test("rejects destination collision without modifying either directory", async () => {
  const { root, cleanup } = await fixture();
  try {
    await mkdir(join(root, "data", "reference"));
    assert.equal(migrate(root).status, 1);
    await lstat(join(root, "data", "referencia", "manifest.json"));
    assert.deepEqual(await readdir(join(root, "data", "reference")), []);
  } finally { await cleanup(); }
});

test("converts an external exported reference without changing its SHA256", async () => {
  const { root, cleanup } = await fixture();
  const transfer = await mkdtemp(join(tmpdir(), "equipzilla-reference-transfer-"));
  try {
    const files = await readdir(join(root, "data", "referencia"));
    for (const filename of files) await copyFile(join(root, "data", "referencia", filename), join(transfer, filename));
    const before = await readFile(join(transfer, "diferencias.json"));
    assert.equal(migrate(root, ["--transfer", transfer]).status, 0);
    assert.deepEqual(await readFile(join(transfer, "differences.json")), before);
    assert.equal(migrate(root, ["--transfer", transfer]).status, 0);
    await lstat(join(root, "data", "referencia", "manifest.json"));
  } finally { await cleanup(); await rm(transfer, { recursive: true, force: true }); }
});
