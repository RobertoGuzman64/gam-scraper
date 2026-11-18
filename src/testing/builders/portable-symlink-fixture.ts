import { lstat, symlink } from "node:fs/promises";
import type { TestContext } from "node:test";

const deniedByWindows = (error: unknown): boolean =>
  process.platform === "win32" && error instanceof Error && "code" in error &&
  "syscall" in error && error.syscall === "symlink" &&
  (error.code === "EPERM" || error.code === "EACCES");

export const createPortableTestSymlink = async (
  context: TestContext,
  target: string,
  path: string,
  type?: "dir" | "file" | "junction"
): Promise<boolean> => {
  try {
    await symlink(target, path, type);
    return true;
  } catch (error) {
    if (!deniedByWindows(error)) throw error;
  }
  if (type === "dir") {
    try {
      await symlink(target, path, "junction");
      return true;
    } catch (error) {
      if (!deniedByWindows(error)) throw error;
    }
  }
  try {
    await lstat(path);
    throw new Error(`El enlace existe pese al rechazo de Windows: ${path}`);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  context.diagnostic("La creación del enlace simbólico está restringida por Windows; comprobación del enlace no ejecutable en este entorno.");
  return false;
};
