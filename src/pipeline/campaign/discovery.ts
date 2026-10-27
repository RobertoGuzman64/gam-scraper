import { createHash } from "node:crypto";
import { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/canonical-catalog.js";
import { readAppliedIntervention } from "../../infrastructure/filesystem/intervention-derived.js";
import { readOfflinePreparation } from "../../infrastructure/filesystem/offline-preparation.js";
import type { OfflinePreparation } from "../../catalog/import/preparation/offline-document.js";
import type { CanonicalCatalog } from "../../catalog/canonical-catalog.js";
import type { BatchReport, ProviderRun } from "../batch/report-types.js";

export { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";

type Artifact = { readonly path: string; readonly sha256: string };
type Preparation = Artifact & { readonly preparedAt: string; readonly intervened: boolean };

export type ProviderDiscovery = {
  readonly providerId: string;
  readonly state: "not-started" | "failed" | "invalid" | "catalog" | "prepared";
  readonly catalog?: Artifact;
  readonly preparation?: Preparation;
  readonly message?: string;
};

export type CampaignDiscovery = {
  readonly runId: string | null;
  readonly runFile: string | null;
  readonly status: BatchReport["status"] | "none";
  readonly providers: readonly ProviderDiscovery[];
  readonly issues: readonly string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const isBatchStatus = (value: unknown): value is BatchReport["status"] =>
  value === "running" || value === "complete" || value === "partial" || value === "failed";

const isCampaignProvider = (value: unknown): value is typeof CAMPAIGN_PROVIDERS[number] =>
  typeof value === "string" && CAMPAIGN_PROVIDERS.some((id) => id === value);

const isProviderRun = (value: unknown): value is ProviderRun =>
  isRecord(value) && typeof value.providerId === "string" &&
  (value.status === "complete" || value.status === "failed") &&
  validDate(value.startedAt) && validDate(value.endedAt) &&
  Date.parse(value.endedAt) >= Date.parse(value.startedAt) &&
  typeof value.outputDir === "string" && value.outputDir.length > 0 &&
  typeof value.outputPrefix === "string" && /^[a-zA-Z0-9_-]+$/.test(value.outputPrefix);

const readBatch = async (file: string): Promise<BatchReport> => {
  const raw: unknown = JSON.parse(await readFile(file, "utf8"));
  if (!isRecord(raw) || raw.version !== 1 || typeof raw.runId !== "string" ||
    raw.runId !== basename(dirname(file)) || !validDate(raw.startedAt) ||
    (raw.endedAt !== null && !validDate(raw.endedAt)) || !isBatchStatus(raw.status) ||
    !Array.isArray(raw.requestedProviders) || !Array.isArray(raw.providers)) {
    throw new Error(`run.json incoherente: ${file}`);
  }
  const requested: unknown[] = raw.requestedProviders;
  const supplied: unknown[] = raw.providers;
  if (!requested.every(isCampaignProvider) || requested.length === 0 ||
    new Set(requested).size !== requested.length || !supplied.every(isProviderRun)) {
    throw new Error(`run.json con proveedores inválidos: ${file}`);
  }
  const providers: ProviderRun[] = supplied.filter(isProviderRun);
  const startedAt = raw.startedAt;
  const endedAt = raw.endedAt;
  if (new Set(providers.map((provider) => provider.providerId)).size !== providers.length ||
    (raw.status === "running" ? raw.endedAt !== null : raw.endedAt === null) ||
    providers.some((provider) => !requested.some((id) => id === provider.providerId) ||
      Date.parse(provider.startedAt) < Date.parse(startedAt) ||
      (endedAt !== null && Date.parse(provider.endedAt) > Date.parse(endedAt))) ||
    (raw.status === "complete" && (providers.length !== requested.length ||
      providers.some((provider) => provider.status !== "complete")))) {
    throw new Error(`run.json incoherente: ${file}`);
  }
  return {
    version: 1, runId: raw.runId, startedAt: raw.startedAt, endedAt: raw.endedAt,
    status: raw.status, requestedProviders: requested.filter(isCampaignProvider), providers
  };
};

const directories = async (path: string): Promise<readonly string[]> => {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(path, entry.name));
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return [];
    throw error;
  }
};

const filesInCampaign = async (path: string, depth: number): Promise<readonly string[]> => {
  if (depth === 0) return [];
  const files: string[] = [];
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return [];
    throw error;
  }
  for (const entry of entries) {
    const file = join(path, entry.name);
    if (entry.isFile() && entry.name.endsWith("-preparation.json")) files.push(file);
    else if (entry.isDirectory()) files.push(...await filesInCampaign(file, depth - 1));
  }
  return files;
};

const preparationPaths = async (root: string, providerId: string): Promise<readonly string[]> => {
  const paths = [join(root, "storage", "prepared", providerId)];
  for (const campaignDir of await directories(join(root, "storage", "interventions"))) {
    for (const resultDir of await directories(join(campaignDir, "results"))) {
      if (/^[a-f0-9]{64}$/.test(basename(resultDir))) paths.push(join(resultDir, "prepared"));
    }
  }
  const files: string[] = [];
  for (const path of paths) {
    try {
      for (const entry of await readdir(path, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith("-preparation.json")) files.push(join(path, entry.name));
      }
    } catch (error) {
      if (isRecord(error) && error.code === "ENOENT") continue;
      throw error;
    }
  }
  files.push(...await filesInCampaign(join(root, "storage", "campaigns"), 5));
  return files;
};

const selectPreparation = async (
  root: string, run: ProviderRun, original: Artifact, scope: string, productCount: number
): Promise<{ preparation?: Preparation; issues: readonly string[] }> => {
  const paths = await preparationPaths(root, run.providerId);
  const candidates: Preparation[] = [];
  const issues: string[] = [];
  for (const path of paths) {
    if (!basename(path).startsWith(run.outputPrefix)) {
      if (basename(dirname(path)) !== "prepared") continue;
      const filename = basename(path);
      const named = CAMPAIGN_PROVIDERS.find((id) => filename.startsWith(`${id}-intervention-preparation.json`));
      if (named && named !== run.providerId) continue;
      if (!named && filename === "intervention-preparation.json") {
        try {
          const raw: unknown = JSON.parse(await readFile(path, "utf8"));
          if (isRecord(raw) && isRecord(raw.source) && isCampaignProvider(raw.source.providerId) &&
            raw.source.providerId !== run.providerId) continue;
        } catch {
          issues.push(`Preparación no verificable (${path}): contenido ilegible`);
          continue;
        }
      }
    }
    let preparation: OfflinePreparation;
    try {
      preparation = await readOfflinePreparation(path, run.providerId);
    } catch (error) {
      issues.push(`Preparación no verificable (${path}): ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (preparation.source.prefix !== run.outputPrefix || preparation.source.scope !== scope ||
      preparation.source.productCount !== productCount) continue;
    const intervention = preparation.source.intervention;
    if (intervention ? intervention.sourceCatalogSha256 !== original.sha256 :
      preparation.source.catalogSha256 !== original.sha256) continue;
    if (intervention) {
      try {
        const verified = await readAppliedIntervention(join(dirname(dirname(path)), "catalog-derived.json"), original.path);
        if (verified.catalogSha256 !== preparation.source.catalogSha256 ||
          verified.provenance.campaign !== intervention.campaign ||
          verified.provenance.planSha256 !== intervention.planSha256 ||
          verified.provenance.derivedCatalogSha256 !== intervention.derivedCatalogSha256) {
          throw new Error("La procedencia del derivado no coincide");
        }
      } catch (error) {
        issues.push(`Intervención no verificable (${path}): ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
    }
    candidates.push({
      path, sha256: createHash("sha256").update(await readFile(path)).digest("hex"),
      preparedAt: preparation.preparedAt, intervened: intervention !== undefined
    });
  }
  candidates.sort((left, right) => Date.parse(right.preparedAt) - Date.parse(left.preparedAt));
  if (candidates.length > 1 && candidates[0]?.preparedAt === candidates[1]?.preparedAt &&
    candidates[0]?.sha256 !== candidates[1]?.sha256) {
    issues.push(`Varias preparaciones vigentes con la misma fecha para ${run.providerId}; requiere revisión`);
    return { issues };
  }
  const preparation = candidates[0];
  return { ...(preparation ? { preparation } : {}), issues };
};

const inspectProvider = async (
  root: string, report: BatchReport, providerId: string
): Promise<{ provider: ProviderDiscovery; issues: readonly string[] }> => {
  const run = report.providers.find((entry) => entry.providerId === providerId);
  if (!run) return {
    provider: { providerId, state: "not-started", message: "Sin extracción en este lote" }, issues: []
  };
  if (run.status === "failed") return {
    provider: { providerId, state: "failed", message: run.error ?? "Extracción fallida" }, issues: []
  };
  const path = resolve(root, run.outputDir, `${run.outputPrefix}-catalog.json`);
  try {
    const catalog = await readCanonicalCatalog(path);
    if (catalog.providerId !== providerId || catalog.prefix !== run.outputPrefix ||
      Date.parse(catalog.startedAt) < Date.parse(run.startedAt) ||
      Date.parse(catalog.endedAt) > Date.parse(run.endedAt)) {
      throw new Error("El catálogo no pertenece a la ejecución indicada en run.json");
    }
    const original = { path, sha256: createHash("sha256").update(await readFile(path)).digest("hex") };
    const result = await selectPreparation(root, run, original, catalog.scope, catalog.productCount);
    return {
      provider: { providerId, state: result.preparation ? "prepared" : "catalog", catalog: original,
        ...(result.preparation ? { preparation: result.preparation } : {}) },
      issues: result.issues
    };
  } catch (error) {
    return {
      provider: { providerId, state: "invalid", message: error instanceof Error ? error.message : String(error) },
      issues: []
    };
  }
};

export const discoverCampaign = async (rootDirectory: string): Promise<CampaignDiscovery> => {
  const root = resolve(rootDirectory);
  const runDirs = await directories(join(root, "storage", "runs"));
  const reports: { report: BatchReport; path: string }[] = [];
  const invalid: string[] = [];
  for (const dir of runDirs) {
    const path = join(dir, "run.json");
    try {
      reports.push({ report: await readBatch(path), path });
    } catch (error) {
      invalid.push(`No se puede acreditar el lote en ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (invalid.length > 0) return {
    runId: null, runFile: null, status: "none", issues: invalid,
    providers: CAMPAIGN_PROVIDERS.map((providerId) => ({ providerId, state: "not-started" }))
  };
  reports.sort((left, right) => Date.parse(right.report.startedAt) - Date.parse(left.report.startedAt));
  const current = reports[0];
  if (!current) {
    const orphaned: string[] = [];
    for (const providerId of CAMPAIGN_PROVIDERS) {
      const path = join(root, "storage", "scraped", providerId);
      try {
        for (const entry of await readdir(path, { withFileTypes: true })) {
          if (entry.isFile() && entry.name.endsWith("-catalog.json")) orphaned.push(join(path, entry.name));
        }
      } catch (error) {
        if (!isRecord(error) || error.code !== "ENOENT") throw error;
      }
    }
    return {
      runId: null, runFile: null, status: "none",
      issues: orphaned.length ? ["Catálogos heredados sin run.json; no deben utilizarse en una campaña nueva: " + orphaned.join(", ")] : [],
      providers: CAMPAIGN_PROVIDERS.map((providerId) => ({ providerId, state: "not-started" }))
    };
  }
  if (reports[1]?.report.startedAt === current.report.startedAt) return {
    runId: null, runFile: null, status: "none",
    issues: ["Varios lotes tienen el mismo inicio; se necesita identificar expresamente la campaña"],
    providers: CAMPAIGN_PROVIDERS.map((providerId) => ({ providerId, state: "not-started" }))
  };
  const results = await Promise.all(CAMPAIGN_PROVIDERS.map((id) => inspectProvider(root, current.report, id)));
  const issues = results.flatMap((result) => result.issues);
  if (current.report.status !== "complete") issues.unshift(`Lote ${current.report.status}; no es seleccionable`);
  if (current.report.status === "complete" && (
    current.report.requestedProviders.length !== CAMPAIGN_PROVIDERS.length ||
    CAMPAIGN_PROVIDERS.some((id) => !current.report.requestedProviders.includes(id))
  )) issues.unshift("Lote completado parcialmente por proveedores; requiere todos los proveedores para acreditar");
  return { runId: current.report.runId, runFile: current.path, status: current.report.status,
    providers: results.map((result) => result.provider), issues };
};

export type CampaignCatalogObservation = {
  readonly runId: string;
  readonly catalog: CanonicalCatalog | null;
  readonly reason?: string;
};

export const discoverCampaignCatalogHistory = async (
  rootDirectory: string, providerId: string
): Promise<readonly CampaignCatalogObservation[]> => {
  if (!CAMPAIGN_PROVIDERS.some((id) => id === providerId)) throw new Error(`Proveedor no admitido: ${providerId}`);
  const root = resolve(rootDirectory);
  const reports = await Promise.all((await directories(join(root, "storage", "runs"))).map(async (directory) => {
    const report = await readBatch(join(directory, "run.json"));
    return report;
  }));
  reports.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  if (reports.length > 1 && reports[0]?.startedAt === reports[1]?.startedAt) {
    throw new Error("Existen campañas con el mismo inicio; no se puede establecer la secuencia de mantenimiento");
  }
  const observations: CampaignCatalogObservation[] = [];
  for (const report of reports.slice(0, 5)) {
    const provider = report.providers.find((entry) => entry.providerId === providerId);
    if (report.status !== "complete" || report.requestedProviders.length !== CAMPAIGN_PROVIDERS.length ||
      CAMPAIGN_PROVIDERS.some((id) => !report.requestedProviders.includes(id)) || !provider ||
      provider.status !== "complete") {
      observations.push({ runId: report.runId, catalog: null, reason: "Campaña no completada por todos los proveedores" });
      continue;
    }
    try {
      const path = resolve(root, provider.outputDir, `${provider.outputPrefix}-catalog.json`);
      const catalog = await readCanonicalCatalog(path);
      if (catalog.providerId !== providerId || catalog.prefix !== provider.outputPrefix ||
        Date.parse(catalog.startedAt) < Date.parse(provider.startedAt) ||
        Date.parse(catalog.endedAt) > Date.parse(provider.endedAt)) {
        throw new Error("Origen no vinculado a la ejecución registrada");
      }
      observations.push({ runId: report.runId, catalog });
    } catch {
      observations.push({ runId: report.runId, catalog: null, reason: "Catálogo original no disponible o no verificable" });
    }
  }
  return observations;
};
