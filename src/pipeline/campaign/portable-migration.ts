import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { consolidatePortableCampaign, readPortableCampaign } from "../../infrastructure/filesystem/catalog/portable-campaign.js";
import { consolidatePortableOriginal, readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { discoverCampaign, listCampaignRuns } from "./discovery/search.js";
import { verifyDeliveredCampaign } from "./delivery/verification.js";
import { finalizeActiveCampaign } from "./finalization.js";
import type { PublishableSelection } from "../../catalog/editorial/select-publishable.js";

export type MigrationProvider = {
  readonly providerId: string;
  readonly status: "consolidar" | "actualizado" | "solo-portatil" | "parcial" | "ausente";
  readonly count: number | null;
  readonly source: string | null;
};

export type MigrationCampaign = {
  readonly runId: string;
  readonly status: "consolidar" | "actualizado";
  readonly zipStatus: "verified" | "absent" | null;
};

export type PortableMigrationPlan = {
  readonly providers: readonly MigrationProvider[];
  readonly campaigns: readonly MigrationCampaign[];
};

const missing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";
const hash = (input: string | Buffer): string => createHash("sha256").update(input).digest("hex");
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const kind = async (path: string): Promise<"file" | "directory" | "absent"> => {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) throw new Error(`Ruta simbólica no admitida en migración: ${path}`);
    if (stats.isFile()) return "file";
    if (stats.isDirectory()) return "directory";
    throw new Error(`Ruta especial no admitida en migración: ${path}`);
  } catch (error) {
    if (missing(error)) return "absent";
    throw error;
  }
};

const namesIn = async (path: string): Promise<readonly string[]> => {
  const type = await kind(path);
  if (type === "absent") return [];
  if (type !== "directory") throw new Error(`Se esperaba un directorio: ${path}`);
  return (await readdir(path)).sort();
};

const inspectPartial = async (dir: string, names: readonly string[]): Promise<boolean> => {
  const partials = names.filter((name) => name.endsWith("-partial-all.csv"));
  if (!partials.length) return names.some((name) => name.endsWith("-all.csv"));
  let usable = 0;
  for (const csv of partials) {
    const summary = join(dir, `${csv.slice(0, -"-partial-all.csv".length)}-summary.json`);
    if (await kind(summary) !== "file") throw new Error(`Parcial sin resumen: ${csv}`);
    const value: unknown = JSON.parse(await readFile(summary, "utf8"));
    if (!object(value) || !object(value.quality) || value.quality.published !== false ||
      !object(value.artifacts) || typeof value.artifacts.csvSha256 !== "string" ||
      value.artifacts.csvSha256 !== hash(await readFile(join(dir, csv))) || !object(value.totals)) {
      throw new Error(`Parcial no verificable: ${csv}`);
    }
    const count = value.totals.scrapedProducts;
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Parcial no verificable: ${csv}`);
    }
    if (value.quality.status === "blocked" && count === 0) continue;
    if (value.quality.status !== "partial" || count === 0) {
      throw new Error(`Parcial con estado incompatible: ${csv}`);
    }
    usable += 1;
    if (usable > 1) throw new Error(`Varios parciales incompatibles en ${dir}`);
  }
  return usable === 1;
};

const inspectCompleteSource = async (source: string): Promise<Awaited<ReturnType<typeof readCanonicalCatalog>>> => {
  const canonical = await readCanonicalCatalog(source);
  const summaryPath = source.slice(0, -"-catalog.json".length) + "-summary.json";
  const manifestPath = source.slice(0, -"-catalog.json".length) + "-catalog.manifest.json";
  if (await kind(summaryPath) !== "file" || await kind(manifestPath) !== "file") {
    throw new Error(`El canónico no conserva su trío de archivos regulares: ${source}`);
  }
  const summary: unknown = JSON.parse(await readFile(summaryPath, "utf8"));
  const actualHash = hash(await readFile(source, "utf8"));
  if (!object(summary) || !object(summary.quality) || summary.quality.status !== "complete" ||
    summary.quality.published !== true || summary.startedAt !== canonical.startedAt ||
    summary.endedAt !== canonical.endedAt || !object(summary.totals) ||
    summary.totals.scrapedProducts !== canonical.productCount || !object(summary.artifacts) ||
    summary.artifacts.catalogSha256 !== actualHash) {
    throw new Error(`El resumen físico no acredita el original completo: ${source}`);
  }
  return canonical;
};

const inspectProvider = async (root: string, providerId: string): Promise<MigrationProvider> => {
  const dir = join(root, "storage", "scraped", providerId);
  const names = await namesIn(dir);
  const catalogs = names.filter((name) => name.endsWith("-catalog.json"));
  if (catalogs.length > 1) throw new Error(`Varios canónicos en ${dir}: no se elige uno por intuición`);
  const target = join(root, "catalogs", "providers", providerId, "original");
  const hasPortable = await kind(target) !== "absent";
  const portable = hasPortable ? await readPortableOriginal(root, providerId) : null;
  // A pending swap or unknown file is an error, including when the current original is missing.
  const providerRoot = join(root, "catalogs", "providers", providerId);
  const targetNames = await namesIn(providerRoot);
  if (targetNames.some((name) => name !== "original") || (targetNames.length && !hasPortable)) {
    throw new Error(`Promoción pendiente o entrada desconocida en ${providerRoot}`);
  }
  if (!catalogs.length) {
    return { providerId, status: portable ? "solo-portatil" : (await inspectPartial(dir, names) ? "parcial" : "ausente"),
      source: null, count: portable?.productCount ?? null };
  }
  const source = join(dir, catalogs[0]!);
  if (await kind(source) !== "file") throw new Error(`Canónico no regular: ${source}`);
  const canonical = await inspectCompleteSource(source);
  if (canonical.providerId !== providerId) throw new Error(`Canónico de otro proveedor en ${source}`);
  if (portable) {
    const sourceContent = await readFile(source, "utf8");
    const stored = join(target, `${portable.prefix}-catalog.json`);
    if (hash(sourceContent) === hash(await readFile(stored, "utf8"))) {
      return { providerId, status: "actualizado", source, count: canonical.productCount };
    }
    const sourceDate = Date.parse(canonical.endedAt);
    const portableDate = Date.parse(portable.endedAt);
    if (sourceDate < portableDate) {
      return { providerId, status: "solo-portatil", source: null, count: portable.productCount };
    }
    if (sourceDate === portableDate) throw new Error(`Conflicto entre canónicos de la misma fecha: ${providerId}`);
  }
  // The promotion validator will also recheck the manifest and source before swapping.
  return { providerId, status: "consolidar", source, count: canonical.productCount };
};

const inspectCampaigns = async (root: string): Promise<readonly MigrationCampaign[]> => {
  const campaignDir = join(root, "catalogs", "campaigns");
  const existing = await namesIn(campaignDir);
  if (existing.length > 2) throw new Error("Hay más de dos campañas portátiles; no se migra hasta resolver su retención");
  for (const runId of existing) await readPortableCampaign(root, runId);
  const campaigns: MigrationCampaign[] = existing.map((runId) => ({ runId, status: "actualizado", zipStatus: null }));
  for (const { report } of await listCampaignRuns(root)) {
    if (report.status !== "complete" || report.requestedProviders.length !== CAMPAIGN_PROVIDERS.length ||
      !CAMPAIGN_PROVIDERS.every((provider) => report.requestedProviders.includes(provider))) continue;
    if (existing.includes(report.runId)) continue;
    const receipt = join(root, "storage", "campaigns", report.runId, "delivery.json");
    if (await kind(receipt) === "absent") continue;
    if (await kind(receipt) !== "file") throw new Error(`Justificante no regular: ${receipt}`);
    const verified = await verifyDeliveredCampaign(root, undefined, report.runId);
    if (verified.runId !== report.runId) throw new Error("Justificante de lote incongruente");
    campaigns.push({ runId: report.runId, status: "consolidar", zipStatus: verified.zipStatus === "verified" ? "verified" : "absent" });
  }
  if (campaigns.length > 2) throw new Error("La migración excedería dos campañas portátiles; no se descartan entregas automáticamente");
  return campaigns;
};

/** Read-only preflight; validates every candidate before any promotion is attempted. */
export const planPortableMigration = async (workspace: string): Promise<PortableMigrationPlan> => {
  const root = resolve(workspace);
  const catalogsRoot = join(root, "catalogs");
  const entries = await namesIn(catalogsRoot);
  if (entries.some((name) => name !== "providers" && name !== "campaigns")) {
    throw new Error("catalogs/ contiene archivos o carpetas ajenos al contrato");
  }
  const providerEntries = await namesIn(join(catalogsRoot, "providers"));
  if (providerEntries.some((name) => !CAMPAIGN_PROVIDERS.some((id) => id === name))) {
    throw new Error("catalogs/providers contiene proveedores desconocidos");
  }
  const providers = [];
  for (const id of CAMPAIGN_PROVIDERS) providers.push(await inspectProvider(root, id));
  const campaigns = await inspectCampaigns(root);
  return { providers, campaigns };
};

const restoreCampaign = async (root: string, runId: string, selection: PublishableSelection,
  draftFile: string): Promise<boolean> => {
  const discovered = await discoverCampaign(root, runId);
  if (discovered.status !== "complete" || discovered.issues.length ||
    discovered.providers.some((provider) => !provider.catalog || !provider.preparation)) {
    throw new Error(`No se puede recuperar la procedencia de ${runId}`);
  }
  return consolidatePortableCampaign({
    workspace: root, runId, selection, accreditationFile: draftFile,
    originals: discovered.providers.map((provider) => ({
      providerId: provider.providerId, path: provider.catalog!.path
    })),
    interventions: discovered.providers.flatMap((provider) => provider.preparation?.intervened ? [{
      providerId: provider.providerId,
      derivedFile: join(dirname(dirname(provider.preparation.path)), "catalog-derived.json")
    }] : [])
  });
};

/** Explicit migration. Never deletes storage, creates approvals or runs scrapers. */
export const applyPortableMigration = async (workspace: string): Promise<PortableMigrationPlan> => {
  const root = resolve(workspace);
  const planned = await planPortableMigration(root);
  // Preflight again on every selected campaign: no writes or editorial changes allowed here.
  const selectionDetails = [];
  for (const campaign of planned.campaigns.filter((item) => item.status === "consolidar")) {
    const simulation = await finalizeActiveCampaign(root, true, campaign.runId);
    if (simulation.status !== "simulation" || !simulation.selection) {
      throw new Error(`La campaña ${campaign.runId} carece de aprobación válida`);
    }
    selectionDetails.push({ runId: campaign.runId, selection: simulation.selection, draftFile: simulation.draftFile });
  }
  for (const provider of planned.providers) {
    if (provider.status === "consolidar" && provider.source) {
      await consolidatePortableOriginal(root, provider.source);
    }
  }
  for (const campaign of selectionDetails) {
    await restoreCampaign(root, campaign.runId, campaign.selection, campaign.draftFile);
  }
  // Reread all portability evidence after writing, so corruption is never reported as success.
  const verified = await planPortableMigration(root);
  if (verified.providers.some((item) => item.status === "consolidar") ||
    verified.campaigns.some((item) => item.status === "consolidar")) {
    throw new Error("Queda material acreditado pendiente de consolidación");
  }
  return verified;
};
