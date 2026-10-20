import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runBatch } from "../run.js";
import type { BatchOptions } from "../types.js";
import { getProvider } from "../../../scraping/registry.js";

const stubScript = `
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2);
const get = (key) => args[args.indexOf(key) + 1];
const id = get('--provider');
const dir = get('--outDir');
const prefix = get('--outPrefix');
mkdirSync(dir, { recursive: true });
if (process.env.FAILED_PROVIDER === id) process.exit(2);
if (process.env.STALE_REPORT === 'true') process.exit(0);
writeFileSync(join(dir, prefix + '-summary.json'), JSON.stringify({
 startedAt: new Date().toISOString(), quality: { status: 'complete', published: true },
 totals: { scrapedProducts: 12, failures: 0 }
}));
writeFileSync(join(dir, prefix + '-changes.json'), JSON.stringify({
 status: 'comparable', added: ['p1', 'p2'], updated: ['p3'], suspectedMissing: []
}));
console.log('OK:', id);
`;

const withFolder = async (fn: (folder: string) => Promise<void>): Promise<void> => {
  const folder = await mkdtemp(join(tmpdir(), "eq-batch-f4-"));
  try { await fn(folder); } finally { await rm(folder, { recursive: true, force: true }); }
};

const optionsFor = (folder: string, providerIds: readonly string[]): BatchOptions => ({
  providerIds, outRoot: join(folder, "scraped"), historyDir: join(folder, "history"), dryRun: false
});

const runWithStub = async (folder: string, options: BatchOptions) => {
  const script = join(folder, "scraper-stub.mjs");
  await writeFile(script, stubScript);
  return runBatch(options, script);
};

test("guarda informes y logs separados y elimina el bloqueo al terminar", async () => {
  await withFolder(async (folder) => {
    const result = await runWithStub(folder, optionsFor(folder, ["gam", "gomariz"]));
    assert.equal(result.report.status, "complete");
    assert.equal(result.report.providers.length, 2);
    for (const run of result.report.providers) {
      assert.equal(run.status, "complete");
      assert.equal(run.products, 12);
      assert.equal(run.added, 2);
      assert.equal(run.updated, 1);
      assert.equal(run.suspectedMissing, 0);
      assert.match(await readFile(run.logFile, "utf8"), /OK:/);
      assert.ok(run.archivedSummaryFile);
      assert.ok(run.archivedChangesFile);
      assert.equal(JSON.parse(await readFile(run.archivedSummaryFile, "utf8")).totals.scrapedProducts, 12);
      assert.deepEqual(JSON.parse(await readFile(run.archivedChangesFile, "utf8")).added, ["p1", "p2"]);
      assert.equal(run.outputPrefix, getProvider(run.providerId).defaultOptions.outPrefix);
      assert.ok(run.outputDir.endsWith(run.providerId));
    }
    assert.deepEqual(JSON.parse(await readFile(result.reportFile, "utf8")), result.report);
    assert.equal((await readdir(optionsFor(folder, []).historyDir)).length, 1);
    await assert.rejects(stat(join(folder, "scraped", ".batch.lock")), /ENOENT/);
  });
});

test("continúa con otro proveedor tras error e indica estado parcial", async () => {
  await withFolder(async (folder) => {
    const previous = process.env.FAILED_PROVIDER;
    process.env.FAILED_PROVIDER = "gam";
    try {
      const result = await runWithStub(folder, optionsFor(folder, ["gam", "gomariz"]));
      assert.equal(result.report.status, "partial");
      assert.equal(result.report.providers[0]?.status, "failed");
      assert.equal(result.report.providers[1]?.status, "complete");
      assert.match(result.report.providers[0]?.error ?? "", /código 2/);
    } finally {
      if (previous === undefined) delete process.env.FAILED_PROVIDER;
      else process.env.FAILED_PROVIDER = previous;
    }
  });
});

test("rechaza informe obsoleto aunque el proceso hijo salga con código cero", async () => {
  await withFolder(async (folder) => {
    const outDir = join(folder, "scraped", "gam");
    const prefix = getProvider("gam").defaultOptions.outPrefix;
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, `${prefix}-summary.json`), JSON.stringify({
      startedAt: "2000-01-01T00:00:00.000Z", quality: { status: "complete", published: true }, totals: { scrapedProducts: 99, failures: 0 }
    }));
    const previous = process.env.STALE_REPORT;
    process.env.STALE_REPORT = "true";
    try {
      const result = await runWithStub(folder, optionsFor(folder, ["gam"]));
      assert.equal(result.report.status, "failed");
      assert.match(result.report.providers[0]?.error ?? "", /resumen no confirma/);
    } finally {
      if (previous === undefined) delete process.env.STALE_REPORT;
      else process.env.STALE_REPORT = previous;
    }
  });
});

test("bloquea ejecuciones concurrentes sin reemplazar el bloqueo existente", async () => {
  await withFolder(async (folder) => {
    const options = optionsFor(folder, ["gam"]);
    await mkdir(options.outRoot, { recursive: true });
    const lockPath = join(options.outRoot, ".batch.lock");
    await writeFile(lockPath, "ejecución en curso");
    await assert.rejects(runWithStub(folder, options), /Ya hay una ejecución/);
    assert.equal(await readFile(lockPath, "utf8"), "ejecución en curso");
  });
});
