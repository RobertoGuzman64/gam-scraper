import { randomUUID } from "node:crypto";
import { lstat, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";

export type ActiveCatalogSource = {
  readonly approvalSha256: string;
  readonly runId?: string;
};

export type ActiveCatalogIndex = {
  readonly version: 1;
  readonly providers: Readonly<Record<string, ActiveCatalogSource>>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const missing = (error: unknown): boolean => isRecord(error) && error.code === "ENOENT";
const hash = (value: string): boolean => /^[a-f0-9]{64}$/.test(value);
const runName = (value: string): boolean => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,120}$/.test(value);
const recognized = (providerId: string): boolean => CAMPAIGN_PROVIDERS.some((id) => id === providerId);

export const readActiveCatalogIndex = async (rootDirectory: string): Promise<ActiveCatalogIndex | null> => {
  const path = join(resolve(rootDirectory), "catalogs", "active.json");
  let metadata;
  try { metadata = await lstat(path); }
  catch (error) { if (missing(error)) return null; throw error; }
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("Índice global de publicaciones no regular");
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.providers) ||
    Object.keys(parsed).length !== 2 || !Object.keys(parsed.providers).length) {
    throw new Error("Índice global de publicaciones inválido");
  }
  const providers: Record<string, ActiveCatalogSource> = {};
  for (const [id, source] of Object.entries(parsed.providers)) {
    if (!recognized(id) || !isRecord(source) || typeof source.approvalSha256 !== "string" ||
      !hash(source.approvalSha256) || (source.runId !== undefined &&
      (typeof source.runId !== "string" || !runName(source.runId))) ||
      Object.keys(source).some((key) => key !== "approvalSha256" && key !== "runId")) {
      throw new Error(`Índice global de publicaciones inválido: ${id}`);
    }
    providers[id] = source.runId === undefined ? { approvalSha256: source.approvalSha256 } :
      { approvalSha256: source.approvalSha256, runId: source.runId };
  }
  return { version: 1, providers };
};

export const withActiveCatalogLock = async <T>(rootDirectory: string, task: () => Promise<T>): Promise<T> => {
  const folder = join(resolve(rootDirectory), "catalogs");
  const path = join(folder, ".active.lock");
  let lock;
  try { lock = await open(path, "wx"); }
  catch (error) {
    if (isRecord(error) && error.code === "EEXIST") throw new Error("Otra activación de publicaciones está en curso");
    throw error;
  }
  try { return await task(); }
  finally {
    await lock.close();
    await rm(path, { force: true });
  }
};

export const writeActiveCatalogIndex = async (rootDirectory: string, index: ActiveCatalogIndex): Promise<void> => {
  const folder = join(resolve(rootDirectory), "catalogs");
  const stage = join(folder, `.active-${randomUUID()}.tmp`);
  try {
    await writeFile(stage, `${JSON.stringify(index, null, 2)}\n`, { flag: "wx" });
    await rename(stage, join(folder, "active.json"));
  } finally { await rm(stage, { force: true }); }
};
