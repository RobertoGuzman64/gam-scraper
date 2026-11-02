import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../inspect-artifacts.mjs", import.meta.url));

const run = (root) => spawnSync(process.execPath, [script, "--root", root, "--json"], { encoding: "utf8" });

const withRoot = async (task) => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-inventario-"));
  try { await task(root); } finally { await rm(root, { recursive: true, force: true }); }
};

test("simulación solo lee, clasifica originales y no presenta migraciones ni borrados", async () => {
  await withRoot(async (root) => {
    const path = join(root, "storage", "prepared", "gam", "gam-preparation.json");
    await mkdir(dirname(path), { recursive: true });
    await mkdir(join(root, "catalogs"));
    await writeFile(path, "{}", { flag: "wx" });
    const result = run(root);
    assert.equal(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.mode, "SIMULACION_SOLO_LECTURA");
    assert.deepEqual(report.counts, { internal: 1, external: 0, files: 1, bytes: 2, eliminations: 0, migrations: 0 });
    assert.equal(report.families[0].family, "preparaciones");
    assert.equal(report.families[0].bloqueado, 1);
    assert.equal(report.entries[0].state, "bloqueado");
  });
});

test("un original sin manifest queda bloqueado con diagnóstico explícito", async () => {
  await withRoot(async (root) => {
    const path = join(root, "catalogs", "providers", "gam", "original", "gam-catalog.json");
    await mkdir(dirname(path), { recursive: true });
    await mkdir(join(root, "storage"));
    await writeFile(path, "{}", { flag: "wx" });
    const result = run(root);
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.originals.verified.length, 0);
    assert.equal(report.issues.length, 1);
    assert.match(report.issues[0].reason, /incompleto/);
    assert.equal(report.counts.migrations, 0);
  });
});
