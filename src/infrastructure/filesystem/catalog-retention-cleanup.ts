import { readFile, readdir, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { archiveRoot, currentMetadata, isRecord, readJson, optionalRead, parseRecord, isPublished } from "./catalog-retention-metadata.js";

export type RetentionCandidate = { readonly path: string; readonly bytes: number };

const pendingPattern = /^\.pending-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[\da-f-]{36}$/;
const archivePattern = /^archive-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[\da-f-]{36}$/;
const validArchive = async (directory: string, prefix: string): Promise<boolean> => {
  try {
    const data: unknown = await readJson(join(directory, "manifest.json"));
    if (!isRecord(data) || data.version !== 1 || data.prefix !== prefix || !Array.isArray(data.files) ||
      !data.files.every((file: unknown) => typeof file === "string" && basename(file) === file &&
        file !== "manifest.json" && !file.includes("\\"))) return false;
    const expected = new Set<string>(["manifest.json", ...data.files]);
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.length === expected.size && entries.every((entry) => entry.isFile() && expected.has(entry.name));
  } catch { return false; }
};

const bytesInDirectory = async (dir: string): Promise<number> => {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isFile()) total += (await stat(join(dir, entry.name))).size;
    else if (entry.isDirectory()) total += await bytesInDirectory(join(dir, entry.name));
  }
  return total;
};

export const catalogArchiveExcess = async (dir: string, prefix: string): Promise<readonly RetentionCandidate[]> => {
  const root = archiveRoot(dir, prefix);
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); }
  catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return [];
    throw error;
  }
  const valid: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && archivePattern.test(entry.name) && await validArchive(join(root, entry.name), prefix)) {
      valid.push(entry.name);
    }
  }
  valid.sort().reverse();
  return Promise.all(valid.slice(2).map(async (name) => {
    const path = join(root, name);
    return { path, bytes: await bytesInDirectory(path) };
  }));
};

export const staleArchiveExcess = async (dir: string, prefix: string): Promise<readonly RetentionCandidate[]> => {
  const root = archiveRoot(dir, prefix);
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); }
  catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return [];
    throw error;
  }
  const expired: RetentionCandidate[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !pendingPattern.test(entry.name)) continue;
    const path = join(root, entry.name);
    if (Date.now() - (await stat(path)).mtimeMs < 48 * 60 * 60 * 1000) continue;
    expired.push({ path, bytes: await bytesInDirectory(path) });
  }
  return expired;
};

export const partialArtifactExcess = async (dir: string, prefix: string): Promise<readonly RetentionCandidate[]> => {
  const summaryText = await optionalRead(join(dir, `${prefix}-summary.json`));
  if (summaryText === null || !isPublished(parseRecord(summaryText))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isFile() &&
    entry.name.startsWith(`${prefix}-partial-`) && /\.(csv|json)$/.test(entry.name));
  return Promise.all(names.map(async (entry) => {
    const path = join(dir, entry.name);
    return { path, bytes: (await stat(path)).size };
  }));
};

export const cleanCatalogExcess = async (dir: string, prefix: string, dryRun: boolean): Promise<readonly RetentionCandidate[]> => {
  const candidates = [
    ...await catalogArchiveExcess(dir, prefix),
    ...await staleArchiveExcess(dir, prefix),
    ...await partialArtifactExcess(dir, prefix)
  ];
  if (!dryRun) for (const candidate of candidates) await rm(candidate.path, { recursive: true, force: true });
  return candidates;
};

export const legacyCatalogExcess = async (dir: string, activePrefix: string): Promise<readonly RetentionCandidate[]> => {
  const active = await currentMetadata(dir, activePrefix);
  if (!active || typeof active.summary.startedAt !== "string") return [];
  const activeDate = Date.parse(active.summary.startedAt);
  if (!Number.isFinite(activeDate)) return [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return [];
    throw error;
  }
  const names = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const prefixes: string[] = [];
  for (const name of names) {
    if (!name.endsWith("-summary.json")) continue;
    const prefix = name.slice(0, -"-summary.json".length);
    if (prefix === activePrefix || !/^[a-zA-Z0-9_-]+$/.test(prefix)) continue;
    try {
      const previous = parseRecord(await readFile(join(dir, name), "utf8"));
      if (typeof previous.startedAt === "string" && Number.isFinite(Date.parse(previous.startedAt)) &&
        Date.parse(previous.startedAt) < activeDate) prefixes.push(prefix);
    } catch { continue; }
  }
  prefixes.sort((a, b) => b.length - a.length);
  const candidates: RetentionCandidate[] = [];
  for (const name of names) {
    if (name.includes("-snapshot-") || !/\.(csv|json)$/.test(name)) continue;
    const prefix = prefixes.find((candidate) => name.startsWith(`${candidate}-`));
    if (!prefix || name.startsWith(`${activePrefix}-`)) continue;
    const path = join(dir, name);
    candidates.push({ path, bytes: (await stat(path)).size });
  }
  return candidates;
};

export const cleanLegacyCatalogExcess = async (
  dir: string, prefix: string, dryRun: boolean
): Promise<readonly RetentionCandidate[]> => {
  const candidates = await legacyCatalogExcess(dir, prefix);
  if (!dryRun) for (const candidate of candidates) await rm(candidate.path);
  return candidates;
};
