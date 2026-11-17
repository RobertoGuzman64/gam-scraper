import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { inspectRepositoryArtifact } from "../../infrastructure/filesystem/catalog/repository-artifact-snapshot.js";
import type { PanelArtifact } from "./types.js";

export const digest = (content: string): string => createHash("sha256").update(content).digest("hex");
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const isSha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export const isMissing = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ENOENT";
export const artifact = (root: string, path: string, sha256: string): PanelArtifact =>
  ({ path: relative(root, path).replaceAll("\\", "/"), sha256 });

export const regularText = async (path: string): Promise<string> => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) {
    throw new Error(`Evidencia no regular: ${path}`);
  }
  return readFile(path, "utf8");
};

export const recordFrom = (raw: string, path: string): Record<string, unknown> => {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error(`JSON de evidencia inválido: ${path}`); }
  if (!isRecord(value)) throw new Error(`Estructura de evidencia inválida: ${path}`);
  return value;
};

export const inspectReport = async (root: string, directory: string): Promise<{
  readonly content: string; readonly evidence: PanelArtifact; readonly previousSha256: string | null;
}> => {
  const state = await inspectRepositoryArtifact(directory, "INFORME.txt", ["INFORME.txt"]);
  if (!state) throw new Error(`Informe versionado ausente: ${directory}`);
  const path = join(directory, "versions", state.sha256, "INFORME.txt");
  return { content: await regularText(path), evidence: artifact(root, path, state.sha256),
    previousSha256: state.previousSha256 };
};
