import { hostname } from "node:os";
import { lstat, mkdir, open, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

type LockOwner = {
  readonly runId: string;
  readonly pid: number;
  readonly startedAt: string;
  readonly host?: string;
};

type ExistingLock =
  | { readonly kind: "missing" }
  | { readonly kind: "unreadable" }
  | { readonly kind: "owned"; readonly owner: LockOwner };

export type BatchLock = {
  readonly recoveredPid: number | null;
  release(): Promise<void>;
};

const isFileError = (error: unknown, code: string): boolean =>
  error instanceof Error && "code" in error && error.code === code;

const readLock = async (lockFile: string): Promise<ExistingLock> => {
  let contents: string;
  try {
    contents = await readFile(lockFile, "utf8");
  } catch (error) {
    if (isFileError(error, "ENOENT")) return { kind: "missing" };
    throw error;
  }
  try {
    const value: unknown = JSON.parse(contents);
    if (value === null || typeof value !== "object" ||
      !("runId" in value) || typeof value.runId !== "string" || !value.runId ||
      !("pid" in value) || typeof value.pid !== "number" || !Number.isSafeInteger(value.pid) || value.pid < 1 ||
      !("startedAt" in value) || typeof value.startedAt !== "string") return { kind: "unreadable" };
    const host = "host" in value && typeof value.host === "string" ? value.host : undefined;
    return { kind: "owned", owner: {
      runId: value.runId, pid: value.pid, startedAt: value.startedAt,
      ...(host === undefined ? {} : { host })
    } };
  } catch {
    return { kind: "unreadable" };
  }
};

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (isFileError(error, "ESRCH")) return false;
    return true;
  }
};

const checkOwner = (owner: LockOwner, lockFile: string): void => {
  if (owner.host && owner.host !== hostname()) {
    throw new Error(`El lote está bloqueado por el equipo ${owner.host} (PID ${owner.pid}): ${lockFile}. No se puede comprobar desde este equipo si sigue activo.`);
  }
  if (isAlive(owner.pid)) {
    throw new Error(`Ya hay un lote con PID ${owner.pid} iniciado el ${owner.startedAt}: ${lockFile}. Comprueba ese proceso antes de lanzar otro.`);
  }
};

export const assertInactiveCampaignBatchLock = async (outRoot: string, runId: string): Promise<void> => {
  const lockFile = join(outRoot, ".batch.lock");
  const entry = await lstat(lockFile);
  if (!entry.isFile() || entry.isSymbolicLink()) {
    throw new Error(`Bloqueo de campaña no regular: ${lockFile}`);
  }
  const current = await readLock(lockFile);
  if (current.kind !== "owned") {
    throw new Error(`No se puede acreditar el propietario del bloqueo: ${lockFile}`);
  }
  if (current.owner.runId !== runId) {
    throw new Error(`Bloqueo de otra ejecución (${current.owner.runId}): ${lockFile}`);
  }
  checkOwner(current.owner, lockFile);
};

const recoverLock = async (lockFile: string): Promise<number | null> => {
  const guardDir = `${lockFile}.recovery`;
  let claimed = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await mkdir(guardDir);
      claimed = true;
      break;
    } catch (error) {
      if (!isFileError(error, "EEXIST")) throw error;
      try {
        const guard = await stat(guardDir);
        if (Date.now() - guard.mtimeMs > 30_000) {
          await rm(guardDir, { recursive: true, force: true });
          continue;
        }
      } catch (guardError) {
        if (!isFileError(guardError, "ENOENT")) throw guardError;
      }
      await delay(100);
    }
  }
  if (!claimed) throw new Error(`No se pudo coordinar la recuperación del bloqueo: ${guardDir}. No se ha modificado el bloqueo del lote.`);
  try {
    const current = await readLock(lockFile);
    if (current.kind === "missing") return null;
    if (current.kind === "unreadable") {
      throw new Error(`El bloqueo ${lockFile} no contiene un PID válido. No se elimina automáticamente porque podría pertenecer a un proceso activo.`);
    }
    checkOwner(current.owner, lockFile);
    await rm(lockFile);
    return current.owner.pid;
  } finally {
    await rm(guardDir, { recursive: true, force: true });
  }
};

export const acquireBatchLock = async (outRoot: string, owner: LockOwner): Promise<BatchLock> => {
  const lockFile = join(outRoot, ".batch.lock");
  let recoveredPid: number | null = null;
  for (let attempt = 0; attempt < 15; attempt++) {
    let file;
    try {
      file = await open(lockFile, "wx");
    } catch (error) {
      if (!isFileError(error, "EEXIST")) throw error;
      let existing = await readLock(lockFile);
      if (existing.kind === "missing") continue;
      if (existing.kind === "unreadable") {
        await delay(100);
        existing = await readLock(lockFile);
        if (existing.kind === "missing") continue;
        if (existing.kind === "unreadable") {
          throw new Error(`El bloqueo ${lockFile} no contiene datos de propietario válidos. Comprueba si queda un proceso del scraper antes de intervenir sobre él.`);
        }
      }
      checkOwner(existing.owner, lockFile);
      recoveredPid = await recoverLock(lockFile) ?? recoveredPid;
      continue;
    }
    try {
      await file.writeFile(`${JSON.stringify({ ...owner, host: hostname() })}\n`);
    } catch (error) {
      await file.close().catch(() => undefined);
      await rm(lockFile, { force: true });
      throw error;
    }
    await file.close();
    return {
      recoveredPid,
      release: async (): Promise<void> => {
        const current = await readLock(lockFile);
        if (current.kind === "owned" && current.owner.runId === owner.runId) {
          await rm(lockFile, { force: true });
        }
      }
    };
  }
  throw new Error(`No fue posible adquirir el bloqueo del lote tras varios intentos: ${lockFile}.`);
};
