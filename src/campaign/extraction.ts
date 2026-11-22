import { join, resolve } from "node:path";
import { consolidatePortableOriginal } from "../infrastructure/filesystem/catalog/portable-original.js";
import { readCanonicalCatalog } from "../infrastructure/filesystem/catalog/canonical-catalog.js";
import { initializeWorkspace } from "../infrastructure/filesystem/workspace.js";
import { createBatchRunId, runBatch } from "../scraping/batch/run.js";
import type { BatchObserver, BatchResult } from "../scraping/batch/run.js";
import { writeBatchReport } from "../scraping/batch/report.js";
import type { ProviderRun } from "../contracts/batch-report.js";
import { CAMPAIGN_PROVIDERS, LEGACY_CAMPAIGN_PROVIDERS } from "../contracts/campaign-providers.js";
import { discoverCampaign } from "./discovery/search.js";
import { withCampaignAdmissionLock, prepareCampaignAdmission } from "./retention/admission.js";
import { resumePendingCampaignRemoval } from "./retention/recovery.js";
import { inspectBeforeExtraction } from "./preflight.js";
import { readCampaignDocumentOrigin, writeManainCampaignDocument } from "./document-source.js";

export const extractCampaign = async (
  rootDirectory: string, scriptFile: string, newCampaign: boolean, observer?: BatchObserver
): Promise<BatchResult> => {
  const root = resolve(rootDirectory);
  return withCampaignAdmissionLock(root, async () => {
    const documentOrigin = await readCampaignDocumentOrigin(root);
    await resumePendingCampaignRemoval(root);
    const inspection = await inspectBeforeExtraction(root);
    if (inspection.campaign.runId === null && inspection.campaign.issues.length > 0) {
      throw new Error(`Historial ambiguo: ${inspection.campaign.issues.join("; ")}`);
    }
    await initializeWorkspace(root);
    await prepareCampaignAdmission(root, newCampaign);
    const runId = createBatchRunId();
    const separateRoot = join(root, "storage", "scraped", "campaigns", runId);
    const web = await runBatch({
      providerIds: LEGACY_CAMPAIGN_PROVIDERS, outRoot: separateRoot,
      historyDir: join(root, "storage", "runs"), dryRun: false
    }, scriptFile, observer, undefined, runId);
    await writeBatchReport(web.reportFile, {
      ...web.report, requestedProviders: [...CAMPAIGN_PROVIDERS],
      status: web.report.status === "complete" ? "partial" : web.report.status
    });
    let document: ProviderRun | null = null;
    if (web.report.status === "complete") {
      try {
        document = await writeManainCampaignDocument(root, runId, documentOrigin);
      } catch (error) {
        const endedAt = new Date().toISOString();
        document = {
          providerId: "manain", origin: documentOrigin, status: "failed",
          startedAt: web.report.startedAt, endedAt, durationMs: Date.parse(endedAt) - Date.parse(web.report.startedAt),
          outputDir: join(separateRoot, "manain"), outputPrefix: "manain-stocklist",
          logFile: join(root, "storage", "runs", runId, "manain-source.json"),
          summaryFile: join(separateRoot, "manain", "manain-stocklist-summary.json"),
          changesFile: join(separateRoot, "manain", "manain-stocklist-changes.json"),
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    const report = {
      ...web.report, requestedProviders: [...CAMPAIGN_PROVIDERS],
      providers: [...web.report.providers, ...(document === null ? [] : [document])],
      status: web.report.status === "complete" ? document?.status === "complete" ? "complete" as const : "partial" as const : web.report.status,
      endedAt: new Date().toISOString()
    };
    await writeBatchReport(web.reportFile, report);
    const result = { report, reportFile: web.reportFile };
    if (report.status !== "complete") return result;
    const discovery = await discoverCampaign(root, result.report.runId);
    if (discovery.runId !== result.report.runId || discovery.status !== "complete" ||
      discovery.issues.length !== 0 || discovery.providers.some((provider) => !provider.catalog)) {
      throw new Error(`La extracción terminó, pero sus archivos no son verificables; conservar el lote ${result.report.runId} para diagnóstico`);
    }
    for (const provider of discovery.providers) {
      if (!provider.catalog) throw new Error("Falta un original de la campaña completa");
      await readCanonicalCatalog(provider.catalog.path);
    }
    for (const provider of discovery.providers) {
      if (!provider.catalog) throw new Error("Falta un original de la campaña completa");
      if (provider.providerId !== "manain") await consolidatePortableOriginal(root, provider.catalog.path);
    }
    return result;
  });
};
