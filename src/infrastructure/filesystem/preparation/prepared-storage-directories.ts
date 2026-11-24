import { lstat, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const missing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

export const verifyPreparedDirectory = async (workspace: string, providerId: string): Promise<string> => {
  const root = resolve(workspace);
  const directory = join(root, "storage", "prepared", providerId);
  for (const path of [root, join(root, "storage"), join(root, "storage", "prepared"), directory]) {
    try {
      const stat = await lstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Directorio de preparación no regular: ${path}`);
    } catch (error) {
      if (missing(error)) continue;
      throw error;
    }
  }
  return directory;
};

export const ensurePreparedDirectory = async (workspace: string, providerId: string): Promise<void> => {
  const root = resolve(workspace);
  const path = [join(root, "storage"), join(root, "storage", "prepared"), join(root, "storage", "prepared", providerId)];
  for (const directory of path) {
    try {
      const stat = await lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Directorio de preparación no regular: ${directory}`);
    } catch (error) {
      if (!missing(error)) throw error;
      try { await mkdir(directory); }
      catch (creationError) {
        if (!(creationError instanceof Error && "code" in creationError && creationError.code === "EEXIST")) throw creationError;
      }
      const stat = await lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Directorio de preparación no regular: ${directory}`);
    }
  }
};
