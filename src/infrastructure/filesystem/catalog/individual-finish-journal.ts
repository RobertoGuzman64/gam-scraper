import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { IndividualCatalogProvider } from "../../../pipeline/preparation/individual-context.js";

export type IndividualFinishTarget = {
  readonly providerId: IndividualCatalogProvider;
  readonly approvalSha256: string;
  readonly previousSha256: string | null;
};

export type IndividualFinishJournal = {
  readonly version: 1;
  readonly targets: readonly IndividualFinishTarget[];
  readonly completed: readonly IndividualCatalogProvider[];
  readonly status: "pending" | "complete";
};

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const isHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const missing = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ENOENT";

const journalName = (targets: readonly IndividualFinishTarget[]): string =>
  `${hash(JSON.stringify(targets.map(({ providerId, approvalSha256 }) => ({ providerId, approvalSha256 }))))}.json`;

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
      (item.providerId !== "gam" && item.providerId !== "gomariz" && item.providerId !== "mercaeleva") ||
      !isHash(item.approvalSha256) || (item.previousSha256 !== null && !isHash(item.previousSha256))) return null;
    return item.providerId;
  });
  return providers.every((item) => item !== null) && new Set(providers).size === providers.length &&
    completed.every((item) => typeof item === "string" && providers.some((providerId) => providerId === item)) &&
    new Set(completed).size === completed.length &&
    (value.status !== "complete" || completed.length === targets.length);
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

export const openIndividualFinishJournal = async (
  workspace: string, targets: readonly IndividualFinishTarget[]
): Promise<{ readonly path: string; readonly journal: IndividualFinishJournal }> => {
  const folder = await ensureFolders(workspace);
  const name = journalName(targets);
  const path = join(folder, name);
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.name === ".finish.lock") continue;
    if (!entry.isFile() || entry.isSymbolicLink() || !/^[a-f0-9]{64}\.json$/.test(entry.name)) {
      throw new Error(`Entrada inesperada en diarios FINISH: ${entry.name}`);
    }
    const existing = await readJournal(join(folder, entry.name));
    if (entry.name !== name && existing.status === "pending") {
      throw new Error(`Existe FINISH parcial de otro conjunto (${entry.name}); recupera primero ese conjunto`);
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
