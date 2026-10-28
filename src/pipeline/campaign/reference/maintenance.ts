import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { parseCanonicalCatalog } from "../../../catalog/canonical-catalog.js";
import { parseReferenceManifest } from "../../../catalog/reference/manifest.js";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import type { CanonicalCatalog } from "../../../catalog/canonical-catalog.js";
import type { ReferenceComparison } from "../../../catalog/reference/compare.js";
import type { ReferenceManifest } from "../../../catalog/reference/manifest.js";

import { digest, directoryExists, paths, referenceFiles, readReferenceDirectory, inspectCampaignReference, readCampaignReference, acquireLock, recoverTransaction, promoteReference } from "../../../infrastructure/filesystem/reference/store.js";
import type { ReferenceCatalogSource } from "../../../infrastructure/filesystem/reference/store.js";

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
    for (const filename of referenceFiles(inspection.reference.manifest.catalogs.map((entry) => entry.providerId))) {
      await copyFile(join(active, filename), join(destination, filename));
    }
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
    for (const filename of referenceFiles(imported.manifest.catalogs.map((entry) => entry.providerId))) {
      await copyFile(join(source, filename), join(staging, filename));
    }
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
    await writeFile(join(staging, "differences.json"), differences, { flag: "wx" });
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
