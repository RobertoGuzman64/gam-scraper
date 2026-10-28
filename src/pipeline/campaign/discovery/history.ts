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

import { readCampaignBatch } from "./report.js";
import { directories } from "./preparations.js";
import type { CampaignCatalogObservation } from "../../../contracts/campaign-observation.js";
export type { CampaignCatalogObservation } from "../../../contracts/campaign-observation.js";

export const discoverCampaignCatalogHistory = async (
  rootDirectory: string, providerId: string
): Promise<readonly CampaignCatalogObservation[]> => {
  if (!CAMPAIGN_PROVIDERS.some((id) => id === providerId)) throw new Error(`Proveedor no admitido: ${providerId}`);
  const root = resolve(rootDirectory);
  const reports = await Promise.all((await directories(join(root, "storage", "runs"))).map(async (directory) => {
    const report = await readCampaignBatch(join(directory, "run.json"));
    return report;
  }));
  reports.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  if (reports.length > 1 && reports[0]?.startedAt === reports[1]?.startedAt) {
    throw new Error("Existen campañas con el mismo inicio; no se puede establecer la secuencia de mantenimiento");
  }
  const observations: CampaignCatalogObservation[] = [];
  for (const report of reports.slice(0, 5)) {
    const provider = report.providers.find((entry) => entry.providerId === providerId);
    if (report.status !== "complete" || !isReferenceProviderSet(report.requestedProviders) || !provider ||
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
