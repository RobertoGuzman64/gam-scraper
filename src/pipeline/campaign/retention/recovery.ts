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

import { base, journalPath, journalStagePath, missing, validName, discardIncompleteJournal, readJournal } from "./journal.js";
import type { RemovalJournal } from "./journal.js";
import { removalAreas, describeOutputs, planRemoval, planUnreportedRemoval, readableFile, regularDirectory } from "./inventory.js";
import type { CampaignRemoval } from "./inventory.js";
import { withCampaignAdmissionLock } from "./admission.js";

export const finishRemoval = async (root: string, journal: RemovalJournal): Promise<void> => {
  const runFile = join(root, "storage", "runs", journal.runId, "run.json");
  try {
    const report = await readCampaignBatch(runFile);
    const expected = describeOutputs(root, { report, path: runFile });
    const sorted = (entries: RemovalJournal["prefixes"]): readonly string[] =>
      entries.map(({ providerId, outputPrefix }) => `${providerId}:${outputPrefix}`).sort();
    if (expected.scrapedFolder !== journal.scrapedFolder ||
      JSON.stringify(sorted(expected.prefixes)) !== JSON.stringify(sorted(journal.prefixes)) ||
      (journal.kind === "rotation" ? report.status !== "complete" : report.status === "complete")) {
      throw new Error(`Registro de retirada incoherente con run.json de ${journal.runId}`);
    }
  } catch (error) { if (!missing(error)) throw error; }
  const retained = await listCampaignRuns(root, journal.runId);
  if (journal.retainedRunId === null ? retained.length !== 0 :
    retained.length !== 1 || retained[0]?.report.runId !== journal.retainedRunId) {
    throw new Error(`Retirada ${journal.runId} interrumpida: hay campañas ajenas; no se eliminan archivos`);
  }
  if (journal.retainedRunId !== null) {
    await verifyDeliveredCampaign(root, undefined, journal.retainedRunId, journal.runId);
    const successor = retained[0];
    if (!successor) throw new Error("No existe campaña retenida");
    const scrapedFolder = journal.scrapedFolder;
    if (scrapedFolder !== null && successor.report.providers.some((provider) =>
      resolve(root, provider.outputDir).startsWith(`${join(base(root), scrapedFolder)}${sep}`))) {
      throw new Error("La retirada comparte originales con la campaña retenida");
    }
  }
  const prefixes = new Map(journal.prefixes.map(({ providerId, outputPrefix }) => [providerId, outputPrefix]));
  const paths: string[] = [];
  for (const item of removalAreas(root, journal)) {
    if (await inspectCleanupArea(root, item.path, item.area, prefixes, true) !== null) paths.push(item.path);
  }
  await removeCleanupDirectories(paths);
  if (journal.retainedRunId !== null) {
    await verifyDeliveredCampaign(root, undefined, journal.retainedRunId);
  }
  if ((await listCampaignRuns(root)).length !== (journal.retainedRunId === null ? 0 : 1)) {
    throw new Error(`Retirada de ${journal.runId} no concluida; no se abre otra campaña`);
  }
  await rm(journalPath(root));
};

export const resumePendingCampaignRemoval = async (rootDirectory: string): Promise<void> => {
  const root = resolve(rootDirectory);
  await discardIncompleteJournal(root);
  const journal = await readJournal(root);
  if (journal !== null) await finishRemoval(root, journal);
};

export const beginRemoval = async (
  root: string, kind: RemovalJournal["kind"], candidate: CampaignRemoval, retainedRunId: string | null
): Promise<void> => {
  const journal: RemovalJournal = {
    version: 1, kind, runId: candidate.runId, retainedRunId,
    scrapedFolder: candidate.scrapedFolder, prefixes: candidate.prefixes
  };
  await discardIncompleteJournal(root);
  if (await readJournal(root) !== null) throw new Error("Ya hay una retirada pendiente; no se inicia otra");
  const stage = journalStagePath(root);
  const handle = await open(stage, "wx");
  try {
    await handle.writeFile(JSON.stringify(journal));
    await handle.sync();
  } finally { await handle.close(); }
  try {
    await rename(stage, journalPath(root));
  } catch (error) {
    await discardIncompleteJournal(root);
    throw error;
  }
  await finishRemoval(root, journal);
};

export type CampaignRecovery = {
  readonly runId: string;
  readonly status: string;
  readonly filesPreserved: boolean;
  readonly canAbandon: boolean;
};

export const inspectRecoverableCampaign = async (rootDirectory: string, runId: string): Promise<CampaignRecovery> => {
  if (!validName(runId)) throw new Error("Identificador de campaña no seguro");
  const root = resolve(rootDirectory);
  const reportPath = join(root, "storage", "runs", runId, "run.json");
  const unreported = !await readableFile(reportPath);
  const runs = await listCampaignRuns(root, unreported ? runId : undefined);
  const target = runs.find((entry) => entry.report.runId === runId);
  if (!unreported && !target) throw new Error(`No se encuentra campaña ${runId}`);
  if (target?.report.status === "complete") throw new Error("La campaña está completa y debe acreditarse o entregarse, no abandonarse como fallida");
  if (target) await planRemoval(root, target);
  else await planUnreportedRemoval(root, runId);
  try { await lstat(join(root, "storage", "campaigns", runId, "delivery.json"));
    throw new Error("La campaña tiene un recibo de entrega y no se puede abandonar");
  } catch (error) { if (!missing(error)) throw error; }
  const authored = [join(root, "storage", "campaigns", runId, "editorial"),
    join(root, "storage", "campaigns", runId, "selection"),
    ...CAMPAIGN_PROVIDERS.map((provider) => join(root, "storage", "campaigns", runId, provider)),
    join(root, "storage", "interventions", runId, "results")];
  for (const path of authored) {
    if (await regularDirectory(path) && (await readdir(path)).length > 0) {
      throw new Error(`Campaña ${runId} contiene trabajo de intervención/acreditación; se conserva sin abandono automático: ${path}`);
    }
  }
  return { runId, status: target?.report.status ?? "interrupted", filesPreserved: true, canAbandon: true };
};

export const abandonFailedCampaign = async (rootDirectory: string, runId: string): Promise<void> =>
  withCampaignAdmissionLock(rootDirectory, async () => {
    const root = resolve(rootDirectory);
    await resumePendingCampaignRemoval(root);
    if (!validName(runId)) throw new Error("Identificador de campaña no seguro");
    const unreported = !await readableFile(join(root, "storage", "runs", runId, "run.json"));
    const runs = await listCampaignRuns(root, unreported ? runId : undefined);
    const target = runs.find((run) => run.report.runId === runId);
    if (!target && !unreported) throw new Error(`No se encuentra campaña ${runId}`);
    await inspectRecoverableCampaign(root, runId);
    if (runs.length > 2) throw new Error("Historial de campañas ambiguo");
    const others = runs.filter((run) => run.report.runId !== runId);
    if (others.length > 1) throw new Error("Historial de campañas ambiguo");
    if (others[0]) await verifyDeliveredCampaign(root, undefined, others[0].report.runId, unreported ? runId : undefined);
    const candidate = target ? await planRemoval(root, target) : await planUnreportedRemoval(root, runId);
    await beginRemoval(root, "abandon", candidate, others[0]?.report.runId ?? null);
  });

export const recoverCompletedCampaign = async (rootDirectory: string, runId: string): Promise<void> =>
  withCampaignAdmissionLock(rootDirectory, async () => {
    const root = resolve(rootDirectory);
    await resumePendingCampaignRemoval(root);
    const runs = await listCampaignRuns(root);
    const candidate = runs.find((run) => run.report.runId === runId);
    if (!candidate || candidate.report.status === "complete") {
      throw new Error(`La campaña ${runId} no está interrumpida o no existe`);
    }
    const report = candidate.report;
    if (report.requestedProviders.length !== 4 || report.providers.length !== 4 ||
      report.providers.some((run) => run.status !== "complete")) {
      throw new Error(`La campaña ${runId} no terminó los cuatro proveedores; los parciales se conservan. Solo puede abandonarse expresamente`);
    }
    const campaign = await discoverCampaign(root, runId);
    if (campaign.providers.length !== 4 || campaign.providers.some((provider) => !provider.catalog) ||
      campaign.issues.some((issue) => issue !== `Lote ${report.status}; no es seleccionable`)) {
      throw new Error(`Los catálogos de ${runId} no son íntegros; no se recupera`);
    }
    const endedAt = new Date(Math.max(Date.parse(report.startedAt),
      ...report.providers.map((item) => Date.parse(item.endedAt))) + 1).toISOString();
    await writeBatchReport(candidate.path, { ...report, status: "complete", endedAt });
    const verified = await discoverCampaign(root, runId);
    if (verified.status !== "complete" || verified.issues.length > 0) {
      throw new Error(`La campaña ${runId} no quedó acreditada después de recuperar run.json`);
    }
  });
