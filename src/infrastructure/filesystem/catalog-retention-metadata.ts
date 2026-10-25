import { createHash } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { atomicWrite } from "./atomic-write.js";
import { parseCanonicalManifest } from "../../catalog/canonical-catalog.js";

export type JsonRecord = Record<string, unknown>;
export type PublishedMetadata = {
  readonly summary: JsonRecord;
  readonly changes: JsonRecord;
  readonly errors: JsonRecord;
};
export const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const sha256 = (content: string): string => createHash("sha256").update(content).digest("hex");

export const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8"));
export const optionalRead = async (file: string): Promise<string | null> => {
  try { return await readFile(file, "utf8"); }
  catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return null;
    throw error;
  }
};
export const parseRecord = (content: string): JsonRecord => {
  const parsed: unknown = JSON.parse(content);
  if (!isRecord(parsed)) throw new Error("Metadatos de publicación inválidos");
  return parsed;
};
export const isPublished = (summary: JsonRecord): boolean => {
  const quality = summary.quality;
  return isRecord(quality) && quality.status === "complete" && quality.published === true;
};
export const verifyPublished = async (dir: string, prefix: string, summary: JsonRecord): Promise<void> => {
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
export const archiveRoot = (dir: string, prefix: string): string => join(dir, ".history", prefix);

export const currentMetadata = async (dir: string, prefix: string): Promise<PublishedMetadata | null> => {
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

export const savePublishedMetadata = async (
  dir: string, prefix: string, metadata: PublishedMetadata
): Promise<void> => {
  await mkdir(archiveRoot(dir, prefix), { recursive: true });
  await atomicWrite(join(archiveRoot(dir, prefix), "active.json"), JSON.stringify({ version: 1, ...metadata }, null, 2));
};

