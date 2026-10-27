import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { initializeWorkspace } from "../../infrastructure/filesystem/workspace.js";
import { runBatch } from "../batch/run.js";
import type { BatchObserver, BatchResult } from "../batch/run.js";
import { discoverCampaign, CAMPAIGN_PROVIDERS } from "./discovery.js";
import { inspectBeforeExtraction } from "./preflight.js";

export const extractCampaign = async (
  rootDirectory: string, scriptFile: string, newCampaign: boolean, observer?: BatchObserver
): Promise<BatchResult> => {
  const root = resolve(rootDirectory);
  const inspection = await inspectBeforeExtraction(root);
  if (inspection.campaign.runId === null && inspection.campaign.issues.some((issue) =>
    issue.startsWith("No se puede acreditar el lote") || issue.startsWith("Varios lotes"))) {
    throw new Error("El historial contiene run.json inválidos o ambiguos. Corregir ese bloqueo antes de extraer; --nueva no lo oculta");
  }
  if (inspection.requiresNewCampaign && !newCampaign) {
    throw new Error("La campaña anterior está incompleta o tiene advertencias. Consulta npm run iniciar; si quieres comenzar un lote aislado utiliza --nueva");
  }
  await initializeWorkspace(root);
  const separateRoot = join(root, "storage", "scraped", "campaigns", randomUUID());
  const result = await runBatch({
    providerIds: CAMPAIGN_PROVIDERS, outRoot: separateRoot,
    historyDir: join(root, "storage", "runs"), dryRun: false
  }, scriptFile, observer);
  if (result.report.status !== "complete") return result;
  const discovery = await discoverCampaign(root);
  if (discovery.runId !== result.report.runId || discovery.status !== "complete" ||
    discovery.issues.length !== 0 || discovery.providers.some((provider) => !provider.catalog)) {
    throw new Error(`La extracción terminó, pero sus archivos no son verificables; conservar el lote ${result.report.runId} para diagnóstico`);
  }
  return result;
};
