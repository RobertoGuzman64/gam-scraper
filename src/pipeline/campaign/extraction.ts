import { join, resolve } from "node:path";
import { consolidatePortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { initializeWorkspace } from "../../infrastructure/filesystem/workspace.js";
import { createBatchRunId, runBatch } from "../batch/run.js";
import type { BatchObserver, BatchResult } from "../batch/run.js";
import { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import { discoverCampaign } from "./discovery/search.js";
import { withCampaignAdmissionLock, prepareCampaignAdmission } from "./retention/admission.js";
import { resumePendingCampaignRemoval } from "./retention/recovery.js";
import { inspectBeforeExtraction } from "./preflight.js";

export const extractCampaign = async (
  rootDirectory: string, scriptFile: string, newCampaign: boolean, observer?: BatchObserver
): Promise<BatchResult> => {
  const root = resolve(rootDirectory);
  return withCampaignAdmissionLock(root, async () => {
    await resumePendingCampaignRemoval(root);
    const inspection = await inspectBeforeExtraction(root);
    if (inspection.campaign.runId === null && inspection.campaign.issues.length > 0) {
      throw new Error(`Historial ambiguo: ${inspection.campaign.issues.join("; ")}`);
    }
    await initializeWorkspace(root);
    await prepareCampaignAdmission(root, newCampaign);
    const runId = createBatchRunId();
    const separateRoot = join(root, "storage", "scraped", "campaigns", runId);
    const result = await runBatch({
      providerIds: CAMPAIGN_PROVIDERS, outRoot: separateRoot,
      historyDir: join(root, "storage", "runs"), dryRun: false
    }, scriptFile, observer, undefined, runId);
    if (result.report.status !== "complete") return result;
    const discovery = await discoverCampaign(root, result.report.runId);
    if (discovery.runId !== result.report.runId || discovery.status !== "complete" ||
      discovery.issues.length !== 0 || discovery.providers.some((provider) => !provider.catalog)) {
      throw new Error(`La extracción terminó, pero sus archivos no son verificables; conservar el lote ${result.report.runId} para diagnóstico`);
    }
    // All four originals must pass validation before any individual promotion.
    for (const provider of discovery.providers) {
      if (!provider.catalog) throw new Error("Falta un original de la campaña completa");
      await readCanonicalCatalog(provider.catalog.path);
    }
    for (const provider of discovery.providers) {
      if (!provider.catalog) throw new Error("Falta un original de la campaña completa");
      await consolidatePortableOriginal(root, provider.catalog.path);
    }
    return result;
  });
};
