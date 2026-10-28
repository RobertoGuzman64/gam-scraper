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

import { base, missing } from "./journal.js";
import { planRemoval } from "./inventory.js";
import { beginRemoval, resumePendingCampaignRemoval } from "./recovery.js";

export const withCampaignAdmissionLock = async <T>(rootDirectory: string, action: () => Promise<T>): Promise<T> => {
  const root = resolve(rootDirectory);
  await mkdir(base(root), { recursive: true });
  const lock = await acquireBatchLock(base(root), {
    runId: `campaign-admission-${randomUUID()}`, pid: process.pid, startedAt: new Date().toISOString()
  });
  try { return await action(); }
  finally { await lock.release(); }
};

const ensureNoOrphans = async (root: string, runs: readonly CampaignRun[]): Promise<void> => {
  const known = new Set(runs.flatMap((run) => [
    ...run.report.providers.map((item) => dirname(resolve(root, item.outputDir))),
    ...(run.report.providers.length === 0 ? [join(base(root), run.report.runId)] : [])
  ]));
  try {
    for (const item of await readdir(base(root), { withFileTypes: true })) {
      if (item.name === ".batch.lock") continue;
      if (!item.isDirectory() || item.isSymbolicLink()) throw new Error(`Elemento no reconocido en el almacén de campañas: ${item.name}`);
      const path = join(base(root), item.name);
      if (!known.has(path) && (await readdir(path)).length !== 0) {
        throw new Error(`Extracción huérfana no vinculada a un runId: ${path}; no se abre otra campaña`);
      }
    }
  } catch (error) { if (!missing(error)) throw error; }
  const ids = new Set(runs.map(({ report }) => report.runId));
  const campaigns = join(root, "storage", "campaigns");
  try {
    for (const item of await readdir(campaigns, { withFileTypes: true })) {
      if (!item.isDirectory() || item.isSymbolicLink() || !ids.has(item.name)) {
        throw new Error(`Artefactos de campaña sin runId reconocido: ${join(campaigns, item.name)}`);
      }
    }
  } catch (error) { if (!missing(error)) throw error; }
};

export const prepareCampaignAdmission = async (rootDirectory: string, _newCampaign: boolean): Promise<void> => {
  const root = resolve(rootDirectory);
  await resumePendingCampaignRemoval(root);
  const runs = await listCampaignRuns(root);
  await ensureNoOrphans(root, runs);
  if (runs.length > 2) throw new Error(`Existen ${runs.length} campañas. No se borrará ninguna sin resolver el historial`);
  const newest = runs[0];
  if (newest && newest.report.status !== "complete") {
    throw new Error(`Campaña ${newest.report.runId} incompleta; --nueva no autoriza su abandono`);
  }
  if (runs.length === 1 && newest?.report.status === "complete") {
    await verifyDeliveredCampaign(root, undefined, newest.report.runId);
  }
  if (runs.length < 2) return;
  const [current, old] = runs;
  if (!current || !old) throw new Error("Inventario global ambiguo");
  const reference = await inspectCampaignReference(root);
  if (reference.status === "invalid" || reference.status === "recoverable") {
    throw new Error(`Referencia legada ${reference.status}; resolver antes de rotar`);
  }
  if (current.report.status !== "complete" || old.report.status !== "complete") {
    throw new Error(`Dos posiciones ocupadas (${old.report.runId} y ${current.report.runId}); completar o abandonar expresamente la fallida`);
  }
  for (const run of [old, current]) {
    const verified = await verifyDeliveredCampaign(root, undefined, run.report.runId);
    if (verified.runId !== run.report.runId) throw new Error("Entrega acreditada de otro lote");
  }
  const candidate = await planRemoval(root, old);
  await verifyDeliveredCampaign(root, undefined, current.report.runId);
  await beginRemoval(root, "rotation", candidate, current.report.runId);
};
