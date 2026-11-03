import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

test("acepta el alias portátil cuando original y acreditación mantienen el prefijo canónico", async () => {
  await withRoot(async (root) => {
    const providerId = "gam";
    const name = `scrape-${providerId}`;
    const prefix = "scrape-gam-historico";
    const directory = join(root, "catalogs", "providers", providerId, "original");
    await mkdir(directory, { recursive: true });
    const catalog = {
      prefix, providerId, scope: "historico", startedAt: "2026-01-01T00:00:00Z",
      endedAt: "2026-01-01T01:00:00Z", productCount: 1
    };
    const content = JSON.stringify(catalog);
    const hash = createHash("sha256").update(content).digest("hex");
    const manifest = { ...catalog, catalogSha256: hash };
    const summary = {
      quality: { status: "complete", published: true },
      totals: { scrapedProducts: 1 }, startedAt: catalog.startedAt, endedAt: catalog.endedAt,
      artifacts: { catalogSha256: hash }
    };
    await writeFile(join(directory, `${name}-catalog.json`), content);
    await writeFile(join(directory, `${name}-catalog.manifest.json`), JSON.stringify(manifest));
    await writeFile(join(directory, `${name}-summary.json`), JSON.stringify(summary));
    await mkdir(join(root, "storage"));
    const valid = run(root);
    assert.equal(valid.status, 0);
    assert.deepEqual(JSON.parse(valid.stdout).originals.verified, [
      `catalogs/providers/${providerId}/original/${name}-catalog.json`
    ]);

    await writeFile(join(directory, `${name}-catalog.manifest.json`), JSON.stringify({ ...manifest, prefix: "otro" }));
    const invalidManifest = run(root);
    assert.equal(invalidManifest.status, 1);
    assert.equal(JSON.parse(invalidManifest.stdout).originals.issues.length, 1);

    await writeFile(join(directory, `${name}-catalog.manifest.json`), JSON.stringify(manifest));
    await writeFile(join(directory, `${name}-catalog.json`), JSON.stringify({ ...catalog, prefix: "otro" }));
    const invalidCatalog = run(root);
    assert.equal(invalidCatalog.status, 1);
    assert.equal(JSON.parse(invalidCatalog.stdout).originals.issues.length, 1);
  });
});
