import { lstat, open, unlink } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { basename, dirname, join, resolve } from "node:path";

const missing = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

export const preparedWorkspaceForOutput = (output: string, providerId: string): string | null => {
  const directory = dirname(resolve(output));
  const prepared = dirname(directory);
  const storage = dirname(prepared);
  if (basename(directory) !== providerId || basename(prepared) !== "prepared" || basename(storage) !== "storage") {
    return null;
  }
  return dirname(storage);
};

export const withPreparedStorageWriteLock = async <T>(
  workspace: string, providerId: string, action: () => Promise<T>
): Promise<T> => {
  const root = resolve(workspace);
  const parent = join(root, "storage", "prepared");
  const directory = join(parent, providerId);
  if (!/^[a-zA-Z0-9_-]+$/.test(providerId)) throw new Error("Proveedor de preparación inválido");
  for (const path of [root, join(root, "storage"), parent, directory]) {
    try {
      const info = await lstat(path);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error(`Almacén preparado no regular o enlazado: ${path}`);
      }
    } catch (error) {
      if (missing(error)) throw new Error(`No existe el directorio de preparación: ${path}`);
      throw error;
    }
  }
  const lockFile = join(parent, `.retention-${providerId}.lock`);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    let lock;
    try {
      lock = await open(lockFile, "wx", 0o600);
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
      if (attempt === 119) throw error;
      await setTimeout(25);
      continue;
    }
    try {
      return await action();
    } finally {
      await lock.close();
      await unlink(lockFile);
    }
  }
  throw new Error("No se pudo adquirir el bloqueo de preparación");
};
