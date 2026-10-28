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

export const base = (root: string): string => join(root, "storage", "scraped", "campaigns");
export const journalPath = (root: string): string => join(base(root), ".rotation.json");
export const journalStagePath = (root: string): string => join(base(root), ".rotation.json.tmp");
export const missing = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ENOENT";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const validName = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]+$/.test(value);
export type RemovalJournal = {
  readonly version: 1;
  readonly kind: "rotation" | "abandon";
  readonly runId: string;
  readonly retainedRunId: string | null;
  readonly scrapedFolder: string | null;
  readonly prefixes: readonly { readonly providerId: string; readonly outputPrefix: string }[];
};

export const discardIncompleteJournal = async (root: string): Promise<void> => {
  const stage = journalStagePath(root);
  try {
    const entry = await lstat(stage);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("Temporal de rotación no regular; se conservan los datos");
    await rm(stage);
  } catch (error) { if (!missing(error)) throw error; }
};

export const readJournal = async (root: string): Promise<RemovalJournal | null> => {
  let raw: unknown;
  try {
    const entry = await lstat(journalPath(root));
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("Registro de retirada no regular");
    raw = JSON.parse(await readFile(journalPath(root), "utf8"));
  }
  catch (error) { if (missing(error)) return null; throw new Error(`Registro de retirada no verificable: ${String(error)}`); }
  if (!isRecord(raw) || raw.version !== 1 || (raw.kind !== "rotation" && raw.kind !== "abandon") ||
    !validName(raw.runId) || (raw.retainedRunId !== null && !validName(raw.retainedRunId)) ||
    raw.retainedRunId === raw.runId || (raw.kind === "rotation" && raw.retainedRunId === null) ||
    (raw.scrapedFolder !== null && !validName(raw.scrapedFolder)) ||
    !Array.isArray(raw.prefixes) || raw.prefixes.length > CAMPAIGN_PROVIDERS.length ||
    !raw.prefixes.every((entry: unknown) => isRecord(entry) &&
      CAMPAIGN_PROVIDERS.some((id) => id === entry.providerId) && validName(entry.outputPrefix)) ||
    new Set(raw.prefixes.map((entry: { readonly providerId: string }) => entry.providerId)).size !== raw.prefixes.length ||
    (raw.scrapedFolder !== null && raw.prefixes.length === 0)) {
    throw new Error("Registro de retirada incoherente; no se elimina ningún archivo");
  }
  return {
    version: 1, kind: raw.kind, runId: raw.runId,
    retainedRunId: raw.retainedRunId, scrapedFolder: raw.scrapedFolder,
    prefixes: raw.prefixes
  };
};
