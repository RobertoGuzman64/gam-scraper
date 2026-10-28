import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { atomicWrite } from "../atomic-write.js";
import { currentMetadata, archiveRoot, isRecord, readJson, parseRecord, isPublished, verifyPublished, savePublishedMetadata } from "./catalog-retention-metadata.js";

type ArchiveManifest = {
  readonly version: 1;
  readonly prefix: string;
  readonly files: readonly string[];
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

