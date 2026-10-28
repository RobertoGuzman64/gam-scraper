import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readdir, readFile, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { acquireBatchLock } from "../../../infrastructure/locking/batch-lock.js";
import { inspectCampaignReference } from "../../../infrastructure/filesystem/reference/store.js";
import { inspectCleanupArea, removeCleanupDirectories } from "../../../infrastructure/filesystem/campaign/campaign-cleanup.js";
import type { CleanupArea } from "../../../infrastructure/filesystem/campaign/campaign-cleanup.js";
import { discoverCampaign, listCampaignRuns } from "../discovery/search.js";
import { readCampaignBatch } from "../discovery/report.js";
import type { CampaignRun } from "../discovery/search.js";
import { verifyDeliveredCampaign } from "../delivery/verification.js";
import { writeBatchReport } from "../../batch/report.js";
import { getProvider } from "../../../scraping/registry.js";

import { base, missing, validName } from "./journal.js";
import type { RemovalJournal } from "./journal.js";

export type CampaignRemoval = {
  readonly runId: string;
  readonly paths: readonly string[];
  readonly scrapedFolder: string | null;
  readonly prefixes: RemovalJournal["prefixes"];
};


export const readableFile = async (path: string): Promise<boolean> => {
  try {
    const entry = await lstat(path);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Archivo de campaña inseguro: ${path}`);
    return true;
  } catch (error) { if (missing(error)) return false; throw error; }
};
export const regularDirectory = async (path: string): Promise<boolean> => {
  try {
    const entry = await lstat(path);
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`Directorio inseguro: ${path}`);
    return true;
  } catch (error) { if (missing(error)) return false; throw error; }
};

export const removalAreas = (root: string, journal: RemovalJournal): readonly { readonly path: string; readonly area: CleanupArea }[] => [
  { path: join(root, "storage", "interventions", journal.runId, "results"), area: "intervention" },
  { path: join(root, "storage", "campaigns", journal.runId), area: "campaign" },
  ...(journal.scrapedFolder === null ? [] : [{ path: join(base(root), journal.scrapedFolder), area: "scraped" as const }]),
  { path: join(root, "storage", "runs", journal.runId), area: "run" }
];

export const describeOutputs = (root: string, run: CampaignRun): Pick<CampaignRemoval, "scrapedFolder" | "prefixes"> => {
  const outputs = run.report.providers;
  if (outputs.length === 0) {
    if (!validName(run.report.runId)) throw new Error("Identificador de campaña no seguro");
    return {
      scrapedFolder: run.report.runId,
      prefixes: run.report.requestedProviders.map((providerId) => ({
        providerId, outputPrefix: getProvider(providerId).defaultOptions.outPrefix
      }))
    };
  }
  const roots = new Set(outputs.map((provider) => {
    const output = resolve(root, provider.outputDir);
    const shared = output === join(root, "storage", "scraped", provider.providerId);
    const scrape = dirname(output);
    const isolated = dirname(scrape) === base(root) && validName(basename(scrape)) &&
      output === join(scrape, provider.providerId);
    if (!shared && !isolated) throw new Error(`Extracción ${run.report.runId} fuera de los almacenes admitidos`);
    return shared ? "shared" : basename(scrape);
  }));
  if (roots.size > 1) throw new Error(`La extracción ${run.report.runId} mezcla orígenes compartidos y aislados`);
  const location = [...roots][0] ?? null;
  const registered = new Map(outputs.map(({ providerId, outputPrefix }) => [providerId, outputPrefix]));
  return {
    scrapedFolder: location === "shared" ? null : location,
    prefixes: location !== "shared" && run.report.status !== "complete"
      ? run.report.requestedProviders.map((providerId) => ({
        providerId, outputPrefix: registered.get(providerId) ?? getProvider(providerId).defaultOptions.outPrefix
      }))
      : outputs.map(({ providerId, outputPrefix }) => ({ providerId, outputPrefix }))
  };
};

export const planUnreportedRemoval = async (root: string, runId: string): Promise<CampaignRemoval> => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9]{8}$/.test(runId)) {
    throw new Error(`El identificador ${runId} no corresponde a una extracción aislada`);
  }
  const runDir = join(root, "storage", "runs", runId);
  const scrapedDir = join(base(root), runId);
  if (!await regularDirectory(runDir) && !await regularDirectory(scrapedDir)) {
    throw new Error(`No existe una extracción interrumpida asociable a ${runId}`);
  }
  try {
    await lstat(join(runDir, "run.json"));
    throw new Error(`El lote ${runId} dispone de run.json y debe verificarse por su informe`);
  } catch (error) { if (!missing(error)) throw error; }
  const prefixes = CAMPAIGN_PROVIDERS.map((providerId) => ({
    providerId, outputPrefix: getProvider(providerId).defaultOptions.outPrefix
  }));
  const journal: RemovalJournal = {
    version: 1, kind: "abandon", runId, retainedRunId: null, scrapedFolder: runId, prefixes
  };
  const paths: string[] = [];
  for (const item of removalAreas(root, journal)) {
    if (await inspectCleanupArea(root, item.path, item.area,
      new Map(prefixes.map(({ providerId, outputPrefix }) => [providerId, outputPrefix])), true) !== null) {
      paths.push(item.path);
    }
  }
  return { runId, paths, scrapedFolder: runId, prefixes };
};

export const planRemoval = async (root: string, run: CampaignRun): Promise<CampaignRemoval> => {
  const { scrapedFolder, prefixes } = describeOutputs(root, run);
  const journal: RemovalJournal = {
    version: 1, kind: "abandon", runId: run.report.runId, retainedRunId: null, scrapedFolder, prefixes
  };
  const existing: string[] = [];
  for (const item of removalAreas(root, journal)) {
    if (await inspectCleanupArea(root, item.path, item.area,
      new Map(prefixes.map(({ providerId, outputPrefix }) => [providerId, outputPrefix])),
      run.report.status !== "complete") !== null) existing.push(item.path);
  }
  if (!existing.includes(join(root, "storage", "runs", run.report.runId))) {
    throw new Error(`Desapareció el run.json de ${run.report.runId} durante el inventario`);
  }
  return { runId: run.report.runId, paths: existing, scrapedFolder, prefixes };
};
