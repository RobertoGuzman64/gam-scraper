import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { atomicWrite } from "./atomic-write.js";
import { parseCanonicalManifest } from "../../catalog/canonical-catalog.js";

type JsonRecord = Record<string, unknown>;
type PublishedMetadata = {
  readonly summary: JsonRecord;
  readonly changes: JsonRecord;
  readonly errors: JsonRecord;
};
type ArchiveManifest = {
  readonly version: 1;
  readonly prefix: string;
  readonly files: readonly string[];
};

export type RetentionCandidate = { readonly path: string; readonly bytes: number };

const pendingPattern = /^\.pending-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[\da-f-]{36}$/;
const archivePattern = /^archive-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[\da-f-]{36}$/;
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const sha256 = (content: string): string => createHash("sha256").update(content).digest("hex");

const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8"));
const optionalRead = async (file: string): Promise<string | null> => {
  try { return await readFile(file, "utf8"); }
  catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return null;
    throw error;
  }
};
const parseRecord = (content: string): JsonRecord => {
  const parsed: unknown = JSON.parse(content);
  if (!isRecord(parsed)) throw new Error("Metadatos de publicación inválidos");
  return parsed;
};
const isPublished = (summary: JsonRecord): boolean => {
  const quality = summary.quality;
  return isRecord(quality) && quality.status === "complete" && quality.published === true;
};
const verifyPublished = async (dir: string, prefix: string, summary: JsonRecord): Promise<void> => {
  const artifacts = summary.artifacts;
  if (!isRecord(artifacts) || typeof artifacts.csvSha256 !== "string" ||
    typeof artifacts.preparationSha256 !== "string") {
    throw new Error(`No se puede proteger la publicación previa de ${prefix}: faltan hashes`);
  }
  const csv = await readFile(join(dir, `${prefix}-all.csv`), "utf8");
  const preparation = await readFile(join(dir, `${prefix}-preparation.json`), "utf8");
  if (sha256(csv) !== artifacts.csvSha256 || sha256(preparation) !== artifacts.preparationSha256) {
    throw new Error(`No se puede proteger la publicación previa de ${prefix}: integridad incorrecta`);
  }
  if (artifacts.catalogSha256 !== undefined) {
    if (typeof artifacts.catalogSha256 !== "string") throw new Error("Hash del catálogo canónico inválido");
    const canonical = await readFile(join(dir, `${prefix}-catalog.json`), "utf8");
    const manifest = parseCanonicalManifest(await readJson(join(dir, `${prefix}-catalog.manifest.json`)));
    if (sha256(canonical) !== artifacts.catalogSha256 || manifest.catalogSha256 !== artifacts.catalogSha256 ||
      manifest.prefix !== prefix || manifest.productCount !== (isRecord(summary.totals) ? summary.totals.scrapedProducts : null)) {
      throw new Error(`No se puede proteger la publicación previa de ${prefix}: catálogo canónico inconsistente`);
    }
  }
};
const archiveRoot = (dir: string, prefix: string): string => join(dir, ".history", prefix);

const currentMetadata = async (dir: string, prefix: string): Promise<PublishedMetadata | null> => {
  const active = await optionalRead(join(archiveRoot(dir, prefix), "active.json"));
  if (active !== null) {
    const parsed = parseRecord(active);
    if (parsed.version !== 1 || !isRecord(parsed.summary) || !isRecord(parsed.changes) || !isRecord(parsed.errors)) {
      throw new Error(`Metadatos de publicación actual inválidos: ${prefix}`);
    }
    if (!isPublished(parsed.summary)) throw new Error(`Publicación actual inválida: ${prefix}`);
    await verifyPublished(dir, prefix, parsed.summary);
    return { summary: parsed.summary, changes: parsed.changes, errors: parsed.errors };
  }
  const summaryText = await optionalRead(join(dir, `${prefix}-summary.json`));
  if (summaryText === null) return null;
  const summary = parseRecord(summaryText);
  if (!isPublished(summary)) return null;
  await verifyPublished(dir, prefix, summary);
  const changesText = await optionalRead(join(dir, `${prefix}-changes.json`));
  const errorsText = await optionalRead(join(dir, `${prefix}-errors.json`));
  if (changesText === null || errorsText === null) {
    throw new Error(`Faltan metadatos de la publicación previa de ${prefix}`);
  }
  return { summary, changes: parseRecord(changesText), errors: parseRecord(errorsText) };
};

export type PendingArchive = { readonly staging: string; readonly destination: string };

export const stagePublishedCatalog = async (dir: string, prefix: string): Promise<PendingArchive | null> => {
  if (!prefix || prefix === "." || prefix === ".." || /[\\/]/.test(prefix)) throw new Error("Prefijo inválido");
  const metadata = await currentMetadata(dir, prefix);
  if (metadata === null) return null;
  const root = archiveRoot(dir, prefix);
  const token = `${new Date().toISOString().replace(/:/g, "-").replace(/\./g, "-")}-${randomUUID()}`;
  const staging = join(root, `.pending-${token}`);
  const destination = join(root, `archive-${token}`);
  const categories = metadata.summary.categories;
  if (!Array.isArray(categories)) throw new Error(`Categorías del catálogo anterior inválidas: ${prefix}`);
  const keys = new Set<string>([`${prefix}-all.csv`, `${prefix}-categories.csv`]);
  for (const category of categories as readonly unknown[]) {
    if (!isRecord(category) || typeof category.key !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(category.key)) throw new Error(`Clave de categoría inválida en ${prefix}`);
    keys.add(`${prefix}-${category.key}.csv`);
  }
  await mkdir(staging, { recursive: true });
  const files: string[] = [];
  try {
    for (const name of keys) {
      const source = join(dir, name);
      try {
        const info = await stat(source);
        if (!info.isFile()) throw new Error(`Archivo de catálogo no regular: ${name}`);
        await copyFile(source, join(staging, name));
        files.push(name);
      } catch (error) {
        if (isRecord(error) && error.code === "ENOENT" && name === `${prefix}-categories.csv`) continue;
        throw error;
      }
    }
    const scope = metadata.changes.scope;
    if (typeof scope === "string" && /^[a-zA-Z0-9_-]+$/.test(scope)) {
      const snapshot = `${prefix}-snapshot-${scope}.json`;
      await copyFile(join(dir, snapshot), join(staging, snapshot));
      files.push(snapshot);
    }
    if (isRecord(metadata.summary.artifacts) && metadata.summary.artifacts.catalogSha256 !== undefined) {
      for (const suffix of ["catalog.json", "catalog.manifest.json"]) {
        const name = `${prefix}-${suffix}`;
        await copyFile(join(dir, name), join(staging, name));
        files.push(name);
      }
    }
    const preparation = `${prefix}-preparation.json`;
    await copyFile(join(dir, preparation), join(staging, preparation));
    files.push(preparation);
    for (const [suffix, contents] of Object.entries({
      summary: metadata.summary, changes: metadata.changes, errors: metadata.errors
    })) {
      const name = `${prefix}-${suffix}.json`;
      await writeFile(join(staging, name), JSON.stringify(contents, null, 2), "utf8");
      files.push(name);
    }
    const manifest: ArchiveManifest = { version: 1, prefix, files };
    await writeFile(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    return { staging, destination };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
};

export const abandonArchive = async (pending: PendingArchive | null): Promise<void> => {
  if (pending) await rm(pending.staging, { recursive: true, force: true });
};

export const restorePublishedCatalog = async (
  dir: string, prefix: string, pending: PendingArchive
): Promise<void> => {
  let directory = pending.staging;
  try { await stat(directory); }
  catch (error) {
    if (!isRecord(error) || error.code !== "ENOENT") throw error;
    directory = pending.destination;
  }
  const metadata = await readJson(join(directory, "manifest.json"));
  if (!isRecord(metadata) || metadata.version !== 1 || metadata.prefix !== prefix ||
    !Array.isArray(metadata.files) || !metadata.files.every((file: unknown) =>
      typeof file === "string" && file !== "." && file !== ".." && basename(file) === file && !file.includes("\\"))) {
    throw new Error("No se puede restaurar la publicación: archivo histórico inválido");
  }
  for (const file of metadata.files) {
    await atomicWrite(join(dir, file), await readFile(join(directory, file), "utf8"));
  }
  if (!metadata.files.includes(`${prefix}-catalog.json`)) {
    await rm(join(dir, `${prefix}-catalog.json`), { force: true });
    await rm(join(dir, `${prefix}-catalog.manifest.json`), { force: true });
  }
  const [summary, changes, errors] = await Promise.all([
    readJson(join(directory, `${prefix}-summary.json`)),
    readJson(join(directory, `${prefix}-changes.json`)),
    readJson(join(directory, `${prefix}-errors.json`))
  ]);
  if (!isRecord(summary) || !isRecord(changes) || !isRecord(errors)) {
    throw new Error("No se puede restaurar la publicación: metadatos inválidos");
  }
  await savePublishedMetadata(dir, prefix, { summary, changes, errors });
  await rm(directory, { recursive: true, force: true });
};

export const savePublishedMetadata = async (
  dir: string, prefix: string, metadata: PublishedMetadata
): Promise<void> => {
  await mkdir(archiveRoot(dir, prefix), { recursive: true });
  await atomicWrite(join(archiveRoot(dir, prefix), "active.json"), JSON.stringify({ version: 1, ...metadata }, null, 2));
};

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

export const finalizePublishedCatalog = async (
  dir: string, prefix: string, pending: PendingArchive | null
): Promise<void> => {
  const summary = parseRecord(await readFile(join(dir, `${prefix}-summary.json`), "utf8"));
  if (!isPublished(summary)) throw new Error(`No se puede rotar una extracción no publicada: ${prefix}`);
  await verifyPublished(dir, prefix, summary);
  const changes = parseRecord(await readFile(join(dir, `${prefix}-changes.json`), "utf8"));
  const errors = parseRecord(await readFile(join(dir, `${prefix}-errors.json`), "utf8"));
  if (pending) await rename(pending.staging, pending.destination);
  await savePublishedMetadata(dir, prefix, { summary, changes, errors });
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
