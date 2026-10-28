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

export { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const isBatchStatus = (value: unknown): value is BatchReport["status"] =>
  value === "running" || value === "complete" || value === "partial" || value === "failed";

export const isCampaignProvider = (value: unknown): value is typeof CAMPAIGN_PROVIDERS[number] =>
  typeof value === "string" && CAMPAIGN_PROVIDERS.some((id) => id === value);

const isProviderRun = (value: unknown): value is ProviderRun =>
  isRecord(value) && typeof value.providerId === "string" &&
  (value.status === "complete" || value.status === "failed") &&
  validDate(value.startedAt) && validDate(value.endedAt) &&
  Date.parse(value.endedAt) >= Date.parse(value.startedAt) &&
  typeof value.outputDir === "string" && value.outputDir.length > 0 &&
  typeof value.outputPrefix === "string" && /^[a-zA-Z0-9_-]+$/.test(value.outputPrefix);

export const readCampaignBatch = async (file: string): Promise<BatchReport> => {
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
