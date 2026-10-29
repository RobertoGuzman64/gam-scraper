import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type { CanonicalCatalog } from "../../../catalog/canonical-catalog.js";
import { isCampaignProvider } from "../../../contracts/campaign-providers.js";
import { readCanonicalCatalog } from "./canonical-catalog.js";

const originalFolder = "original";
const rollbackFolder = ".original-rollback";
const pendingPrefix = ".original-pending-";

const missing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const safeDirectory = async (path: string): Promise<boolean> => {
  try {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`Almacén portátil: directorio no regular: ${path}`);
    }
    return true;
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
};

const ensureDirectory = async (path: string): Promise<void> => {
  if (!await safeDirectory(path)) await mkdir(path);
  await safeDirectory(path);
};

const pathsFor = (directory: string, prefix: string): readonly string[] => [
  join(directory, `${prefix}-catalog.json`),
  join(directory, `${prefix}-catalog.manifest.json`),
  join(directory, `${prefix}-summary.json`)
];

const portableRoot = (workspace: string, providerId: string): string => {
  if (!isCampaignProvider(providerId)) throw new Error(`Proveedor no admitido en catalogs/: ${providerId}`);
  return join(resolve(workspace), "catalogs", "providers", providerId);
};

const inspectOriginal = async (directory: string, providerId: string): Promise<{
  readonly catalog: CanonicalCatalog;
  readonly files: readonly { readonly name: string; readonly content: string }[];
}> => {
  if (!await safeDirectory(directory)) throw new Error(`Falta original portátil: ${providerId}`);
  const names = (await readdir(directory)).sort();
  const catalogs = names.filter((name) => name.endsWith("-catalog.json"));
  if (catalogs.length !== 1) throw new Error(`Original portátil ambiguo o incompleto: ${providerId}`);
  const prefix = catalogs[0]!.slice(0, -"-catalog.json".length);
  const expected = pathsFor(directory, prefix);
  if (names.length !== expected.length || expected.some((path) => !names.includes(basename(path)))) {
    throw new Error(`Original portátil con archivos inesperados o ausentes: ${providerId}`);
  }
  const files = [];
  for (const path of expected) {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Archivo de catálogo no regular: ${path}`);
    files.push({ name: basename(path), content: await readFile(path, "utf8") });
  }
  const catalog = await readCanonicalCatalog(expected[0]!);
  if (catalog.providerId !== providerId) throw new Error(`Original portátil de proveedor distinto: ${providerId}`);
  return { catalog, files };
};

const ensureProviderDirectory = async (workspace: string, providerId: string): Promise<string> => {
  const root = resolve(workspace);
  for (const path of [join(root, "catalogs"), join(root, "catalogs", "providers"), portableRoot(root, providerId)]) {
    await ensureDirectory(path);
  }
  return portableRoot(root, providerId);
};

const identicalFiles = (
  left: readonly { readonly name: string; readonly content: string }[],
  right: readonly { readonly name: string; readonly content: string }[]
): boolean => left.length === right.length && left.every((item, i) =>
  item.name === right[i]?.name && item.content === right[i]?.content);

export const readPortableOriginal = async (workspace: string, providerId: string): Promise<CanonicalCatalog> => {
  const base = portableRoot(workspace, providerId);
  for (const path of [join(resolve(workspace), "catalogs"), join(resolve(workspace), "catalogs", "providers"), base]) {
    if (!await safeDirectory(path)) throw new Error(`Falta almacén portátil: ${providerId}`);
  }
  if (await safeDirectory(join(base, rollbackFolder))) {
    throw new Error(`Original portátil pendiente de recuperación: ${providerId}`);
  }
  return (await inspectOriginal(join(base, originalFolder), providerId)).catalog;
};

/** Recovers a directory swap interrupted after its former original was secured. */
export const recoverPortableOriginal = async (workspace: string, providerId: string): Promise<boolean> => {
  const base = portableRoot(workspace, providerId);
  if (!await safeDirectory(base)) return false;
  const backup = join(base, rollbackFolder);
  if (!await safeDirectory(backup)) return false;
  const current = join(base, originalFolder);
  await inspectOriginal(backup, providerId);
  if (await safeDirectory(current)) {
    // A committed replacement is authoritative only when fully verifiable.
    await inspectOriginal(current, providerId);
    await rm(backup, { recursive: true });
  } else {
    await rename(backup, current);
  }
  return true;
};

/**
 * Explicit, verified promotion only. Extraction and campaign flows remain unchanged.
 * Exactly one complete source catalog, manifest and summary are kept per provider.
 */
export const consolidatePortableOriginal = async (
  workspace: string, sourceCatalogFile: string
): Promise<{ readonly providerId: string; readonly productCount: number; readonly changed: boolean }> => {
  const source = resolve(sourceCatalogFile);
  const sourceName = basename(source);
  if (!sourceName.endsWith("-catalog.json")) throw new Error("Se requiere un original -catalog.json");
  const prefix = sourceName.slice(0, -"-catalog.json".length);
  const sourceFiles = pathsFor(dirname(source), prefix);
  // Validate the actual publication, including its manifest, checksum and complete summary.
  const verified = await readCanonicalCatalog(source);
  if (!isCampaignProvider(verified.providerId)) throw new Error("Proveedor de origen no admitido");
  const rawFiles = [];
  for (const path of sourceFiles) {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Fuente no regular: ${path}`);
    rawFiles.push({ name: basename(path), content: await readFile(path, "utf8") });
  }
  const base = await ensureProviderDirectory(workspace, verified.providerId);
  const destination = join(base, originalFolder);
  const backup = join(base, rollbackFolder);
  if (await safeDirectory(backup)) {
    throw new Error(`Original pendiente de recuperación: ${verified.providerId}`);
  }
  if (await safeDirectory(destination)) {
    const existing = await inspectOriginal(destination, verified.providerId);
    if (identicalFiles(existing.files, rawFiles)) {
      return { providerId: verified.providerId, productCount: existing.catalog.productCount, changed: false };
    }
    if (Date.parse(verified.endedAt) <= Date.parse(existing.catalog.endedAt)) {
      throw new Error(`No se puede sustituir un original vigente por una ejecución anterior o contradictoria: ${verified.providerId}`);
    }
  }
  const stage = join(base, `${pendingPrefix}${randomUUID()}`);
  await mkdir(stage);
  let backedUp = false;
  let promoted = false;
  try {
    for (const file of rawFiles) await writeFile(join(stage, file.name), file.content, { flag: "wx" });
    await inspectOriginal(stage, verified.providerId);
    // Fail closed if the source was concurrently replaced between validation and promotion.
    await readCanonicalCatalog(source);
    for (const [index, path] of sourceFiles.entries()) {
      if (await readFile(path, "utf8") !== rawFiles[index]?.content) {
        throw new Error("El origen cambió durante la consolidación");
      }
    }
    if (await safeDirectory(destination)) {
      await rename(destination, backup);
      backedUp = true;
    }
    await rename(stage, destination);
    promoted = true;
    await inspectOriginal(destination, verified.providerId);
    if (backedUp) await rm(backup, { recursive: true });
    return { providerId: verified.providerId, productCount: verified.productCount, changed: true };
  } catch (error) {
    if (backedUp && await safeDirectory(backup)) {
      if (promoted) await rm(destination, { recursive: true, force: true });
      await rename(backup, destination);
    }
    throw error;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
};
