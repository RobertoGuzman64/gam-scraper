import { randomUUID } from "node:crypto";
import { lstat, readdir, readFile, realpath, rm, writeFile, mkdir } from "node:fs/promises";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { basename, join, relative, resolve, sep, isAbsolute } from "node:path";
import { assertInactiveCampaignBatchLock } from "../../locking/batch-lock.js";
import { allowedFile, allowedDir, isRecord, validateHistory, validateScrapedContent, type CleanupArea, type CleanupArtifactKind } from "./campaign-cleanup-validation.js";

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
const validName = /^[a-zA-Z0-9_-]+$/;

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
  const folder = join(resolve(rootDirectory), "storage", "campaigns", receipt.runId);
  await mkdir(folder, { recursive: true });
  const target = join(folder, "delivery.json");
  const stage = join(folder, `.delivery-${randomUUID()}.tmp`);
  try {
    await writeFile(stage, JSON.stringify(receipt, null, 2), { flag: "wx" });
    await writeFile(target, await readFile(stage), { flag: "wx" });
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

export type { CleanupArea, CleanupArtifactKind } from "./campaign-cleanup-validation.js";
export type CleanupInventory = {
  readonly bytes: number;
  readonly files: number;
  readonly breakdown: readonly {
    readonly kind: CleanupArtifactKind;
    readonly files: number;
    readonly bytes: number;
  }[];
};


type MutableInventory = { bytes: number; files: number; breakdown: Map<CleanupArtifactKind, { files: number; bytes: number }> };
const countFile = (inventory: MutableInventory, bytes: number, kind: CleanupArtifactKind): void => {
  inventory.bytes += bytes;
  inventory.files += 1;
  const counter = inventory.breakdown.get(kind) ?? { files: 0, bytes: 0 };
  counter.files += 1;
  counter.bytes += bytes;
  inventory.breakdown.set(kind, counter);
};

const inspectTree = async (
  path: string, area: CleanupArea, parts: readonly string[], prefixes: ReadonlyMap<string, string>,
  inventory: MutableInventory, issues: string[], allowPartial: boolean
): Promise<void> => {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const item = join(path, entry.name);
    if (area === "scraped" && parts.length === 0 && entry.name === ".batch.lock") {
      try {
        await assertInactiveCampaignBatchLock(path, basename(path));
        const info = await lstat(item);
        countFile(inventory, info.size, "other");
      } catch (error) {
        issues.push(`${item}: ${String(error)}`);
      }
    } else if (entry.isFile() && allowedFile(area, parts, entry.name, prefixes, allowPartial)) {
      const info = await lstat(item);
      if (!info.isFile()) { issues.push(`Archivo no regular: ${item}`); continue; }
      const historical = area === "scraped" && parts.includes(".history");
      const kind: CleanupArtifactKind = historical ? "history" : entry.name.endsWith(".csv") ? "csv" :
        entry.name.includes("-snapshot-") && entry.name.endsWith(".json") ? "snapshot" : "other";
      try {
        if (!allowPartial && historical && entry.name === "active.json") {
          await validateHistory(path, parts[parts.length - 1] ?? "", false);
        }
        if (!allowPartial && area === "scraped") await validateScrapedContent(item, entry.name);
      } catch (error) {
        issues.push(`${item}: ${String(error)}`);
      }
      countFile(inventory, info.size, kind);
    } else if (entry.isDirectory() && allowedDir(area, parts, entry.name, prefixes)) {
      if (!allowPartial && area === "scraped" && parts.length === 3 && parts[1] === ".history") {
        try { await validateHistory(item, parts[2] ?? "", true); }
        catch (error) { issues.push(`${item}: ${String(error)}`); }
      }
      await inspectTree(item, area, [...parts, entry.name], prefixes, inventory, issues, allowPartial);
    } else issues.push(`Archivo o directorio no reconocido: ${item}`);
  }
};

export const inspectCleanupArea = async (
  root: string, path: string, area: CleanupArea, scrapedPrefixes: ReadonlyMap<string, string> = new Map(),
  allowPartial = false
): Promise<CleanupInventory | null> => {
  if (!await readable(path)) return null;
  if (!(await lstat(path)).isDirectory()) throw new Error(`Ruta no segura: ${path}`);
  const actualRoot = await realpath(root);
  const actualPath = await realpath(path);
  if (!inside(actualRoot, actualPath) || actualPath !== path) throw new Error(`Ruta fuera del repositorio o enlazada: ${path}`);
  if (area === "scraped" && ((scrapedPrefixes.size < 1 || scrapedPrefixes.size > CAMPAIGN_PROVIDERS.length) ||
    ![...scrapedPrefixes.values()].every((prefix) => validName.test(prefix)))) {
    throw new Error("Los prefijos de extracción no son válidos para limpiar");
  }
  const inventory: MutableInventory = { bytes: 0, files: 0, breakdown: new Map() };
  const issues: string[] = [];
  await inspectTree(path, area, [], scrapedPrefixes, inventory, issues, allowPartial);
  if (issues.length) throw new Error(`No se borra: ${issues.length} elemento(s) incompatible(s):\n- ${issues.join("\n- ")}`);
  return { bytes: inventory.bytes, files: inventory.files, breakdown: [...inventory.breakdown].map(([kind, totals]) => ({ kind, ...totals })) };
};

export const removeCleanupDirectories = async (paths: readonly string[]): Promise<void> => {
  for (const path of paths) await rm(path, { recursive: true });
};
