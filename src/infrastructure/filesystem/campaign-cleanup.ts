import { randomUUID } from "node:crypto";
import { lstat, readdir, realpath, rename, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { join, relative, resolve, sep, isAbsolute } from "node:path";

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);
const inside = (parent: string, child: string): boolean => {
  const path = relative(parent, child);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
};
const readable = async (path: string): Promise<boolean> => {
  try { await lstat(path); return true; }
  catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return false;
    throw error;
  }
};
const CAMPAIGN_PROVIDERS = ["gam", "gomariz", "mercaeleva"] as const;

export type CampaignDeliveryReceipt = {
  readonly version: 1;
  readonly runId: string;
  readonly date: string;
  readonly zipFile: string;
  readonly zipSha256: string;
  readonly selectionSha256: string;
};

export const persistCampaignDelivery = async (
  rootDirectory: string, receipt: CampaignDeliveryReceipt
): Promise<void> => {
  const folder = join(resolve(rootDirectory), "storage", "campanas", receipt.runId);
  await mkdir(folder, { recursive: true });
  const target = join(folder, "delivery.json");
  const stage = join(folder, `.delivery-${randomUUID()}.tmp`);
  try {
    await writeFile(stage, JSON.stringify(receipt, null, 2), { flag: "wx" });
    await rename(stage, target);
  } finally { await rm(stage, { force: true }); }
};

export const removeDeliveredRunLogs = async (rootDirectory: string, runId: string): Promise<number> => {
  const directory = join(resolve(rootDirectory), "storage", "runs", runId);
  let removed = 0;
  for (const provider of CAMPAIGN_PROVIDERS) {
    const path = join(directory, `${provider}.log`);
    if (!await readable(path)) continue;
    if (!(await lstat(path)).isFile()) throw new Error(`Log no regular: ${path}`);
    await rm(path);
    removed += 1;
  }
  return removed;
};

export type CleanupArea = "run" | "scraped" | "campaign" | "intervention";

const allowedFile = (area: CleanupArea, parts: readonly string[], name: string): boolean => {
  if (area === "run") return parts.length === 0 &&
    (name === "run.json" || /^(gam|gomariz|mercaeleva)(?:\.log|-(?:summary|changes|errors|preparation|partial-preparation)\.json)$/.test(name));
  if (area === "scraped") return parts.length === 1 && CAMPAIGN_PROVIDERS.some((id) => id === parts[0]) &&
    /^[a-zA-Z0-9_-]+-(?:catalog|catalog\.manifest|summary|changes|errors|preparation|partial-preparation)\.json$/.test(name);
  if (area === "campaign") {
    if (parts.length === 0) return name === "delivery.json";
    if (parts.length === 1 && CAMPAIGN_PROVIDERS.some((id) => id === parts[0]))
      return /^[a-zA-Z0-9_-]+-(?:preparation|preparation\.manifest|diagnostics)\.json$/.test(name);
    if (parts.length === 1 && parts[0] === "editorial") return /^acreditacion-[a-f0-9]{64}\.json$/.test(name);
    if (parts.length === 2 && parts[0] === "seleccion" && /^[a-f0-9]{64}$/.test(parts[1] ?? ""))
      return name === "selection.json" || /^(gam|gomariz|mercaeleva)-publishable\.json$/.test(name);
    return false;
  }
  if (parts.length === 1 && /^[a-f0-9]{64}$/.test(parts[0] ?? ""))
    return name === "catalog-derived.json" || name === "intervention-record.json";
  if (parts.length === 2 && /^[a-f0-9]{64}$/.test(parts[0] ?? "") && parts[1] === "prepared")
    return /^(gam|gomariz|mercaeleva)-intervention-(?:preparation|preparation\.manifest|diagnostics)\.json$/.test(name);
  return false;
};

const allowedDir = (area: CleanupArea, parts: readonly string[], name: string): boolean => {
  if (area === "run") return false;
  if (area === "scraped") return parts.length === 0 && CAMPAIGN_PROVIDERS.some((id) => id === name);
  if (area === "campaign") return parts.length === 0 ?
    name === "editorial" || name === "seleccion" || CAMPAIGN_PROVIDERS.some((id) => id === name) :
    parts.length === 1 && parts[0] === "seleccion" && /^[a-f0-9]{64}$/.test(name);
  return (parts.length === 0 && /^[a-f0-9]{64}$/.test(name)) ||
    (parts.length === 1 && /^[a-f0-9]{64}$/.test(parts[0] ?? "") && name === "prepared");
};

const inspectTree = async (path: string, area: CleanupArea, parts: readonly string[]): Promise<number> => {
  let bytes = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const item = join(path, entry.name);
    if (entry.isFile() && allowedFile(area, parts, entry.name)) bytes += (await stat(item)).size;
    else if (entry.isDirectory() && allowedDir(area, parts, entry.name))
      bytes += await inspectTree(item, area, [...parts, entry.name]);
    else throw new Error(`No se borra: existe un archivo o directorio no reconocido: ${item}`);
  }
  return bytes;
};

export const inspectCleanupArea = async (root: string, path: string, area: CleanupArea): Promise<number | null> => {
  if (!await readable(path)) return null;
  if (!(await lstat(path)).isDirectory()) throw new Error(`Ruta no segura: ${path}`);
  const actualRoot = await realpath(root);
  const actualPath = await realpath(path);
  if (!inside(actualRoot, actualPath) || actualPath !== path) throw new Error(`Ruta fuera del repositorio o enlazada: ${path}`);
  return inspectTree(path, area, []);
};

export const removeCleanupDirectories = async (paths: readonly string[]): Promise<void> => {
  for (const path of paths) await rm(path, { recursive: true });
};
