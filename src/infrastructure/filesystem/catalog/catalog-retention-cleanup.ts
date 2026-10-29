import { lstat, readFile, readdir, rm, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readCanonicalCatalog } from "./canonical-catalog.js";
import { readPortableOriginal } from "./portable-original.js";
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

const redundantArchive = async (archive: string, current: string, prefix: string): Promise<boolean> => {
  if (!await validArchive(archive, prefix)) return false;
  const manifest: unknown = await readJson(join(archive, "manifest.json"));
  if (!isRecord(manifest) || !Array.isArray(manifest.files)) return false;
  for (const file of manifest.files) {
    if (typeof file !== "string") return false;
    const currentFile = join(current, file);
    try {
      const info = await lstat(currentFile);
      if (!info.isFile() || info.isSymbolicLink()) return false;
      const archived = await readFile(join(archive, file));
      const active = await readFile(currentFile);
      if (!archived.equals(active)) return false;
    } catch (error) {
      if (isRecord(error) && error.code === "ENOENT") return false;
      throw error;
    }
  }
  return true;
};

/**
 * Remove only archives duplicated byte for byte in the current publication.
 * A verified portable original does not contain older CSV, snapshots or
 * summaries, so those archives must remain available for local recovery.
 */
export const cleanConsolidatedCatalogHistory = async (
  workspace: string, providerId: string, dir: string, prefix: string
): Promise<readonly RetentionCandidate[]> => {
  const root = resolve(workspace);
  if (resolve(dir) !== join(root, "storage", "scraped", providerId)) {
    throw new Error("Solo se limpia el historial individual del destino predeterminado");
  }
  // Refuse linked directories even when their absolute spelling matches the workspace.
  for (const directory of [join(root, "storage"), join(root, "storage", "scraped"), resolve(dir)]) {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Almacén operativo enlazado o no regular");
  }
  const source = await readCanonicalCatalog(join(dir, `${prefix}-catalog.json`));
  const portable = await readPortableOriginal(root, providerId);
  if (source.providerId !== providerId || source.prefix !== prefix ||
    !isDeepStrictEqual(source, portable)) {
    throw new Error("El original portátil no acredita la publicación individual vigente");
  }
  // Comparing canonical payloads alone is insufficient: guard the exact
  // persisted bytes and the publication summary as well.
  for (const name of [`${prefix}-catalog.json`, `${prefix}-catalog.manifest.json`, `${prefix}-summary.json`]) {
    const current = await readFile(join(dir, name), "utf8");
    const saved = await readFile(join(root, "catalogs", "providers", providerId, "original", name), "utf8");
    if (current !== saved) throw new Error(`El original portátil difiere de ${name}; se conserva el historial`);
  }
  const history = archiveRoot(dir, prefix);
  let entries;
  try {
    for (const directory of [join(dir, ".history"), history]) {
      const info = await lstat(directory);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Historial enlazado o no regular");
    }
    entries = await readdir(history, { withFileTypes: true });
  }
  catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return [];
    throw error;
  }
  // No concurrent publication, unexplained files, or malformed backups.
  const candidates: RetentionCandidate[] = [];
  for (const entry of entries) {
    if (entry.name === "active.json" && entry.isFile()) continue;
    if (!entry.isDirectory() || !archivePattern.test(entry.name) ||
      !await validArchive(join(history, entry.name), prefix)) {
      throw new Error(`Historial no reconocido o en curso: ${entry.name}; no se limpia`);
    }
    const path = join(history, entry.name);
    if (await redundantArchive(path, dir, prefix)) {
      candidates.push({ path, bytes: await bytesInDirectory(path) });
    }
  }
  // No later file/manifest mutations may be accepted in a best-effort cleanup.
  for (const candidate of candidates) {
    if (!await redundantArchive(candidate.path, dir, prefix)) {
      throw new Error(`Historial modificado durante la limpieza: ${candidate.path}`);
    }
  }
  for (const candidate of candidates) await rm(candidate.path, { recursive: true });
  return candidates;
};
