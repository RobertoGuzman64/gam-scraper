import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runBatch, type BatchObserver } from "../run.js";
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
if (process.env.EVENTS_PROVIDER === id && process.send) {
 process.send({channel: 'equipzilla:scrape', event: {type:'stage',stage:'descubriendo categorías',resource:'https://example.invalid'}});
 process.send({channel: 'equipzilla:scrape', event: {type:'progress',progress:{categoryName:'Maquinaria',position:1,count:3,phase:'listing',pagesScanned:4,found:12,processed:0,totalProducts:0,elapsedSeconds:3,idleSeconds:0}}});
}
mkdirSync(dir, { recursive: true });
if (process.env.FAILED_PROVIDER === id) {
 if (process.send) await new Promise(resolve => process.send({channel:'equipzilla:scrape',event:{type:'failure',stage:'paginación',resource:'https://example.invalid/page/7',reason:'Chrome: error detallado de navegación'}}, resolve));
 process.exit(2);
}
if (process.env.WAIT_PROVIDER === id) await new Promise(resolve => setTimeout(resolve, 5000));
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

test("recibe etapas y contadores del hijo mediante IPC mientras sigue ejecutándose", async () => {
  await withFolder(async (folder) => {
    const previous = process.env.EVENTS_PROVIDER;
    process.env.EVENTS_PROVIDER = "gam";
    const events: string[] = [];
    const observer: BatchObserver = {
      start: () => events.push("inicio"),
      begin: () => events.push("proveedor"),
      progress: (_providerId, event) => events.push(event.type === "progress" ? `páginas:${event.progress.pagesScanned}` : event.type),
      end: () => events.push("fin")
    };
    try {
      const script = join(folder, "scraper-stub.mjs");
      await writeFile(script, stubScript);
      const result = await runBatch(optionsFor(folder, ["gam"]), script, observer);
      assert.equal(result.report.status, "complete");
      assert.deepEqual(events, ["inicio", "proveedor", "stage", "páginas:4", "fin"]);
      assert.match(await readFile(result.report.providers[0]!.logFile, "utf8"), /OK: gam/);
    } finally {
      if (previous === undefined) delete process.env.EVENTS_PROVIDER;
      else process.env.EVENTS_PROVIDER = previous;
    }
  });
});

test("conserva en el informe la causa completa de un fallo del proceso hijo", async () => {
  await withFolder(async (folder) => {
    const previous = process.env.FAILED_PROVIDER;
    process.env.FAILED_PROVIDER = "gam";
    try {
      const result = await runWithStub(folder, optionsFor(folder, ["gam"]));
      assert.match(result.report.providers[0]?.error ?? "", /Chrome: error detallado de navegación/);
      assert.match(result.report.providers[0]?.error ?? "", /example\.invalid\/page\/7/);
    } finally {
      if (previous === undefined) delete process.env.FAILED_PROVIDER;
      else process.env.FAILED_PROVIDER = previous;
    }
  });
});

test("una cancelación aborta el hijo, registra estado fallido y libera el bloqueo", async () => {
  await withFolder(async (folder) => {
    const previous = process.env.WAIT_PROVIDER;
    process.env.WAIT_PROVIDER = "gam";
    const abort = new AbortController();
    const script = join(folder, "scraper-stub.mjs");
    await writeFile(script, stubScript);
    const timer = setTimeout(() => abort.abort(), 200);
    try {
      const result = await runBatch(optionsFor(folder, ["gam", "gomariz"]), script, undefined, abort.signal);
      assert.equal(result.report.status, "failed");
      assert.equal(result.report.providers.length, 1);
      assert.match(result.report.providers[0]?.error ?? "", /cancelado/);
      await assert.rejects(stat(join(folder, "scraped", ".batch.lock")), /ENOENT/);
    } finally {
      clearTimeout(timer);
      if (previous === undefined) delete process.env.WAIT_PROVIDER;
      else process.env.WAIT_PROVIDER = previous;
    }
  });
});
