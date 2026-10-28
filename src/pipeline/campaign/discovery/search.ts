import { createHash } from "node:crypto";
import { CAMPAIGN_PROVIDERS, isReferenceProviderSet } from "../../../contracts/campaign-providers.js";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { readAppliedIntervention } from "../../../infrastructure/filesystem/interventions/intervention-derived.js";
import { readOfflinePreparation } from "../../../infrastructure/filesystem/preparation/offline-preparation.js";
import type { OfflinePreparation } from "../../../catalog/preparation/offline-document.js";
import type { CanonicalCatalog } from "../../../catalog/canonical-catalog.js";
import type { BatchReport, ProviderRun } from "../../../contracts/batch-report.js";

export type Artifact = { readonly path: string; readonly sha256: string };
export type Preparation = Artifact & { readonly preparedAt: string; readonly intervened: boolean };

export type ProviderDiscovery = {
  readonly providerId: string;
  readonly state: "not-started" | "failed" | "invalid" | "catalog" | "prepared";
  readonly catalog?: Artifact;
  readonly preparation?: Preparation;
  readonly message?: string;
};

export type CampaignDiscovery = {
  readonly requestedProviders: readonly string[];
  readonly runId: string | null;
  readonly runFile: string | null;
  readonly status: BatchReport["status"] | "none";
  readonly providers: readonly ProviderDiscovery[];
  readonly issues: readonly string[];
};

import { readCampaignBatch, isRecord } from "./report.js";
import { directories, inspectProvider } from "./preparations.js";

export type CampaignRun = { readonly report: BatchReport; readonly path: string };

export const listCampaignRuns = async (rootDirectory: string, skipRunId?: string): Promise<readonly CampaignRun[]> => {
  const root = resolve(rootDirectory);
  const reports: CampaignRun[] = [];
  const invalid: string[] = [];
  for (const dir of await directories(join(root, "storage", "runs"))) {
    if (skipRunId !== undefined && basename(dir) === skipRunId) continue;
    const path = join(dir, "run.json");
    try {
      const report = await readCampaignBatch(path);
      if (!isReferenceProviderSet(report.requestedProviders)) continue;
      const campaignRoots = new Set(report.providers.map((provider) => {
        const output = resolve(root, provider.outputDir);
        const directory = dirname(output);
        const isolated = dirname(directory) === join(root, "storage", "scraped", "campaigns") &&
          /^[a-zA-Z0-9_-]+$/.test(basename(directory));
        if (!((isolated && output === join(directory, provider.providerId)) ||
          output === join(root, "storage", "scraped", provider.providerId))) {
          throw new Error(`Ruta de salida ajena a la campaña: ${output}`);
        }
        return isolated ? directory : join(root, "storage", "scraped");
      }));
      if (campaignRoots.size > 1) throw new Error("Las salidas no pertenecen al mismo lote");
      reports.push({ report, path });
    } catch (error) {
      invalid.push(`No se puede acreditar el lote en ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (invalid.length) throw new Error(invalid.join("; "));
  reports.sort((left, right) => Date.parse(right.report.startedAt) - Date.parse(left.report.startedAt));
  if (reports.some((item, index) => index > 0 && item.report.startedAt === reports[index - 1]?.report.startedAt)) {
    throw new Error("Varios lotes tienen el mismo inicio; se necesita identificar expresamente la campaña");
  }
  return reports;
};

export const discoverCampaign = async (rootDirectory: string, runId?: string, skipRunId?: string): Promise<CampaignDiscovery> => {
  const root = resolve(rootDirectory);
  let reports: readonly CampaignRun[];
  try { reports = await listCampaignRuns(root, skipRunId); }
  catch (error) {
    if (runId) throw error;
    return { runId: null, runFile: null, status: "none", requestedProviders: [],
      issues: [error instanceof Error ? error.message : String(error)],
      providers: CAMPAIGN_PROVIDERS.map((providerId) => ({ providerId, state: "not-started" })) };
  }
  const current = runId === undefined ? reports[0] : reports.find((item) => item.report.runId === runId);
  if (runId && !current) throw new Error(`No existe una campaña global con runId ${runId}`);
  if (!current) {
    const orphaned: string[] = [];
    for (const providerId of CAMPAIGN_PROVIDERS) {
      for (const directory of [join(root, "storage", "scraped", providerId)]) {
        try {
          for (const entry of await readdir(directory, { withFileTypes: true })) {
            if (entry.isFile() && entry.name.endsWith("-catalog.json")) orphaned.push(join(directory, entry.name));
          }
        } catch (error) { if (!isRecord(error) || error.code !== "ENOENT") throw error; }
      }
    }
    return { runId: null, runFile: null, status: "none", requestedProviders: [],
      issues: orphaned.length ? ["Catálogos heredados sin run.json; no utilizar como nueva campaña: " + orphaned.join(", ")] : [],
      providers: CAMPAIGN_PROVIDERS.map((providerId) => ({ providerId, state: "not-started" })) };
  }
  const required = current.report.requestedProviders;
  const results = await Promise.all(required.map((id) => inspectProvider(root, current.report, id, runId === undefined)));
  const issues = results.flatMap((result) => result.issues);
  if (current.report.status !== "complete") issues.unshift(`Lote ${current.report.status}; no es seleccionable`);
  if (!isReferenceProviderSet(required) || current.report.status === "complete" &&
    current.report.providers.length !== required.length) issues.unshift("Conjunto de proveedores de campaña inválido");
  return { runId: current.report.runId, runFile: current.path, status: current.report.status,
    requestedProviders: required, providers: results.map((result) => result.provider), issues };
};
