import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { IndividualCatalogProvider } from "../../../preparation/workflow/individual-context.js";
import { isCampaignProvider } from "../../../contracts/campaign-providers.js";

export type IndividualFinishTarget = {
  readonly providerId: IndividualCatalogProvider;
  readonly approvalSha256: string;
  readonly previousSha256: string | null;
};

export type IndividualFinishClosurePhase = "activated" | "retained" | "audited" | "reported";

export type IndividualFinishReportReceipt = { readonly path: string; readonly sha256: string; readonly kind?: "internal" };

export type IndividualFinishJournal = {
  readonly version: 1;
  readonly targets: readonly IndividualFinishTarget[];
  readonly completed: readonly IndividualCatalogProvider[];
  readonly status: "pending" | "complete";
  readonly candidatesVerified?: boolean;
  readonly closure?: {
    readonly phase: IndividualFinishClosurePhase;
    readonly report: IndividualFinishReportReceipt | null;
  };
};

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const isHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const missing = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ENOENT";

const journalName = (targets: readonly IndividualFinishTarget[]): string =>
  `${hash(JSON.stringify(targets.map(({ providerId, approvalSha256 }) => ({ providerId, approvalSha256 }))))}.json`;

const phases: readonly IndividualFinishClosurePhase[] = ["activated", "retained", "audited", "reported"];

export const individualFinishClosurePhase = (journal: IndividualFinishJournal): IndividualFinishClosurePhase =>
  journal.closure?.phase ?? "activated";

const validClosure = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    !("phase" in value) || !phases.some((phase) => phase === value.phase) || !("report" in value)) return false;
  if (value.phase !== "reported") return value.report === null;
  const report = value.report;
  return report !== null && typeof report === "object" && !Array.isArray(report) &&
    "path" in report && typeof report.path === "string" && isAbsolute(report.path) &&
    "sha256" in report && isHash(report.sha256) &&
    (!("kind" in report) || report.kind === "internal");
};

const isJournal = (value: unknown): value is IndividualFinishJournal => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (!("version" in value) || value.version !== 1 || !("status" in value) ||
    (value.status !== "pending" && value.status !== "complete") ||
    !("targets" in value) || !Array.isArray(value.targets) || !value.targets.length ||
    !("completed" in value) || !Array.isArray(value.completed)) return false;
  const targets: readonly unknown[] = value.targets;
  const completed: readonly unknown[] = value.completed;
  const providers = targets.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
      !("providerId" in item) || !("approvalSha256" in item) || !("previousSha256" in item) ||
      !isCampaignProvider(item.providerId) ||
      !isHash(item.approvalSha256) || (item.previousSha256 !== null && !isHash(item.previousSha256))) return null;
    return item.providerId;
  });
  return providers.every((item) => item !== null) && new Set(providers).size === providers.length &&
    completed.every((item) => typeof item === "string" && providers.some((providerId) => providerId === item)) &&
    new Set(completed).size === completed.length &&
    (value.status !== "complete" || completed.length === targets.length) &&
    (!("closure" in value) || (value.status === "complete" && validClosure(value.closure))) &&
    (!("candidatesVerified" in value) || typeof value.candidatesVerified === "boolean");
};

const readJournal = async (path: string): Promise<IndividualFinishJournal> => {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Diario de FINISH no regular: ${path}`);
  const data: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!isJournal(data)) throw new Error(`Diario de FINISH inválido: ${path}`);
  if (join(dirname(path), journalName(data.targets)) !== path) throw new Error(`Identidad de diario FINISH alterada: ${path}`);
  return data;
};

const journalFolder = (workspace: string): string => join(resolve(workspace), "storage", "publication", "individual-finish");

const ensureFolders = async (workspace: string): Promise<string> => {
  const root = resolve(workspace);
  const dirs = [root, join(root, "storage"), join(root, "storage", "publication"), journalFolder(root)];
  for (const path of dirs) {
    try {
      const stat = await lstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Directorio FINISH no regular: ${path}`);
    } catch (error) {
      if (!missing(error)) throw error;
      await mkdir(path);
      const stat = await lstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Directorio FINISH no regular: ${path}`);
    }
  }
  return journalFolder(root);
};

const writeAtomic = async (path: string, journal: IndividualFinishJournal): Promise<void> => {
  const temp = join(dirname(path), `.finish-${randomUUID()}.tmp`);
  try {
    await writeFile(temp, JSON.stringify(journal, null, 2), { flag: "wx" });
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true });
  }
};

export const withIndividualFinishLock = async <T>(workspace: string, action: () => Promise<T>): Promise<T> => {
  const folder = await ensureFolders(workspace);
  const lockFile = join(folder, ".finish.lock");
  let handle;
  try { handle = await open(lockFile, "wx"); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error("FINISH bloqueado: existe otra operación o un bloqueo anterior pendiente de inspección");
    }
    throw error;
  }
  try { return await action(); }
  finally {
    await handle.close();
    await rm(lockFile, { force: true });
  }
};

export const listIndividualFinishJournals = async (
  workspace: string
): Promise<readonly { readonly path: string; readonly journal: IndividualFinishJournal }[]> => {
  const folder = journalFolder(workspace);
  let metadata;
  try { metadata = await lstat(folder); }
  catch (error) { if (missing(error)) return []; throw error; }
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`Directorio FINISH no regular: ${folder}`);
  const result: { path: string; journal: IndividualFinishJournal }[] = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.name === ".finish.lock") continue;
    if (!entry.isFile() || entry.isSymbolicLink() || !/^[a-f0-9]{64}\.json$/.test(entry.name)) {
      throw new Error(`Entrada inesperada en diarios FINISH: ${entry.name}`);
    }
    const path = join(folder, entry.name);
    result.push({ path, journal: await readJournal(path) });
  }
  return result;
};

export const openIndividualFinishJournal = async (
  workspace: string, targets: readonly IndividualFinishTarget[]
): Promise<{ readonly path: string; readonly journal: IndividualFinishJournal }> => {
  const folder = await ensureFolders(workspace);
  const name = journalName(targets);
  const path = join(folder, name);
  for (const entry of await listIndividualFinishJournals(workspace)) {
    if (entry.path === path) continue;
    if (entry.journal.status === "pending" || individualFinishClosurePhase(entry.journal) !== "reported") {
      throw new Error(`Existe FINISH sin cerrar de otro conjunto (${entry.path}); recupera primero ese conjunto`);
    }
  }
  try {
    const existing = await readJournal(path);
    if (JSON.stringify(existing.targets.map(({ providerId, approvalSha256 }) => ({ providerId, approvalSha256 }))) !==
      JSON.stringify(targets.map(({ providerId, approvalSha256 }) => ({ providerId, approvalSha256 })))) {
      throw new Error("El diario no corresponde al conjunto de aprobaciones; recuperación manual necesaria");
    }
    return { path, journal: existing };
  } catch (error) {
    if (!missing(error)) throw error;
  }
  const journal: IndividualFinishJournal = { version: 1, targets, completed: [], status: "pending" };
  await writeFile(path, JSON.stringify(journal, null, 2), { flag: "wx" });
  return { path, journal };
};

export const updateIndividualFinishJournal = async (
  path: string, journal: IndividualFinishJournal, completed: readonly IndividualCatalogProvider[]
): Promise<IndividualFinishJournal> => {
  const current = await readJournal(path);
  if (JSON.stringify(current) !== JSON.stringify(journal)) throw new Error("El diario FINISH cambió durante la operación");
  if (completed.some((providerId) => !journal.targets.some((target) => target.providerId === providerId)) ||
    journal.completed.some((providerId) => !completed.includes(providerId)) || new Set(completed).size !== completed.length) {
    throw new Error("Progreso de FINISH incoherente");
  }
  const next: IndividualFinishJournal = {
    ...journal, completed: [...completed], status: completed.length === journal.targets.length ? "complete" : "pending"
  };
  if (JSON.stringify(next) !== JSON.stringify(journal)) await writeAtomic(path, next);
  return next;
};

export const advanceIndividualFinishClosure = async (
  path: string, journal: IndividualFinishJournal, phase: IndividualFinishClosurePhase,
  report: IndividualFinishReportReceipt | null = null
): Promise<IndividualFinishJournal> => {
  const current = await readJournal(path);
  if (JSON.stringify(current) !== JSON.stringify(journal)) throw new Error("El diario FINISH cambió durante el cierre");
  if (journal.status !== "complete" || journal.completed.length !== journal.targets.length) {
    throw new Error("FINISH no tiene todas sus activaciones confirmadas");
  }
  if (phases.indexOf(phase) !== phases.indexOf(individualFinishClosurePhase(journal)) + 1 ||
    (phase === "reported") !== (report !== null) ||
    (report !== null && (!isAbsolute(report.path) || !isHash(report.sha256)))) {
    throw new Error("Transición o recibo de cierre FINISH inválidos");
  }
  const next: IndividualFinishJournal = { ...journal, closure: { phase, report } };
  await writeAtomic(path, next);
  return next;
};

export const markIndividualFinishCandidates = async (
  path: string, journal: IndividualFinishJournal
): Promise<IndividualFinishJournal> => {
  const current = await readJournal(path);
  if (JSON.stringify(current) !== JSON.stringify(journal)) throw new Error("El diario FINISH cambió durante las candidaturas");
  if (journal.status !== "pending") throw new Error("FINISH: no se pueden modificar candidaturas tras la activación completa");
  if (journal.candidatesVerified) return journal;
  const next: IndividualFinishJournal = { ...journal, candidatesVerified: true };
  await writeAtomic(path, next);
  return next;
};

export const renewIndividualFinishReport = async (
  path: string, journal: IndividualFinishJournal, report: IndividualFinishReportReceipt
): Promise<IndividualFinishJournal> => {
  const current = await readJournal(path);
  if (JSON.stringify(current) !== JSON.stringify(journal) || journal.closure?.phase !== "reported" ||
    journal.closure.report?.kind !== "internal" || report.kind !== "internal" ||
    !isAbsolute(report.path) || !isHash(report.sha256)) {
    throw new Error("Renovación del recibo interno FINISH inválida");
  }
  const next: IndividualFinishJournal = { ...journal, closure: { phase: "reported", report } };
  await writeAtomic(path, next);
  return next;
};
