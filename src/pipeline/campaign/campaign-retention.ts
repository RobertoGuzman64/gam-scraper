import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readdir, readFile, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import { acquireBatchLock } from "../../infrastructure/locking/batch-lock.js";
import { inspectCampaignReference } from "../../infrastructure/filesystem/campaign-reference.js";
import { inspectCleanupArea, removeCleanupDirectories } from "../../infrastructure/filesystem/campaign-cleanup.js";
import type { CleanupArea } from "../../infrastructure/filesystem/campaign-cleanup.js";
import { discoverCampaign, listCampaignRuns, readCampaignBatch } from "./discovery.js";
import type { CampaignRun } from "./discovery.js";
import { verifyDeliveredCampaign } from "./delivery-verification.js";
import { writeBatchReport } from "../batch/report.js";
import { getProvider } from "../../scraping/registry.js";

const base = (root: string): string => join(root, "storage", "scraped", "campaigns");
const journalPath = (root: string): string => join(base(root), ".rotation.json");
const journalStagePath = (root: string): string => join(base(root), ".rotation.json.tmp");
const missing = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ENOENT";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validName = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]+$/.test(value);
const regularDirectory = async (path: string): Promise<boolean> => {
  try {
    const entry = await lstat(path);
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`Directorio inseguro: ${path}`);
    return true;
  } catch (error) { if (missing(error)) return false; throw error; }
};

type RemovalJournal = {
  readonly version: 1;
  readonly kind: "rotation" | "abandon";
  readonly runId: string;
  readonly retainedRunId: string | null;
  readonly scrapedFolder: string | null;
  readonly prefixes: readonly { readonly providerId: string; readonly outputPrefix: string }[];
};

export type CampaignRemoval = {
  readonly runId: string;
  readonly paths: readonly string[];
  readonly scrapedFolder: string | null;
  readonly prefixes: RemovalJournal["prefixes"];
};

const removalAreas = (root: string, journal: RemovalJournal): readonly { readonly path: string; readonly area: CleanupArea }[] => [
  { path: join(root, "storage", "interventions", journal.runId, "results"), area: "intervention" },
  { path: join(root, "storage", "campaigns", journal.runId), area: "campaign" },
  ...(journal.scrapedFolder === null ? [] : [{ path: join(base(root), journal.scrapedFolder), area: "scraped" as const }]),
  { path: join(root, "storage", "runs", journal.runId), area: "run" }
];

const discardIncompleteJournal = async (root: string): Promise<void> => {
  const stage = journalStagePath(root);
  try {
    const entry = await lstat(stage);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("Temporal de rotación no regular; se conservan los datos");
    await rm(stage);
  } catch (error) { if (!missing(error)) throw error; }
};

const readJournal = async (root: string): Promise<RemovalJournal | null> => {
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

const describeOutputs = (root: string, run: CampaignRun): Pick<CampaignRemoval, "scrapedFolder" | "prefixes"> => {
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

const planRemoval = async (root: string, run: CampaignRun): Promise<CampaignRemoval> => {
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

const finishRemoval = async (root: string, journal: RemovalJournal): Promise<void> => {
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

const beginRemoval = async (
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

export type CampaignRecovery = {
  readonly runId: string;
  readonly status: string;
  readonly filesPreserved: boolean;
  readonly canAbandon: boolean;
};

export const inspectRecoverableCampaign = async (rootDirectory: string, runId: string): Promise<CampaignRecovery> => {
  const root = resolve(rootDirectory);
  const runs = await listCampaignRuns(root);
  const target = runs.find((entry) => entry.report.runId === runId);
  if (!target) throw new Error(`No se encuentra campaña ${runId}`);
  if (target.report.status === "complete") throw new Error("La campaña está completa y debe acreditarse o entregarse, no abandonarse como fallida");
  const campaign = await discoverCampaign(root, runId);
  await planRemoval(root, target);
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
  return { runId, status: campaign.status, filesPreserved: true, canAbandon: true };
};

export const abandonFailedCampaign = async (rootDirectory: string, runId: string): Promise<void> =>
  withCampaignAdmissionLock(rootDirectory, async () => {
    const root = resolve(rootDirectory);
    await resumePendingCampaignRemoval(root);
    const runs = await listCampaignRuns(root);
    const target = runs.find((run) => run.report.runId === runId);
    if (!target) throw new Error(`No se encuentra campaña ${runId}`);
    await inspectRecoverableCampaign(root, runId);
    if (runs.length > 2) throw new Error("Historial de campañas ambiguo");
    const others = runs.filter((run) => run.report.runId !== runId);
    if (others.length > 1) throw new Error("Historial de campañas ambiguo");
    if (others[0]) await verifyDeliveredCampaign(root, undefined, others[0].report.runId);
    const candidate = await planRemoval(root, target);
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
