import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { buildProductIdentity } from "../catalog/identity.js";
import { isCampaignProvider } from "../contracts/campaign-providers.js";
import { readActiveTechnicalPublication, activateTechnicalPublication, readTechnicalVersion, technicalSnapshotSha256 } from "../infrastructure/filesystem/catalog/technical-publication.js";
import { readPortableOriginalArtifacts } from "../infrastructure/filesystem/catalog/portable-original.js";
import { offlinePreparationManifestPath } from "../infrastructure/filesystem/preparation/offline-preparation.js";
import { validateOfflinePreparation } from "../preparation/workflow/validation/offline.js";
import { buildManainRecord } from "../preparation/workflow/manain-record.js";
import { loadPreparationInputs } from "../infrastructure/filesystem/preparation/preparation-inputs.js";
import { parseTechnicalSnapshot, compareTechnicalSnapshots } from "./technical-snapshot.js";
import type { TechnicalDifference, TechnicalSnapshot } from "./technical-snapshot.js";
import { discardedManainProductUrls } from "../preparation/manain/identity/evidence/discarded-urls.js";
import { resolveAccreditedPublication, readAccreditedPublication } from "../infrastructure/filesystem/catalog/accredited-publication.js";

const digest = (raw: string): string => createHash("sha256").update(raw).digest("hex");
const regular = async (path: string): Promise<string> => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Evidencia técnica no regular: ${path}`);
  return readFile(path, "utf8");
};
const json = async (path: string): Promise<unknown> => JSON.parse(await regular(path)) as unknown;

export type TechnicalSourceOptions = {
  readonly preparation?: string;
  readonly csv?: string;
  readonly census?: string;
};

export type TechnicalPreview = {
  readonly snapshot: TechnicalSnapshot;
  readonly sha256: string;
  readonly difference: TechnicalDifference;
  readonly historicalSpecificationLosses: readonly string[];
  readonly historicalComparisonWarning: string | null;
};

const manainRecordPath = (root: string): string =>
  join(resolve(root), "catalogs", "providers", "manain", "records", "manain-record.json");

const completeCandidate = async (
  root: string, providerId: string, preparationFile: string
): Promise<TechnicalSnapshot> => {
  if (providerId === "manain") throw new Error("Manain requiere un registro parcial, no un original canónico ficticio");
  const artifacts = await readPortableOriginalArtifacts(root, providerId);
  const catalogFile = artifacts.files.find((item) => item.name.endsWith("-catalog.json"));
  if (!catalogFile) throw new Error(`Original portátil sin catálogo: ${providerId}`);
  const sourceFile = join(resolve(root), "catalogs", "providers", providerId,
    "original", catalogFile.name);
  await Promise.all([regular(resolve(preparationFile)), regular(offlinePreparationManifestPath(resolve(preparationFile)))]);
  const validation = await validateOfflinePreparation(providerId, preparationFile, sourceFile);
  const raw = await regular(resolve(preparationFile));
  const sourceSha = digest(catalogFile.content);
  if (validation.catalog.catalogSha256 !== sourceSha) throw new Error("Original portátil y preparación no coinciden");
  return parseTechnicalSnapshot({
    version: 1, providerId, quality: "complete",
    source: {
      kind: "canonical", catalogSha256: sourceSha, preparationSha256: digest(raw),
      rulesSha256: validation.preparation.fingerprints.rulesSha256,
      productCount: validation.preparation.products.length
    },
    totals: validation.preparation.totals,
    identities: validation.preparation.identities,
    products: validation.preparation.products
  }, providerId);
};

const partialCandidate = async (root: string, csvFile: string, censusFile: string): Promise<TechnicalSnapshot> => {
  const workspace = resolve(root);
  for (const folder of [workspace, join(workspace, "catalogs"), join(workspace, "catalogs", "providers"),
    join(workspace, "catalogs", "providers", "manain"),
    join(workspace, "catalogs", "providers", "manain", "records")]) {
    const info = await lstat(folder);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Directorio del registro Manain no regular: ${folder}`);
  }
  const source = resolve(csvFile);
  if (!source.endsWith("-partial-all.csv")) throw new Error("La evidencia Manain debe ser un -partial-all.csv");
  const [storedRaw, csv, summary, errors, census] = await Promise.all([
    regular(manainRecordPath(root)), regular(source),
    json(source.replace(/-partial-all\.csv$/, "-summary.json")),
    json(source.replace(/-partial-all\.csv$/, "-errors.json")), json(resolve(censusFile))
  ]);
  const verified = buildManainRecord(csv, summary, errors, census);
  const stored: unknown = JSON.parse(storedRaw);
  if (!isDeepStrictEqual(stored, verified) || !isDeepStrictEqual(verified.discardedUrls, discardedManainProductUrls)) {
    throw new Error("Registro parcial Manain distinto de la evidencia o de las reglas de preparación vigentes");
  }
  const identities = verified.products.map(({ original }) => buildProductIdentity(original).key);
  const { fingerprints } = await loadPreparationInputs();
  return parseTechnicalSnapshot({
    version: 1, providerId: "manain", quality: "partial",
    source: {
      kind: "manain-record", recordSha256: digest(storedRaw),
      sourceCsvSha256: verified.sourceCsvSha256, rulesSha256: fingerprints.rulesSha256,
      discoveredProductUrls: verified.discoveredProductUrls,
      discardedUrls: verified.discardedUrls
    },
    totals: verified.totals,
    identities,
    products: verified.products.map((item) => item.prepared)
  }, "manain");
};

export const buildTechnicalCandidate = async (
  root: string, providerId: string, options: TechnicalSourceOptions
): Promise<TechnicalSnapshot> => {
  if (!isCampaignProvider(providerId)) throw new Error(`Proveedor técnico no admitido: ${providerId}`);
  if (providerId === "manain") {
    if (!options.csv || !options.census || options.preparation) {
      throw new Error("Manain requiere --csv <partial-all.csv> --censo <censo.json>, sin --preparacion");
    }
    return partialCandidate(root, options.csv, options.census);
  }
  if (!options.preparation || options.csv || options.census) {
    throw new Error("El proveedor completo requiere --preparacion <preparation.json>");
  }
  return completeCandidate(root, providerId, options.preparation);
};

const historicLosses = async (root: string, snapshot: TechnicalSnapshot): Promise<{
  readonly losses: readonly string[]; readonly warning: string | null;
}> => {
  try {
  const file = await resolveAccreditedPublication(root, snapshot.providerId);
  if (!file) return { losses: [], warning: null };
  const historical = await readAccreditedPublication(file);
  const byIdentity = new Map(snapshot.identities.map((identity, index) => [identity, snapshot.products[index]]));
  const losses: string[] = [];
  for (const previous of historical.products) {
    const identity = buildProductIdentity({ providerId: previous.providerId,
      reference: previous.reference, serialNumber: null, url: previous.sourceUrl }).key;
    const current = byIdentity.get(identity);
    if (!current) continue;
    for (const field of Object.keys(previous.spec ?? {})) {
      if (!Object.hasOwn(current.product.spec ?? {}, field)) losses.push(`${identity}:${field}`);
    }
  }
  return { losses, warning: null };
  } catch (error) {
    return { losses: [], warning: error instanceof Error ? error.message : String(error) };
  }
};

export const previewTechnicalPublication = async (
  root: string, snapshot: TechnicalSnapshot
): Promise<TechnicalPreview> => {
  const candidate = parseTechnicalSnapshot(snapshot, snapshot.providerId);
  const active = await readActiveTechnicalPublication(root, candidate.providerId);
  const sha256 = technicalSnapshotSha256(candidate);
  const historical = await historicLosses(root, candidate);
  return {
    snapshot: candidate, sha256,
    difference: compareTechnicalSnapshots(candidate, sha256, active?.snapshot ?? null, active?.sha256 ?? null),
    historicalSpecificationLosses: historical.losses,
    historicalComparisonWarning: historical.warning
  };
};

export const publishTechnicalSnapshot = async (
  root: string, providerId: string, options: TechnicalSourceOptions, activate: boolean
): Promise<TechnicalPreview & { readonly status: "simulated" | "activated" | "unchanged" }> => {
  const candidate = await buildTechnicalCandidate(root, providerId, options);
  const preview = await previewTechnicalPublication(root, candidate);
  if (!activate) return { ...preview, status: "simulated" };
  const updated = await buildTechnicalCandidate(root, providerId, options);
  if (technicalSnapshotSha256(updated) !== preview.sha256) {
    throw new Error("La fuente o las reglas cambiaron durante la simulación técnica");
  }
  const outcome = await activateTechnicalPublication(root, updated, preview.difference.previous);
  if (outcome.sha256 !== preview.sha256) throw new Error("Versión técnica activada diferente de la simulada");
  return { ...preview, status: outcome.changed ? "activated" : "unchanged" };
};

export const compareWithTechnicalVersion = async (
  root: string, providerId: string, fingerprint: string
): Promise<TechnicalDifference> => {
  const previous = await readTechnicalVersion(root, providerId, fingerprint);
  const current = await readActiveTechnicalPublication(root, providerId);
  if (!current) throw new Error("No existe versión técnica vigente para comparar");
  return compareTechnicalSnapshots(current.snapshot, current.sha256, previous.snapshot, previous.sha256);
};
