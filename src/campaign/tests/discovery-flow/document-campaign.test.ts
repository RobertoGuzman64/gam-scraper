import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { CAMPAIGN_PROVIDERS, LEGACY_CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import type { BatchReport, ProviderRun } from "../../../contracts/batch-report.js";
import { copyCampaignTestCatalog } from "../campaign-catalog-fixture.js";
import { readCampaignDocumentOrigin, writeManainCampaignDocument } from "../../document-source.js";
import { discoverCampaign } from "../../discovery/search.js";
import { inspectCleanupArea } from "../../../infrastructure/filesystem/campaign/campaign-cleanup.js";
import { reviewActiveCampaign } from "../../review.js";

const fixtureRoot = resolve("src/testing/fixtures");
const source = resolve("catalogs/providers/manain");
const runId = "lote-documental-mixto";
const prefixes = {
  gam: "scrape-gam-marzo-2026", gomariz: "scrape-gomariz", mercaeleva: "scrape-mercaeleva"
} as const;

const mixed = async (): Promise<{ root: string; cleanup: () => Promise<void> }> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-campaign-mixed-"));
  const manain = join(root, "catalogs", "providers", "manain");
  await mkdir(manain, { recursive: true });
  await cp(join(source, "original"), join(manain, "original"), { recursive: true });
  await cp(join(source, "evidence"), join(manain, "evidence"), { recursive: true });
  const providers: ProviderRun[] = [];
  for (const providerId of LEGACY_CAMPAIGN_PROVIDERS) {
    const prefix = prefixes[providerId];
    const outputDir = join(root, "storage", "scraped", "campaigns", runId, providerId);
    await mkdir(outputDir, { recursive: true });
    const catalog = await copyCampaignTestCatalog(fixtureRoot, outputDir, providerId, prefix);
    const startedAt = new Date(Date.parse(catalog.startedAt) - 1000).toISOString();
    const endedAt = new Date(Date.parse(catalog.endedAt) + 1000).toISOString();
    providers.push({
      providerId, status: "complete", startedAt, endedAt,
      durationMs: Date.parse(endedAt) - Date.parse(startedAt),
      outputDir, outputPrefix: prefix, logFile: join(outputDir, "audit.log"),
      summaryFile: join(outputDir, `${prefix}-summary.json`), changesFile: join(outputDir, `${prefix}-changes.json`)
    });
  }
  const original = await readCampaignDocumentOrigin(root);
  const document = await writeManainCampaignDocument(root, runId, original);
  providers.push(document);
  const file = join(root, "storage", "runs", runId, "run.json");
  const report: BatchReport = {
    version: 1, runId, status: "complete", requestedProviders: [...CAMPAIGN_PROVIDERS],
    startedAt: "2026-10-22T08:00:00.000Z", endedAt: new Date(Date.parse(document.endedAt) + 1000).toISOString(),
    providers
  };
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report));
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
};

test("descubrimiento y revisión integran tres fuentes web y el original documental", async () => {
  const { root, cleanup } = await mixed();
  try {
    const discovery = await discoverCampaign(root);
    assert.equal(discovery.status, "complete");
    assert.deepEqual(discovery.providers.map((provider) => provider.state), ["catalog", "catalog", "catalog", "catalog"]);
    assert.deepEqual(discovery.issues, []);
    const prefixesMap = new Map<string, string>([
      ...LEGACY_CAMPAIGN_PROVIDERS.map((id): [string, string] => [id, prefixes[id]]),
      ["manain", "manain-stocklist"]
    ]);
    const scraped = await inspectCleanupArea(root, join(root, "storage", "scraped", "campaigns", runId),
      "scraped", prefixesMap);
    const run = await inspectCleanupArea(root, join(root, "storage", "runs", runId), "run");
    assert.ok(scraped && scraped.files >= 16);
    assert.ok(run && run.files >= 2);
    const review = await reviewActiveCampaign(root);
    assert.equal(review.complete, true, JSON.stringify(review.providers.filter((provider) => provider.state !== "validated")));
    const document = review.providers.find((provider) => provider.providerId === "manain");
    assert.equal(document?.products, 1298);
    assert.equal(document?.ready, 0);
    assert.equal(document?.review, 1298);
  } finally { await cleanup(); }
});

test("no acredita un lote cuyo documento histórico fue cambiado después de generarse", async () => {
  const { root, cleanup } = await mixed();
  try {
    const file = join(root, "storage", "scraped", "campaigns", runId, "manain", "original", "manain-stocklist.json");
    await writeFile(file, (await readFile(file, "utf8")) + "\n");
    const discovery = await discoverCampaign(root);
    assert.equal(discovery.providers.find((provider) => provider.providerId === "manain")?.state, "invalid");
  } finally { await cleanup(); }
});
