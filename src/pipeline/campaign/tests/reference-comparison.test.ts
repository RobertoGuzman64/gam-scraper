import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { compareActiveCampaignReference } from "../reference/compare.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ProviderRun, BatchReport } from "../../../contracts/batch-report.js";

const sha = (input: string): string => createHash("sha256").update(input).digest("hex");
const startedAt = "2026-01-01T08:00:00.000Z";
const endedAt = "2026-01-01T09:00:00.000Z";
const scope = "1".repeat(16);

const product = (providerId: string, price: string | null): ProductRecord => ({
  providerId, categoryKey: "equipos", categoryName: "Equipos", url: `https://ejemplo.test/${providerId}/1`,
  reference: "1", title: "Equipo", shortDescription: null, longDescription: null, price,
  brand: null, model: null, year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: null
});

const writeProvider = async (root: string, providerId: string, price: string | null): Promise<ProviderRun> => {
  const outputDir = join(root, "storage", "scraped", providerId);
  await mkdir(outputDir, { recursive: true });
  const prefix = `extract-${providerId}`;
  const catalogSha256 = await writeCanonicalCatalog(outputDir, prefix, scope, startedAt, endedAt, [product(providerId, price)]);
  const summaryFile = join(outputDir, `${prefix}-summary.json`);
  await writeFile(summaryFile, JSON.stringify({
    startedAt, endedAt, quality: { status: "complete", published: true },
    totals: { scrapedProducts: 1 }, artifacts: { catalogSha256 }
  }));
  return { providerId, status: "complete", startedAt, endedAt, durationMs: 3600000,
    outputDir, outputPrefix: prefix, summaryFile, changesFile: join(outputDir, "changes.json"),
    logFile: join(outputDir, "run.log") };
};

const fixture = async (root: string): Promise<void> => {
  const providers = await Promise.all(CAMPAIGN_PROVIDERS.map((providerId) => writeProvider(root, providerId, null)));
  const runId = "lote-actual";
  const run: BatchReport = {
    version: 1, runId, status: "complete", startedAt: "2026-01-01T07:00:00.000Z",
    endedAt: "2026-01-01T10:00:00.000Z", requestedProviders: [...CAMPAIGN_PROVIDERS], providers
  };
  const runDir = join(root, "storage", "runs", runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "run.json"), JSON.stringify(run));
};

test("compara exclusivamente originales verificados, en modo lectura, con referencia inicial", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-reference-campaign-"));
  try {
    await fixture(root);
    const before = await readdir(root);
    const result = await compareActiveCampaignReference(root);
    assert.equal(result.baseline, "initial");
    assert.equal(result.currentRunId, "lote-actual");
    assert.deepEqual(result.providers.map((item) => item.currentCount), [1, 1, 1, 1]);
    assert.deepEqual(await readdir(root), before);
    const bad = join(root, "storage", "scraped", "gam", "extract-gam-catalog.manifest.json");
    const content = await readFile(bad, "utf8");
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") throw new Error("Manifest de prueba inválido");
    await writeFile(bad, JSON.stringify({ ...parsed, catalogSha256: "0".repeat(64) }));
    await assert.rejects(compareActiveCampaignReference(root), /no existe catálogo original verificable/i);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("compara contra los tres JSON completos guardados, no contra preparaciones publicables", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-reference-campaign-"));
  try {
    await fixture(root);
    const directory = join(root, "data", "reference");
    await mkdir(directory, { recursive: true });
    const catalogs: { providerId: string; prefix: string; scope: string; productCount: number; sha256: string }[] = [];
    for (const providerId of CAMPAIGN_PROVIDERS) {
      const path = join(root, "storage", "scraped", providerId, `extract-${providerId}-catalog.json`);
      const raw = await readFile(path, "utf8");
      await writeFile(join(directory, `${providerId}.json`), raw);
      catalogs.push({ providerId, prefix: `extract-${providerId}`, scope, productCount: 1, sha256: sha(raw) });
    }
    const differences = JSON.stringify({ version: 1, baseline: "initial", previousRunId: null,
      currentRunId: "lote-anterior", providers: [] });
    await writeFile(join(directory, "differences.json"), differences);
    await writeFile(join(directory, "manifest.json"), JSON.stringify({ version: 1, runId: "lote-anterior",
      createdAt: endedAt, catalogs, differencesSha256: sha(differences) }));
    await writeProvider(root, "gam", "500");
    const result = await compareActiveCampaignReference(root);
    assert.equal(result.baseline, "previous");
    assert.equal(result.providers[0]?.modified.length, 1);
    assert.deepEqual(result.providers[0]?.modified[0]?.fields.map((entry) => entry.field), ["price"]);
    assert.equal(result.providers[1]?.unchanged, 1);
    assert.equal(result.providers[2]?.unchanged, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
