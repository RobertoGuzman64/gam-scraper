import { randomUUID } from "node:crypto";
import { lstat, open, readdir, readFile, realpath, rename, rm, writeFile, mkdir } from "node:fs/promises";
import { parseCatalogSnapshot } from "../../catalog/snapshot.js";
import { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
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
const providerNames = CAMPAIGN_PROVIDERS.join("|");
const runArtifact = new RegExp(`^(?:${providerNames})(?:\\.log|-(?:summary|changes|errors|preparation|partial-preparation)\\.json)$`);
const publishableArtifact = new RegExp(`^(?:${providerNames})-publishable\\.json$`);
const interventionArtifact = new RegExp(`^(?:${providerNames})-intervention-(?:preparation|preparation\\.manifest|diagnostics)\\.json$`);
const archivePattern = /^archive-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/;
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
export type CleanupArtifactKind = "csv" | "snapshot" | "history" | "other";
export type CleanupInventory = {
  readonly bytes: number;
  readonly files: number;
  readonly breakdown: readonly {
    readonly kind: CleanupArtifactKind;
    readonly files: number;
    readonly bytes: number;
  }[];
};

const scrapedSuffix = (name: string, prefix: string): boolean => {
  if (!name.startsWith(`${prefix}-`)) return false;
  const suffix = name.slice(prefix.length + 1);
  return /^(?:catalog|catalog\.manifest|summary|changes|errors|preparation|partial-preparation)\.json$/.test(suffix) ||
    /^snapshot-[a-zA-Z0-9_-]+\.json$/.test(suffix) ||
    /^(?:partial-)?[a-zA-Z0-9_-]+\.csv$/.test(suffix);
};

const allowedFile = (
  area: CleanupArea, parts: readonly string[], name: string, prefixes: ReadonlyMap<string, string>
): boolean => {
  if (area === "run") return parts.length === 0 &&
    (name === "run.json" || runArtifact.test(name));
  if (area === "scraped") {
    if (parts.length === 1) {
      const prefix = prefixes.get(parts[0] ?? "");
      return prefix !== undefined && scrapedSuffix(name, prefix);
    }
    if (parts.length === 3 && parts[1] === ".history") {
      return parts[2] === prefixes.get(parts[0] ?? "") && name === "active.json";
    }
    if (parts.length === 4 && parts[1] === ".history" && archivePattern.test(parts[3] ?? "")) {
      const prefix = prefixes.get(parts[0] ?? "");
      return prefix !== undefined && parts[2] === prefix &&
        (name === "manifest.json" || scrapedSuffix(name, prefix));
    }
    return false;
  }
  if (area === "campaign") {
    if (parts.length === 0) return name === "delivery.json";
    if (parts.length === 1 && CAMPAIGN_PROVIDERS.some((id) => id === parts[0]))
      return /^[a-zA-Z0-9_-]+-(?:preparation|preparation\.manifest|diagnostics)\.json$/.test(name);
    if (parts.length === 1 && parts[0] === "editorial") return /^accreditation-[a-f0-9]{64}\.json$/.test(name);
    if (parts.length === 2 && parts[0] === "selection" && /^[a-f0-9]{64}$/.test(parts[1] ?? ""))
      return name === "selection.json" || publishableArtifact.test(name);
    return false;
  }
  if (parts.length === 1 && /^[a-f0-9]{64}$/.test(parts[0] ?? ""))
    return name === "catalog-derived.json" || name === "intervention-record.json";
  if (parts.length === 2 && /^[a-f0-9]{64}$/.test(parts[0] ?? "") && parts[1] === "prepared")
    return interventionArtifact.test(name);
  return false;
};

const allowedDir = (
  area: CleanupArea, parts: readonly string[], name: string, prefixes: ReadonlyMap<string, string>
): boolean => {
  if (area === "run") return false;
  if (area === "scraped") {
    if (parts.length === 0) return prefixes.has(name);
    if (parts.length === 1) return prefixes.has(parts[0] ?? "") && name === ".history";
    if (parts.length === 2 && parts[1] === ".history") {
      const prefix = prefixes.get(parts[0] ?? "");
      return prefix !== undefined && name === prefix;
    }
    if (parts.length === 3 && parts[1] === ".history") {
      const prefix = prefixes.get(parts[0] ?? "");
      return prefix !== undefined && parts[2] === prefix && archivePattern.test(name);
    }
    return false;
  }
  if (area === "campaign") return parts.length === 0 ?
    name === "editorial" || name === "selection" || CAMPAIGN_PROVIDERS.some((id) => id === name) :
    parts.length === 1 && parts[0] === "selection" && /^[a-f0-9]{64}$/.test(name);
  return (parts.length === 0 && /^[a-f0-9]{64}$/.test(name)) ||
    (parts.length === 1 && /^[a-f0-9]{64}$/.test(parts[0] ?? "") && name === "prepared");
};

const validateHistory = async (directory: string, prefix: string, archive: boolean): Promise<void> => {
  const filename = archive ? "manifest.json" : "active.json";
  const manifestPath = join(directory, filename);
  if (!(await lstat(manifestPath)).isFile()) throw new Error(`Archivo histórico no regular: ${manifestPath}`);
  const contents: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!isRecord(contents) || contents.version !== 1) throw new Error(`Metadatos históricos inválidos: ${manifestPath}`);
  if (!archive) {
    if (!isRecord(contents.summary) || !isRecord(contents.changes) || !isRecord(contents.errors)) {
      throw new Error(`Metadatos históricos inválidos: ${manifestPath}`);
    }
    return;
  }
  if (contents.prefix !== prefix || !Array.isArray(contents.files) ||
    !contents.files.every((name: unknown) => typeof name === "string" && scrapedSuffix(name, prefix)) ||
    new Set(contents.files).size !== contents.files.length) {
    throw new Error(`Manifiesto del histórico inválido: ${manifestPath}`);
  }
  const expected = new Set([filename, ...contents.files]);
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.length !== expected.size || !entries.every((entry) => entry.isFile() && expected.has(entry.name))) {
    throw new Error(`El histórico no coincide con su manifiesto: ${directory}`);
  }
};

const validateScrapedContent = async (path: string, name: string): Promise<void> => {
  if (name.endsWith(".csv")) {
    const file = await open(path, "r");
    let header: string;
    try {
      const bytes = Buffer.alloc(96);
      const result = await file.read(bytes, 0, bytes.length, 0);
      header = bytes.toString("utf8", 0, result.bytesRead);
    } finally { await file.close(); }
    if (!header.startsWith("categoryKey,categoryName,title,") &&
      !header.startsWith("categoryKey,categoryName,categoryUrl\n")) {
      throw new Error(`CSV de publicación no reconocible: ${path}`);
    }
  } else {
    const marker = "-snapshot-";
    const index = name.lastIndexOf(marker);
    if (index >= 0 && name.endsWith(".json")) {
      const scope = name.slice(index + marker.length, -".json".length);
      parseCatalogSnapshot(await readFile(path, "utf8"), scope);
    }
  }
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
  inventory: MutableInventory, issues: string[]
): Promise<void> => {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const item = join(path, entry.name);
    if (entry.isFile() && allowedFile(area, parts, entry.name, prefixes)) {
      const info = await lstat(item);
      if (!info.isFile()) { issues.push(`Archivo no regular: ${item}`); continue; }
      const historical = area === "scraped" && parts.includes(".history");
      const kind: CleanupArtifactKind = historical ? "history" : entry.name.endsWith(".csv") ? "csv" :
        entry.name.includes("-snapshot-") && entry.name.endsWith(".json") ? "snapshot" : "other";
      try {
        if (historical && entry.name === "active.json") {
          await validateHistory(path, parts[parts.length - 1] ?? "", false);
        }
        if (area === "scraped") await validateScrapedContent(item, entry.name);
      } catch (error) {
        issues.push(`${item}: ${String(error)}`);
      }
      countFile(inventory, info.size, kind);
    } else if (entry.isDirectory() && allowedDir(area, parts, entry.name, prefixes)) {
      if (area === "scraped" && parts.length === 3 && parts[1] === ".history") {
        try { await validateHistory(item, parts[2] ?? "", true); }
        catch (error) { issues.push(`${item}: ${String(error)}`); }
      }
      await inspectTree(item, area, [...parts, entry.name], prefixes, inventory, issues);
    } else issues.push(`Archivo o directorio no reconocido: ${item}`);
  }
};

export const inspectCleanupArea = async (
  root: string, path: string, area: CleanupArea, scrapedPrefixes: ReadonlyMap<string, string> = new Map()
): Promise<CleanupInventory | null> => {
  if (!await readable(path)) return null;
  if (!(await lstat(path)).isDirectory()) throw new Error(`Ruta no segura: ${path}`);
  const actualRoot = await realpath(root);
  const actualPath = await realpath(path);
  if (!inside(actualRoot, actualPath) || actualPath !== path) throw new Error(`Ruta fuera del repositorio o enlazada: ${path}`);
  if (area === "scraped" && (scrapedPrefixes.size !== CAMPAIGN_PROVIDERS.length ||
    !CAMPAIGN_PROVIDERS.every((provider) => validName.test(scrapedPrefixes.get(provider) ?? "")))) {
    throw new Error("Los prefijos de extracción no son válidos para limpiar");
  }
  const inventory: MutableInventory = { bytes: 0, files: 0, breakdown: new Map() };
  const issues: string[] = [];
  await inspectTree(path, area, [], scrapedPrefixes, inventory, issues);
  if (issues.length) throw new Error(`No se borra: ${issues.length} elemento(s) incompatible(s):\n- ${issues.join("\n- ")}`);
  return { bytes: inventory.bytes, files: inventory.files, breakdown: [...inventory.breakdown].map(([kind, totals]) => ({ kind, ...totals })) };
};

export const removeCleanupDirectories = async (paths: readonly string[]): Promise<void> => {
  for (const path of paths) await rm(path, { recursive: true });
};
