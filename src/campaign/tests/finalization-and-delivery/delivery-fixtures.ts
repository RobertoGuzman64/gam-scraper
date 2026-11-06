import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { reviewActiveCampaign } from "../../review.js";
import { finalizeActiveCampaign } from "../../finalization.js";
import { CAMPAIGN_PROVIDERS } from "../../discovery/report.js";
import { copyCampaignTestCatalog, reuseCampaignTestFixture } from "../campaign-catalog-fixture.js";
import type { BatchReport, ProviderRun } from "../../../contracts/batch-report.js";

const fixtures = resolve("src/testing/fixtures");
export const prefixes = {
  gam: "scrape-gam-marzo-2026",
  gomariz: "scrape-gomariz",
  mercaeleva: "scrape-mercaeleva",
  manain: "scrape-manain"
} as const;
export const date = new Date(2026, 9, 26, 12);


const writeRunReport = async (root: string, report: BatchReport): Promise<void> => {
  const file = join(root, "storage", "runs", report.runId, "run.json");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report));
};

const writeCompleteRun = async (root: string, runId: string, startedAt: string, endedAt: string): Promise<void> => {
  const providers: ProviderRun[] = [];
  for (const id of CAMPAIGN_PROVIDERS) {
    const prefix = prefixes[id];
    const dir = join(root, "storage", "scraped", "campaigns", runId, id);
    await mkdir(dir, { recursive: true });
    const catalog = await copyCampaignTestCatalog(fixtures, dir, id, prefix);
    providers.push({
      providerId: id, status: "complete",
      startedAt: new Date(Date.parse(catalog.startedAt) - 1000).toISOString(),
      endedAt: new Date(Date.parse(catalog.endedAt) + 1000).toISOString(),
      durationMs: 1000, outputDir: dir, outputPrefix: prefix,
      logFile: join(dir, "missing.log"), summaryFile: join(dir, `${prefix}-summary.json`),
      changesFile: join(dir, `${prefix}-changes.json`)
    });
  }
  await writeRunReport(root, {
    version: 1, runId, status: "complete", requestedProviders: [...CAMPAIGN_PROVIDERS],
    startedAt, endedAt, providers
  });
};

const createFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-delivery-"));
  const desktop = join(root, "Escritorio");
  await mkdir(desktop);
  const runId = `lote-${randomUUID()}`;
  await writeCompleteRun(root, runId, "2026-10-22T08:20:00.000Z", "2026-10-22T09:10:00.000Z");
  const review = await reviewActiveCampaign(root);
  assert.equal(review.complete, true, JSON.stringify(review.providers));
  return { root, desktop, runId, cleanup: () => rm(root, { recursive: true, force: true }) };
};


export const approve = async (root: string): Promise<void> => {
  const draft = await finalizeActiveCampaign(root, false);
  assert.ok(draft.status === "draft" || draft.status === "pending");
  const original = JSON.parse(await readFile(draft.draftFile, "utf8"));
  const approved = {
    ...original, approved: true,
    approvalReason: "Decisiones revisadas por una persona responsable",
    exclusions: original.exclusions.map((entry: { readonly sourceUrl: string; readonly status: string }) => ({
      ...entry, decision: entry.status === "intervention" ? "incluir" : "excluir",
      reason: "Ficha contrastada manualmente con su fuente",
      evidenceUrls: [entry.sourceUrl]
    }))
  };
  await writeFile(draft.draftFile, JSON.stringify(approved, null, 2));
};


export const createDeliveryFixtures = () => {
  const fixtureCache = reuseCampaignTestFixture(createFixture);
  return {
    fixture: fixtureCache.fixture,
    approvedFixture: () => fixtureCache.prepared("approved", async (data) => approve(data.root)),
    close: fixtureCache.close
  };
};

export const createSecondCampaign = async (root: string): Promise<string> => {
  const runId = `lote-${randomUUID()}`;
  await writeCompleteRun(root, runId, "2026-10-22T08:20:00.001Z", "2026-10-22T09:10:00.001Z");
  const reviewed = await reviewActiveCampaign(root);
  assert.equal(reviewed.complete, true);
  await approve(root);
  return runId;
};

export const createFailedCampaign = async (root: string): Promise<string> => {
  const runId = `lote-${randomUUID()}`;
  const outputDir = join(root, "storage", "scraped", "campaigns", runId, "gam");
  await mkdir(outputDir, { recursive: true });
  const provider: ProviderRun = {
    providerId: "gam", status: "failed", startedAt: "2026-10-23T08:21:00.000Z",
    endedAt: "2026-10-23T08:21:20.000Z", durationMs: 20000,
    outputDir, outputPrefix: prefixes.gam, logFile: join(outputDir, "missing.log"),
    summaryFile: join(outputDir, `${prefixes.gam}-summary.json`),
    changesFile: join(outputDir, `${prefixes.gam}-changes.json`), error: "Origen no disponible"
  };
  const report: BatchReport = {
    version: 1, runId, status: "failed", requestedProviders: [...CAMPAIGN_PROVIDERS],
    startedAt: "2026-10-23T08:20:00.000Z", endedAt: "2026-10-23T08:21:21.000Z", providers: [provider]
  };
  await writeRunReport(root, report);
  return runId;
};


export const writeInterruptedRotation = async (root: string, retiredId: string, retainedId: string): Promise<void> => {
  const folder = join(root, "storage", "scraped", "campaigns");
  await writeFile(join(folder, ".rotation.json"), JSON.stringify({
    version: 1, kind: "rotation", runId: retiredId, retainedRunId: retainedId,
    scrapedFolder: retiredId,
    prefixes: CAMPAIGN_PROVIDERS.map((providerId) => ({ providerId, outputPrefix: prefixes[providerId] }))
  }));
};

