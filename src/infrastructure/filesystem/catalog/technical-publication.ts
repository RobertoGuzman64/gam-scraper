import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isCampaignProvider } from "../../../contracts/campaign-providers.js";
import { parseTechnicalSnapshot } from "../../../publication/technical-snapshot.js";
import type { TechnicalProvider, TechnicalSnapshot } from "../../../publication/technical-snapshot.js";

const sha256 = (raw: string): string => createHash("sha256").update(raw).digest("hex");
const sha = (value: string): boolean => /^[a-f0-9]{64}$/.test(value);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const missing = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ENOENT";

const directory = async (path: string, optional = false): Promise<boolean> => {
  try {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Directorio técnico no regular: ${path}`);
    return true;
  } catch (error) {
    if (optional && missing(error)) return false;
    throw error;
  }
};

const file = async (path: string, optional = false): Promise<string | null> => {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Archivo técnico no regular: ${path}`);
    return readFile(path, "utf8");
  } catch (error) {
    if (optional && missing(error)) return null;
    throw error;
  }
};

const paths = (root: string, providerId: string): {
  readonly parent: string; readonly technical: string; readonly versions: string; readonly active: string;
} => {
  if (!isCampaignProvider(providerId)) throw new Error(`Proveedor técnico no reconocido: ${providerId}`);
  const parent = join(resolve(root), "catalogs", "providers", providerId);
  const technical = join(parent, "technical");
  return { parent, technical, versions: join(technical, "versions"), active: join(technical, "active.json") };
};

const checkParent = async (root: string, providerId: string): Promise<void> => {
  for (const item of [resolve(root), join(resolve(root), "catalogs"),
    join(resolve(root), "catalogs", "providers"), paths(root, providerId).parent]) {
    await directory(item);
  }
};

export const readTechnicalVersion = async (
  root: string, providerId: string, fingerprint: string
): Promise<{ readonly sha256: string; readonly snapshot: TechnicalSnapshot } > => {
  if (!sha(fingerprint)) throw new Error("Huella de versión técnica inválida");
  await checkParent(root, providerId);
  const layout = paths(root, providerId);
  for (const path of [layout.technical, layout.versions, join(layout.versions, fingerprint)]) await directory(path);
  const versionDirectory = join(layout.versions, fingerprint);
  const names = await readdir(versionDirectory);
  if (names.length !== 2 || !names.includes("snapshot.json") || !names.includes("manifest.json")) {
    throw new Error("Versión técnica incompleta o con archivos inesperados");
  }
  const snapshotRaw = await file(join(versionDirectory, "snapshot.json"));
  const manifestRaw = await file(join(versionDirectory, "manifest.json"));
  if (snapshotRaw === null || manifestRaw === null) throw new Error("Versión técnica incompleta");
  const snapshot = parseTechnicalSnapshot(JSON.parse(snapshotRaw) as unknown, providerId);
  const manifest: unknown = JSON.parse(manifestRaw);
  if (sha256(snapshotRaw) !== fingerprint || !record(manifest) || Object.keys(manifest).length !== 6 ||
    manifest.version !== 1 || manifest.providerId !== providerId || manifest.sha256 !== fingerprint ||
    manifest.quality !== snapshot.quality || manifest.products !== snapshot.products.length ||
    manifest.sourceSha256 !== (snapshot.source.kind === "canonical"
      ? snapshot.source.catalogSha256 : snapshot.source.recordSha256)) {
    throw new Error("Corte técnico alterado, sin manifest válido o de proveedor distinto");
  }
  return { sha256: fingerprint, snapshot };
};

export const readActiveTechnicalPublication = async (
  root: string, providerId: string
): Promise<{ readonly sha256: string; readonly snapshot: TechnicalSnapshot } | null> => {
  const layout = paths(root, providerId);
  if (!await directory(layout.parent, true)) return null;
  await checkParent(root, providerId);
  if (!await directory(layout.technical, true)) return null;
  const raw = await file(layout.active, true);
  if (raw === null) return null;
  const index: unknown = JSON.parse(raw);
  if (!record(index) || Object.keys(index).length !== 3 || index.version !== 1 ||
    index.providerId !== providerId || typeof index.sha256 !== "string" || !sha(index.sha256)) {
    throw new Error("Índice técnico vigente inválido");
  }
  return readTechnicalVersion(root, providerId, index.sha256);
};

export const listTechnicalVersions = async (root: string, providerId: string): Promise<readonly string[]> => {
  const layout = paths(root, providerId);
  if (!await directory(layout.parent, true)) return [];
  await checkParent(root, providerId);
  if (!await directory(layout.technical, true)) return [];
  const technicalEntries = await readdir(layout.technical, { withFileTypes: true });
  if (technicalEntries.some((entry) => !["active.json", "versions", ".active.lock"].includes(entry.name))) {
    throw new Error(`Almacén técnico con entradas inesperadas: ${providerId}`);
  }
  if (!await directory(layout.versions, true)) return [];
  const entries = await readdir(layout.versions, { withFileTypes: true });
  if (entries.some((entry) => !entry.isDirectory() || entry.isSymbolicLink() || !sha(entry.name))) {
    throw new Error(`Versiones técnicas con entradas inesperadas: ${providerId}`);
  }
  const hashes = entries.map((entry) => entry.name).sort();
  for (const fingerprint of hashes) await readTechnicalVersion(root, providerId, fingerprint);
  return hashes;
};

const ensure = async (path: string): Promise<void> => {
  if (!await directory(path, true)) {
    try { await mkdir(path); }
    catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error; }
  }
  await directory(path);
};

export const activateTechnicalPublication = async (
  root: string, candidate: TechnicalSnapshot, expectedPreviousSha?: string | null
): Promise<{ readonly sha256: string; readonly changed: boolean }> => {
  const snapshot = parseTechnicalSnapshot(candidate, candidate.providerId);
  const raw = `${JSON.stringify(snapshot, null, 2)}\n`;
  const fingerprint = sha256(raw);
  await checkParent(root, candidate.providerId);
  const layout = paths(root, candidate.providerId);
  await ensure(layout.technical);
  const lockPath = join(layout.technical, ".active.lock");
  let lock;
  try { lock = await open(lockPath, "wx"); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error("Otra activación técnica está en curso");
    }
    throw error;
  }
  try {
    const active = await readActiveTechnicalPublication(root, candidate.providerId);
    if (expectedPreviousSha !== undefined && (active?.sha256 ?? null) !== expectedPreviousSha) {
      throw new Error("La versión técnica vigente cambió desde la simulación; repetir la operación");
    }
    if (active?.sha256 === fingerprint) return { sha256: fingerprint, changed: false };
    await ensure(layout.versions);
    const existing = await directory(join(layout.versions, fingerprint), true);
    if (existing) {
      const verified = await readTechnicalVersion(root, candidate.providerId, fingerprint);
      if (JSON.stringify(verified.snapshot) !== JSON.stringify(snapshot)) throw new Error("Versión técnica existente incompatible");
    } else {
      const stage = join(layout.versions, `.pending-${randomUUID()}`);
      await mkdir(stage);
      try {
        const manifest = {
          version: 1, providerId: candidate.providerId, sha256: fingerprint,
          quality: candidate.quality, products: candidate.products.length,
          sourceSha256: candidate.source.kind === "canonical"
            ? candidate.source.catalogSha256 : candidate.source.recordSha256
        };
        await writeFile(join(stage, "snapshot.json"), raw, { flag: "wx" });
        await writeFile(join(stage, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
        await rename(stage, join(layout.versions, fingerprint));
      } finally { await rm(stage, { force: true, recursive: true }); }
      await readTechnicalVersion(root, candidate.providerId, fingerprint);
    }
    const stageIndex = join(layout.technical, `.active-${randomUUID()}.tmp`);
    try {
      await writeFile(stageIndex, `${JSON.stringify({ version: 1, providerId: candidate.providerId, sha256: fingerprint }, null, 2)}\n`, { flag: "wx" });
      await rename(stageIndex, layout.active);
    } finally { await rm(stageIndex, { force: true }); }
    await readActiveTechnicalPublication(root, candidate.providerId);
    return { sha256: fingerprint, changed: true };
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
};

export const technicalSnapshotSha256 = (snapshot: TechnicalSnapshot): string =>
  sha256(`${JSON.stringify(snapshot, null, 2)}\n`);
