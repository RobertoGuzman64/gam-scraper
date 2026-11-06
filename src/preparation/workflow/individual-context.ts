import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { OfflinePreparation, PreparationFingerprints } from "../offline-document.js";
import { buildOfflineDiagnostics } from "../offline-diagnostics.js";
import type { OfflineDiagnostics } from "../offline-diagnostics.js";
import { buildSourceTriage } from "../../catalog/diagnostics/source-triage.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import { LEGACY_CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import { resolveAccreditedPublication, readAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { readPortableOriginalArtifacts } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { validateCanonicalSource } from "./validation/offline.js";
import { readOfflinePreparation } from "../../infrastructure/filesystem/preparation/offline-preparation.js";
import { loadPreparationInputs } from "../../infrastructure/filesystem/preparation/preparation-inputs.js";
import { validateOfflinePreparation } from "./validation/offline.js";

export type IndividualCatalogProvider = typeof LEGACY_CAMPAIGN_PROVIDERS[number];

export type IndividualPreparationContext = {
  readonly providerId: IndividualCatalogProvider;
  readonly sourceFile: string;
  readonly catalogSha256: string;
  readonly sourceProducts: number;
  readonly sourcePrefix: string;
  readonly fingerprints: PreparationFingerprints;
  readonly preparedDirectory: string;
  readonly outputFile: string;
  readonly preparationFile: string | null;
  readonly preparation: OfflinePreparation | null;
  readonly activeFile: string | null;
  readonly activeProducts: readonly ImportCandidate[];
};

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const missing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const verifyPreparedDirectory = async (workspace: string, providerId: IndividualCatalogProvider): Promise<string> => {
  const root = resolve(workspace);
  const directory = join(root, "storage", "prepared", providerId);
  for (const path of [root, join(root, "storage"), join(root, "storage", "prepared"), directory]) {
    try {
      const stat = await lstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Directorio de preparación no regular: ${path}`);
    } catch (error) {
      if (missing(error)) continue;
      throw error;
    }
  }
  return directory;
};

const readExistingPreparations = async (
  directory: string, providerId: IndividualCatalogProvider,
  source: { readonly prefix: string; readonly scope: string; readonly sha: string; readonly count: number },
  fingerprints: PreparationFingerprints, sourceFile: string, sourceProducts: readonly ProductRecord[]
): Promise<{ readonly file: string; readonly preparation: OfflinePreparation } | null> => {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (missing(error)) return null; throw error; }
  const supported = ["-preparation.manifest.json", "-preparation.json", "-diagnostics.json", "-comparison.json"] as const;
  const groups = new Map<string, string[]>();
  for (const entry of entries) {
    const suffix = supported.find((value) => entry.name.endsWith(value));
    if (!entry.isFile() || entry.isSymbolicLink() || !suffix || !/^[a-zA-Z0-9_-]+$/.test(entry.name.slice(0, -suffix.length))) {
      throw new Error(`Preparación con miembro no reconocido o no regular: ${entry.name}`);
    }
    const key = entry.name.slice(0, -suffix.length);
    const group = groups.get(key) ?? [];
    group.push(entry.name);
    groups.set(key, group);
  }
  const matches: { file: string; preparation: OfflinePreparation }[] = [];
  for (const [key, names] of groups) {
    for (const suffix of ["-preparation.json", "-preparation.manifest.json", "-diagnostics.json"]) {
      if (!names.includes(`${key}${suffix}`)) throw new Error(`Conjunto incompleto de preparación: ${key}${suffix}`);
    }
    const path = join(directory, `${key}-preparation.json`);
    const preparation = await readOfflinePreparation(path, providerId);
    const diagnostics: unknown = JSON.parse(await readFile(join(directory, `${key}-diagnostics.json`), "utf8"));
    if (!record(diagnostics) || diagnostics.version !== 1 || diagnostics.providerId !== providerId ||
      !isDeepStrictEqual(diagnostics.source, preparation.source) ||
      !isDeepStrictEqual(diagnostics.fingerprints, preparation.fingerprints) ||
      !record(diagnostics.totals) || diagnostics.totals.ready !== preparation.totals.ready ||
      diagnostics.totals.review !== preparation.totals.review || diagnostics.totals.products !== preparation.products.length) {
      throw new Error(`Diagnóstico incoherente con la preparación: ${key}`);
    }
    if (names.includes(`${key}-comparison.json`)) {
      const comparison: unknown = JSON.parse(await readFile(join(directory, `${key}-comparison.json`), "utf8"));
      if (!record(comparison) || typeof comparison.comparable !== "boolean" ||
        !Array.isArray(comparison.reviewToReady) || !Array.isArray(comparison.readyToReview)) {
        throw new Error(`Comparación de preparación inválida: ${key}`);
      }
    }
    if (preparation.source.prefix === source.prefix && preparation.source.scope === source.scope &&
      preparation.source.catalogSha256 === source.sha && preparation.source.productCount === source.count &&
      preparation.source.intervention === undefined && isDeepStrictEqual(preparation.fingerprints, fingerprints)) {
      const expectedDiagnostics = {
        ...buildOfflineDiagnostics(preparation), sourceTriage: buildSourceTriage(preparation, sourceProducts)
      };
      if (!isDeepStrictEqual(diagnostics, expectedDiagnostics)) {
        throw new Error(`Diagnóstico incoherente con las incidencias de preparación: ${key}`);
      }
      matches.push({ file: path, preparation });
    }
  }
  if (matches.length > 1) throw new Error(`Preparaciones ambiguas para ${providerId}: ${matches.map((item) => basename(item.file)).join(", ")}`);
  const chosen = matches[0];
  if (!chosen) return null;
  await validateOfflinePreparation(providerId, chosen.file, sourceFile);
  return chosen;
};

export const resolveIndividualPreparationContext = async (
  workspace: string, providerId: IndividualCatalogProvider
): Promise<IndividualPreparationContext> => {
  const root = resolve(workspace);
  for (const lockFile of [
    join(root, "catalogs", ".active.lock"),
    join(root, "catalogs", "providers", providerId, "publications", ".active.lock"),
    join(root, "catalogs", "providers", providerId, "publications", ".publication.lock"),
    join(root, "storage", "prepared", `.retention-${providerId}.lock`)
  ]) {
    try {
      await lstat(lockFile);
      throw new Error(`Otra operación usa un bloqueo vigente: ${lockFile}. Comprobar la operación antes de continuar`);
    } catch (error) { if (!missing(error)) throw error; }
  }
  const { catalog } = await readPortableOriginalArtifacts(root, providerId);
  const sourceFile = join(root, "catalogs", "providers", providerId, "original", `scrape-${providerId}-catalog.json`);
  const catalogSha256 = digest(await readFile(sourceFile, "utf8"));
  const operationalFile = join(root, "storage", "scraped", providerId, `scrape-${providerId}-catalog.json`);
  try {
    const stat = await lstat(operationalFile);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Original operativo no regular: ${operationalFile}`);
    const operational = await validateCanonicalSource(operationalFile, providerId);
    if (operational.catalogSha256 !== catalogSha256) {
      throw new Error(`Original operativo distinto del portátil (${providerId}); acredita cuál es el canónico antes de preparar`);
    }
  } catch (error) {
    if (!missing(error)) throw error;
  }
  const { fingerprints } = await loadPreparationInputs();
  const preparedDirectory = await verifyPreparedDirectory(root, providerId);
  const existing = await readExistingPreparations(preparedDirectory, providerId, {
    prefix: catalog.prefix, scope: catalog.scope, sha: catalogSha256, count: catalog.productCount
  }, fingerprints, sourceFile, catalog.products);
  const generation = digest(JSON.stringify({ providerId, catalogSha256, fingerprints }));
  const outputFile = join(preparedDirectory, `scrape-${providerId}-${generation.slice(0, 24)}-preparation.json`);
  const activeFile = await resolveAccreditedPublication(root, providerId);
  const activeProducts = activeFile ? (await readAccreditedPublication(activeFile)).products : [];
  return {
    providerId, sourceFile, catalogSha256, sourceProducts: catalog.productCount, sourcePrefix: catalog.prefix,
    fingerprints, preparedDirectory, outputFile, preparationFile: existing?.file ?? null,
    preparation: existing?.preparation ?? null, activeFile, activeProducts
  };
};

export const requireIndividualPreparationContext = async (
  workspace: string, providerId: IndividualCatalogProvider
): Promise<IndividualPreparationContext & { readonly preparationFile: string; readonly preparation: OfflinePreparation }> => {
  const context = await resolveIndividualPreparationContext(workspace, providerId);
  if (!context.preparation || !context.preparationFile) {
    throw new Error(`Falta preparación actual de ${providerId}. Ejecuta npm run catalogo:preparar; no uses rutas de storage manuales`);
  }
  return { ...context, preparation: context.preparation, preparationFile: context.preparationFile };
};

export const ensureIndividualPreparationDirectory = async (
  workspace: string, providerId: IndividualCatalogProvider
): Promise<void> => {
  const root = resolve(workspace);
  const path = [join(root, "storage"), join(root, "storage", "prepared"), join(root, "storage", "prepared", providerId)];
  for (const directory of path) {
    try {
      const stat = await lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Directorio de preparación no regular: ${directory}`);
    } catch (error) {
      if (!missing(error)) throw error;
      try { await mkdir(directory); }
      catch (creationError) {
        if (!(creationError instanceof Error && "code" in creationError && creationError.code === "EEXIST")) throw creationError;
      }
      const stat = await lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Directorio de preparación no regular: ${directory}`);
    }
  }
};

export type IndividualPreparationSummary = {
  readonly providerId: IndividualCatalogProvider;
  readonly status: "reutilizada" | "generada" | "simulada";
  readonly sourceCount: number;
  readonly ready: number;
  readonly review: number;
  readonly incidences: number;
  readonly reviewReferences: readonly string[];
  readonly historicalExclusions: readonly string[];
  readonly activeAvailable: boolean;
  readonly possibleAdds: number;
  readonly possibleRemovals: number;
  readonly possibleChanges: number;
  readonly possibleSpecificationLosses: number;
  readonly reconciledSpecificationChanges: number;
  readonly preparationFile: string | null;
  readonly diagnostics: OfflineDiagnostics;
};
