import { lstat, open, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseCatalogSnapshot } from "../../../catalog/snapshot.js";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";

export const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);
const providerNames = CAMPAIGN_PROVIDERS.join("|");
const runArtifact = new RegExp(`^(?:${providerNames})(?:\\.log|-(?:summary|changes|errors|preparation|partial-preparation)\\.json)$`);
const publishableArtifact = new RegExp(`^(?:${providerNames})-publishable\\.json$`);
const interventionArtifact = new RegExp(`^(?:${providerNames})-intervention-(?:preparation|preparation\\.manifest|diagnostics)\\.json$`);
const archivePattern = /^archive-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/;

export type CleanupArea = "run" | "scraped" | "campaign" | "intervention";
export type CleanupArtifactKind = "csv" | "snapshot" | "history" | "other";

const scrapedSuffix = (name: string, prefix: string): boolean => {
  if (!name.startsWith(`${prefix}-`)) return false;
  const suffix = name.slice(prefix.length + 1);
  return /^(?:catalog|catalog\.manifest|summary|changes|errors|preparation|partial-preparation)\.json$/.test(suffix) ||
    /^snapshot-[a-zA-Z0-9_-]+\.json$/.test(suffix) ||
    /^(?:partial-)?[a-zA-Z0-9_-]+\.csv$/.test(suffix);
};

export const allowedFile = (
  area: CleanupArea, parts: readonly string[], name: string, prefixes: ReadonlyMap<string, string>, allowPartial: boolean
): boolean => {
  if (area === "run") return parts.length === 0 &&
    (name === "run.json" || runArtifact.test(name) ||
      (allowPartial && /^run\.json\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.tmp$/.test(name)));
  if (area === "scraped") {
    if (parts.length === 1) {
      const prefix = prefixes.get(parts[0] ?? "");
      if (prefix === undefined) return false;
      if (scrapedSuffix(name, prefix)) return true;
      const temporary = name.match(/^(.+)\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.tmp$/);
      return allowPartial && temporary !== null && scrapedSuffix(temporary[1] ?? "", prefix);
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

export const allowedDir = (
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

export const validateHistory = async (directory: string, prefix: string, archive: boolean): Promise<void> => {
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

export const validateScrapedContent = async (path: string, name: string): Promise<void> => {
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

