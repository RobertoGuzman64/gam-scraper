import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { reviewActiveCampaign } from "../review.js";
import { CAMPAIGN_PROVIDERS } from "../discovery.js";
import { copyCampaignTestCatalog } from "./campaign-catalog-fixture.js";
import type { ProviderRun, BatchReport } from "../../batch/report-types.js";

const sourceRoot = resolve("src/testing/fixtures");
export const prefixes = {
  gam: "scrape-gam-marzo-2026",
  gomariz: "scrape-gomariz",
  mercaeleva: "scrape-mercaeleva"
} as const;

export const createFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-f4-"));
  const runId = `lote-${randomUUID()}`;
  const providers: ProviderRun[] = [];
  for (const id of CAMPAIGN_PROVIDERS) {
    const prefix = prefixes[id];
    const dir = join(root, "storage", "scraped", "campaigns", runId, id);
    await mkdir(dir, { recursive: true });
    const catalog = await copyCampaignTestCatalog(sourceRoot, dir, id, prefix);
    providers.push({
      providerId: id, status: "complete",
      startedAt: new Date(Date.parse(catalog.startedAt) - 1000).toISOString(),
      endedAt: new Date(Date.parse(catalog.endedAt) + 1000).toISOString(),
      durationMs: 1000, outputDir: dir, outputPrefix: prefix,
      logFile: join(dir, "missing.log"), summaryFile: join(dir, `${prefix}-summary.json`),
      changesFile: join(dir, `${prefix}-changes.json`)
    });
  }
  const runFile = join(root, "storage", "runs", runId, "run.json");
  const run: BatchReport = {
    version: 1, runId, status: "complete", requestedProviders: [...CAMPAIGN_PROVIDERS],
    startedAt: "2026-10-22T08:20:00.000Z", endedAt: "2026-10-22T09:10:00.000Z", providers
  };
  await mkdir(dirname(runFile), { recursive: true });
  await writeFile(runFile, JSON.stringify(run));
  const review = await reviewActiveCampaign(root);
  assert.equal(review.complete, true, JSON.stringify(review.providers));
  return { root, runId, providers, review, cleanup: () => rm(root, { recursive: true, force: true }) };
};

export const approveDraft = async (path: string) => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  const approved = {
    ...draft, approved: true, approvalReason: "Exclusiones y correcciones revisadas por una persona responsable.",
    exclusions: draft.exclusions.map((entry: { readonly sourceUrl: string; readonly status: string }) => ({
      ...entry, decision: entry.status === "intervention" ? "incluir" : "excluir",
      reason: "Ficha contrastada con su fuente y revisada manualmente.",
      evidenceUrls: [entry.sourceUrl]
    }))
  };
  await writeFile(path, JSON.stringify(approved, null, 2));
  return approved;
};

export const campaignScript = async (root: string, runId: string): Promise<string> => {
  const catalogFile = join(root, "storage", "scraped", "campaigns", runId, "gam", `${prefixes.gam}-catalog.json`);
  const catalog = await readCanonicalCatalog(catalogFile);
  const product = catalog.products.find((entry) => entry.title !== null);
  assert.ok(product);
  const folder = join(root, "storage", "interventions", runId, "scripts");
  await mkdir(folder, { recursive: true });
  const file = join(folder, "correccion.ts");
  await writeFile(file, `export const proposals = ${JSON.stringify([{
    providerId: "gam", identity: buildProductIdentity(product).key, field: "title",
    expected: product.title, next: `${product.title} contrastada`,
    reason: "Corrección editorial acordada para esta ficha",
    evidence: "Verificación manual con la ficha de origen publicada"
  }])};`);
  return file;
};

