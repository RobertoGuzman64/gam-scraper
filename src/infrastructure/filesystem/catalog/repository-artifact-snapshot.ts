import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type RepositoryArtifactFile = {
  readonly name: string;
  readonly content: string;
};

type SnapshotSelection = {
  readonly version: 1;
  readonly sha256: string;
  readonly previousSha256: string | null;
};

const sha256 = (content: string): string => createHash("sha256").update(content).digest("hex");
const validSha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const missing = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ENOENT";

const regularFile = async (path: string): Promise<void> => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error(`Artefacto no regular: ${path}`);
};

const regularDirectory = async (path: string): Promise<void> => {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Directorio de artefactos no regular: ${path}`);
};

const readSelection = async (path: string): Promise<SnapshotSelection | null> => {
  try { await regularFile(path); }
  catch (error) { if (missing(error)) return null; throw error; }
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    !("version" in value) || value.version !== 1 ||
    !("sha256" in value) || !validSha(value.sha256) ||
    !("previousSha256" in value) ||
    (value.previousSha256 !== null && !validSha(value.previousSha256)) ||
    value.previousSha256 === value.sha256 || Object.keys(value).length !== 3) {
    throw new Error(`Selección de artefactos inválida: ${path}`);
  }
  return { version: 1, sha256: value.sha256, previousSha256: value.previousSha256 };
};

const verifyVersion = async (
  directory: string, identityName: string, fingerprint: string, names: readonly string[]
): Promise<void> => {
  await regularDirectory(directory);
  const actual = (await readdir(directory)).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...names].sort())) {
    throw new Error(`Archivos de artefacto incompletos o inesperados: ${directory}`);
  }
  for (const name of names) await regularFile(join(directory, name));
  if (sha256(await readFile(join(directory, identityName), "utf8")) !== fingerprint) {
    throw new Error(`Huella del artefacto no coincide: ${directory}`);
  }
};

export const retainRepositoryArtifact = async (
  directory: string, identityName: string, files: readonly RepositoryArtifactFile[]
): Promise<string> => {
  if (files.length === 0 || files.some(({ name }) => !/^[a-zA-Z0-9_-]+\.(?:json|txt)$/.test(name)) ||
    new Set(files.map(({ name }) => name)).size !== files.length) {
    throw new Error("Lista de artefactos inválida");
  }
  const identity = files.find(({ name }) => name === identityName);
  if (!identity) throw new Error("Falta el archivo de identidad del artefacto");
  const fingerprint = sha256(identity.content);
  const names = files.map(({ name }) => name);
  await mkdir(directory, { recursive: true });
  await regularDirectory(directory);
  const lockPath = join(directory, ".artifact.lock");
  const lock = await open(lockPath, "wx");
  try {
    const versions = join(directory, "versions");
    await mkdir(versions, { recursive: true });
    await regularDirectory(versions);
    const entries = await readdir(versions, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || !validSha(entry.name)) {
        throw new Error(`Versión de artefacto desconocida: ${entry.name}`);
      }
      await verifyVersion(join(versions, entry.name), identityName, entry.name, names);
    }
    const indexPath = join(directory, "active.json");
    const selection = await readSelection(indexPath);
    if ((selection === null && entries.length > 0) ||
      (selection !== null && (!entries.some(({ name }) => name === selection.sha256) ||
        (selection.previousSha256 !== null && !entries.some(({ name }) => name === selection.previousSha256))))) {
      throw new Error(`Artefactos sin selección verificable: ${directory}`);
    }
    const destination = join(versions, fingerprint);
    if (entries.some(({ name }) => name === fingerprint)) {
      for (const file of files) {
        if ((await readFile(join(destination, file.name), "utf8")) !== file.content) {
          throw new Error(`Colisión de artefacto con contenido distinto: ${destination}`);
        }
      }
    } else {
      const stage = join(directory, `.artifact-${randomUUID()}`);
      try {
        await mkdir(stage);
        for (const file of files) await writeFile(join(stage, file.name), file.content, { flag: "wx" });
        await verifyVersion(stage, identityName, fingerprint, names);
        await rename(stage, destination);
      } finally { await rm(stage, { recursive: true, force: true }); }
    }
    const previousSha256 = selection?.sha256 === fingerprint
      ? selection.previousSha256 : selection?.sha256 ?? null;
    const next: SnapshotSelection = { version: 1, sha256: fingerprint, previousSha256 };
    const stageIndex = join(directory, `.active-${randomUUID()}.tmp`);
    try {
      await writeFile(stageIndex, `${JSON.stringify(next, null, 2)}\n`, { flag: "wx" });
      await rename(stageIndex, indexPath);
    } finally { await rm(stageIndex, { force: true }); }
    const retained = new Set([fingerprint, previousSha256]);
    for (const entry of await readdir(versions)) {
      if (!retained.has(entry)) await rm(join(versions, entry), { recursive: true });
    }
    return fingerprint;
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
};

export const inspectRepositoryArtifact = async (
  directory: string, identityName: string, names: readonly string[]
): Promise<{ readonly sha256: string; readonly previousSha256: string | null } | null> => {
  try { await regularDirectory(directory); }
  catch (error) { if (missing(error)) return null; throw error; }
  const entries = (await readdir(directory)).sort();
  if (JSON.stringify(entries) !== JSON.stringify(["active.json", "versions"].sort())) {
    throw new Error(`Almacén de artefactos con entradas no reconocidas: ${directory}`);
  }
  const selected = await readSelection(join(directory, "active.json"));
  if (!selected) throw new Error(`Falta selección activa de artefactos: ${directory}`);
  const versions = join(directory, "versions");
  await regularDirectory(versions);
  const versionEntries = await readdir(versions, { withFileTypes: true });
  const expected = [selected.sha256, ...(selected.previousSha256 ? [selected.previousSha256] : [])];
  if (versionEntries.length !== expected.length ||
    versionEntries.some((entry) => !entry.isDirectory() || entry.isSymbolicLink() || !expected.includes(entry.name))) {
    throw new Error(`Retención de artefactos incoherente: ${directory}`);
  }
  for (const fingerprint of expected) await verifyVersion(join(versions, fingerprint), identityName, fingerprint, names);
  return { sha256: selected.sha256, previousSha256: selected.previousSha256 };
};
