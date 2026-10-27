import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { parseCanonicalCatalog } from "../../catalog/canonical-catalog.js";
import { parseReferenceManifest } from "../../catalog/reference/manifest.js";
import { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import type { CanonicalCatalog } from "../../catalog/canonical-catalog.js";
import type { ReferenceComparison } from "../../catalog/reference/compare.js";
import type { ReferenceManifest } from "../../catalog/reference/manifest.js";

export type StoredCampaignReference = {
  readonly manifest: ReferenceManifest;
  readonly catalogs: readonly CanonicalCatalog[];
};

export type CampaignReferenceInspection =
  | { readonly status: "absent" }
  | { readonly status: "valid"; readonly reference: StoredCampaignReference }
  | { readonly status: "recoverable"; readonly reference: StoredCampaignReference; readonly reason: string }
  | { readonly status: "invalid"; readonly reason: string };

export type ReferenceCatalogSource = {
  readonly providerId: string;
  readonly catalog: CanonicalCatalog;
  readonly raw: string;
};

const digest = (input: string): string => createHash("sha256").update(input).digest("hex");
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const missing = (error: unknown): boolean => record(error) && error.code === "ENOENT";

const directoryExists = async (directory: string): Promise<boolean> => {
  try {
    if (!(await lstat(directory)).isDirectory()) throw new Error(`No es un directorio: ${directory}`);
    return true;
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
};

const paths = (rootDirectory: string) => {
  const parent = join(resolve(rootDirectory), "data");
  return {
    parent,
    active: join(parent, "referencia"),
    backup: join(parent, ".referencia-anterior"),
    staging: join(parent, ".referencia-candidata"),
    lock: join(parent, ".referencia-bloqueo")
  };
};

const referenceFiles = [...CAMPAIGN_PROVIDERS.map((provider) => `${provider}.json`), "manifest.json", "diferencias.json"];

const readReferenceDirectory = async (directory: string): Promise<StoredCampaignReference> => {
  const files = await readdir(directory);
  for (const file of files) {
    if (!(await lstat(join(directory, file))).isFile()) {
      throw new Error(`La referencia contiene un elemento que no es archivo regular: ${file}`);
    }
  }
  if (files.length !== referenceFiles.length || referenceFiles.some((file) => !files.includes(file))) {
    throw new Error("La referencia existe pero está incompleta o contiene archivos inesperados");
  }
  const manifestInput: unknown = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  const manifest = parseReferenceManifest(manifestInput);
  const differences = await readFile(join(directory, "diferencias.json"), "utf8");
  if (digest(differences) !== manifest.differencesSha256) {
    throw new Error("El informe de diferencias no coincide con el manifiesto de referencia");
  }
  const report: unknown = JSON.parse(differences);
  if (!record(report) || report.version !== 1 || report.currentRunId !== manifest.runId ||
    (report.baseline !== "initial" && report.baseline !== "previous") ||
    (report.baseline === "initial" ? report.previousRunId !== null :
      typeof report.previousRunId !== "string" || !report.previousRunId.trim())) {
    throw new Error("El informe de diferencias no pertenece a la referencia vigente");
  }
  const catalogs: CanonicalCatalog[] = [];
  for (const providerId of CAMPAIGN_PROVIDERS) {
    const entry = manifest.catalogs.find((item) => item.providerId === providerId);
    if (!entry) throw new Error(`Falta ${providerId} en el manifiesto`);
    const raw = await readFile(join(directory, `${providerId}.json`), "utf8");
    if (digest(raw) !== entry.sha256) throw new Error(`Huella alterada en la referencia de ${providerId}`);
    const catalogInput: unknown = JSON.parse(raw);
    const catalog = parseCanonicalCatalog(catalogInput);
    if (catalog.providerId !== providerId || catalog.prefix !== entry.prefix || catalog.scope !== entry.scope ||
      catalog.productCount !== entry.productCount) throw new Error(`Metadatos inconsistentes en la referencia de ${providerId}`);
    catalogs.push(catalog);
  }
  return { manifest, catalogs };
};

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

export const inspectCampaignReference = async (rootDirectory: string): Promise<CampaignReferenceInspection> => {
  const { active, backup, staging, lock } = paths(rootDirectory);
  try {
    const activeExists = await directoryExists(active);
    const backupExists = await directoryExists(backup);
    const stagingExists = await directoryExists(staging);
    const lockExists = await pathExists(lock);
    if (!activeExists && !backupExists && !stagingExists && !lockExists) return { status: "absent" };
    let invalidActive: string | null = null;
    if (activeExists) {
      try {
        const reference = await readReferenceDirectory(active);
        if (!backupExists && !stagingExists && !lockExists) return { status: "valid", reference };
        return { status: "recoverable", reference, reason: "La referencia vigente es íntegra, pero hay una transacción pendiente; inspeccionar antes de actualizar" };
      } catch (error) { invalidActive = errorMessage(error); }
    }
    if (backupExists) {
      try {
        const reference = await readReferenceDirectory(backup);
        return { status: "recoverable", reference, reason: invalidActive === null ?
          "Existe una copia anterior íntegra sin referencia activa" :
          `La referencia activa es inválida (${invalidActive}); existe una copia anterior íntegra` };
      } catch (error) {
        return { status: "invalid", reason: `La referencia anterior tampoco es válida: ${errorMessage(error)}` };
      }
    }
    return { status: "invalid", reason: invalidActive ?? "Existen archivos de una transacción sin referencia válida" };
  } catch (error) {
    return { status: "invalid", reason: errorMessage(error) };
  }
};

export const readCampaignReference = async (rootDirectory: string): Promise<StoredCampaignReference | null> => {
  const { active, backup } = paths(rootDirectory);
  if (await directoryExists(active)) return readReferenceDirectory(active);
  if (await directoryExists(backup)) return readReferenceDirectory(backup);
  return null;
};

const pathExists = async (file: string): Promise<boolean> => {
  try { await lstat(file); return true; }
  catch (error) { if (missing(error)) return false; throw error; }
};

const independentDirectory = (rootDirectory: string, directory: string): string => {
  if (!directory.trim()) throw new Error("Se necesita una carpeta de traslado explícita");
  const destination = resolve(directory);
  const separation = relative(resolve(rootDirectory), destination);
  if (!separation || (!separation.startsWith("..") && !isAbsolute(separation))) {
    throw new Error("La carpeta de traslado debe estar fuera del repositorio");
  }
  return destination;
};

export const exportCampaignReference = async (rootDirectory: string, directory: string): Promise<ReferenceManifest> => {
  const destination = independentDirectory(rootDirectory, directory);
  const inspection = await inspectCampaignReference(rootDirectory);
  if (inspection.status !== "valid") {
    throw new Error(inspection.status === "absent" ? "No existe referencia para exportar" :
      inspection.reason);
  }
  const { active } = paths(rootDirectory);
  await mkdir(destination);
  try {
    for (const filename of referenceFiles) await copyFile(join(active, filename), join(destination, filename));
    const exported = await readReferenceDirectory(destination);
    if (exported.manifest.runId !== inspection.reference.manifest.runId) {
      throw new Error("La referencia cambió durante la exportación");
    }
    return exported.manifest;
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
};

const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !record(error) || error.code !== "ESRCH";
  }
};

const acquireLock = async (path: string): Promise<() => Promise<void>> => {
  const create = async (): Promise<void> => {
    const handle = await open(path, "wx");
    try { await handle.writeFile(JSON.stringify({ pid: process.pid })); }
    finally { await handle.close(); }
  };
  try {
    await create();
  } catch (error) {
    if (!record(error) || error.code !== "EEXIST") throw error;
    let lock: unknown;
    try { lock = JSON.parse(await readFile(path, "utf8")); }
    catch { throw new Error("Bloqueo de referencia no verificable; revisar antes de actualizar"); }
    if (!record(lock) || typeof lock.pid !== "number" || !Number.isSafeInteger(lock.pid) || lock.pid < 1 || pidAlive(lock.pid)) {
      throw new Error("Otra actualización de referencia está activa o su bloqueo requiere revisión");
    }
    await rm(path);
    await create();
  }
  return async () => rm(path, { force: true });
};

const recoverTransaction = async (active: string, backup: string, staging: string): Promise<void> => {
  if (await directoryExists(backup)) {
    if (!(await directoryExists(active))) {
      await readReferenceDirectory(backup);
      await rename(backup, active);
    } else {
      let validActive = true;
      try { await readReferenceDirectory(active); }
      catch { validActive = false; }
      if (validActive) {
        await rm(backup, { recursive: true });
      } else {
        await readReferenceDirectory(backup);
        await rm(active, { recursive: true });
        await rename(backup, active);
      }
    }
  }
  if (await directoryExists(staging)) await rm(staging, { recursive: true });
  if (await directoryExists(active)) await readReferenceDirectory(active);
};

export const recoverCampaignReference = async (rootDirectory: string): Promise<ReferenceManifest> => {
  const inspection = await inspectCampaignReference(rootDirectory);
  if (inspection.status !== "recoverable") {
    throw new Error(inspection.status === "absent" ? "No existe referencia para recuperar" :
      inspection.status === "valid" ? "La referencia ya es válida; no necesita recuperación" : inspection.reason);
  }
  const { active, backup, staging, lock } = paths(rootDirectory);
  const release = await acquireLock(lock);
  try {
    await recoverTransaction(active, backup, staging);
    const recovered = await readReferenceDirectory(active);
    return recovered.manifest;
  } finally { await release(); }
};

const promoteReference = async (active: string, backup: string, staging: string, runId: string): Promise<void> => {
  const hadPrevious = await directoryExists(active);
  let movedPrevious = false;
  let promoted = false;
  try {
    if (hadPrevious) {
      await rename(active, backup);
      movedPrevious = true;
    }
    await rename(staging, active);
    promoted = true;
    const verified = await readReferenceDirectory(active);
    if (verified.manifest.runId !== runId) throw new Error("La referencia promovida no pertenece al lote previsto");
    if (movedPrevious) await rm(backup, { recursive: true });
  } catch (error) {
    if (movedPrevious && await directoryExists(backup)) {
      if (promoted) await rm(active, { recursive: true });
      await rename(backup, active);
    } else if (!hadPrevious && promoted) {
      await rm(active, { recursive: true });
    }
    throw error;
  }
};

export const importCampaignReference = async (
  rootDirectory: string, directory: string, replaceExisting = false
): Promise<ReferenceManifest> => {
  const source = independentDirectory(rootDirectory, directory);
  if (!(await directoryExists(source))) throw new Error("No existe la carpeta de referencia a importar");
  const imported = await readReferenceDirectory(source);
  const { parent, active, backup, staging, lock } = paths(rootDirectory);
  await mkdir(parent, { recursive: true });
  const release = await acquireLock(lock);
  try {
    await recoverTransaction(active, backup, staging);
    if (await directoryExists(active) && !replaceExisting) {
      throw new Error("La referencia ya existe: --sustituir es obligatorio para reemplazarla");
    }
    await mkdir(staging);
    for (const filename of referenceFiles) await copyFile(join(source, filename), join(staging, filename));
    const verified = await readReferenceDirectory(staging);
    if (verified.manifest.runId !== imported.manifest.runId) {
      throw new Error("La referencia de origen cambió durante la importación");
    }
    await promoteReference(active, backup, staging, verified.manifest.runId);
    return verified.manifest;
  } finally {
    try { await rm(staging, { recursive: true, force: true }); }
    finally { await release(); }
  }
};

export const writeCampaignReference = async (
  rootDirectory: string,
  runId: string,
  catalogs: readonly ReferenceCatalogSource[],
  report: ReferenceComparison,
  verifyBeforeCommit: () => Promise<void>,
  updatedAt: Date = new Date()
): Promise<ReferenceManifest> => {
  const { parent, active, backup, staging, lock } = paths(rootDirectory);
  if (!runId.trim() || report.currentRunId !== runId || !Number.isFinite(updatedAt.getTime()) ||
    catalogs.length !== CAMPAIGN_PROVIDERS.length || new Set(catalogs.map((entry) => entry.providerId)).size !== catalogs.length ||
    CAMPAIGN_PROVIDERS.some((id) => !catalogs.some((entry) => entry.providerId === id))) {
    throw new Error("Datos de referencia candidata inválidos");
  }
  await mkdir(parent, { recursive: true });
  const release = await acquireLock(lock);
  try {
    await recoverTransaction(active, backup, staging);
    const previous = await readCampaignReference(rootDirectory);
    if (report.previousRunId !== (previous?.manifest.runId ?? null) ||
      report.baseline !== (previous ? "previous" : "initial")) {
      throw new Error("La referencia cambió desde la comparación; se necesita comparar de nuevo");
    }
    if (previous?.manifest.runId === runId) throw new Error("Este lote ya es la referencia vigente");
    const differences = JSON.stringify(report, null, 2);
    const manifest: ReferenceManifest = {
      version: 1, runId, createdAt: updatedAt.toISOString(),
      catalogs: CAMPAIGN_PROVIDERS.map((providerId) => {
        const source = catalogs.find((entry) => entry.providerId === providerId);
        if (!source) throw new Error(`Falta el catálogo de ${providerId}`);
        return { providerId, prefix: source.catalog.prefix, scope: source.catalog.scope,
          productCount: source.catalog.productCount, sha256: digest(source.raw) };
      }), differencesSha256: digest(differences)
    };
    await mkdir(staging);
    for (const providerId of CAMPAIGN_PROVIDERS) {
      const source = catalogs.find((entry) => entry.providerId === providerId);
      if (!source) throw new Error(`Falta el catálogo de ${providerId}`);
      await writeFile(join(staging, `${providerId}.json`), source.raw, { flag: "wx" });
    }
    await writeFile(join(staging, "diferencias.json"), differences, { flag: "wx" });
    await writeFile(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2), { flag: "wx" });
    await readReferenceDirectory(staging);
    await verifyBeforeCommit();
    await promoteReference(active, backup, staging, runId);
    return manifest;
  } finally {
    try { await rm(staging, { recursive: true, force: true }); }
    finally { await release(); }
  }
};
