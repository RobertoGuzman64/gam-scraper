import { basename, join, resolve } from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";
import { readAppliedIntervention } from "../../infrastructure/filesystem/intervention-derived.js";
import { readInterventionSource } from "../../infrastructure/filesystem/intervention-source.js";
import { persistAppliedIntervention } from "../../infrastructure/filesystem/intervention-application.js";
import { validateOfflinePreparation } from "../validation/offline.js";
import { prepareSavedCatalog } from "../preparation/prepare.js";
import { interventionScriptCampaign, loadInterventionScript } from "../../manual-interventions/script-loader.js";
import { validateInterventionProposals } from "../../manual-interventions/proposals.js";
import { simulateIntervention } from "../../manual-interventions/simulation.js";
import { parseAppliedInterventionRecord } from "../../manual-interventions/record.js";
import type { InterventionSimulation } from "../../manual-interventions/simulation.js";
import { CAMPAIGN_PROVIDERS, discoverCampaign } from "./discovery.js";

export type CampaignInterventionResult = {
  readonly runId: string;
  readonly simulation: InterventionSimulation;
  readonly applied: boolean;
  readonly derivedFile?: string;
  readonly preparationFile?: string;
  readonly ready?: number;
  readonly review?: number;
};

export const interveneActiveCampaign = async (
  rootDirectory: string, providerId: string, scripts: readonly string[], apply: boolean,
  onSimulation?: (simulation: InterventionSimulation) => void
): Promise<CampaignInterventionResult> => {
  const root = resolve(rootDirectory);
  const campaign = await discoverCampaign(root);
  if (!campaign.runId || campaign.status !== "complete" || campaign.issues.length ||
    campaign.providers.some((provider) => !provider.catalog)) {
    throw new Error(`La campaña actual no está completa y verificada: ${campaign.issues.join("; ")}`);
  }
  if (!CAMPAIGN_PROVIDERS.some((id) => id === providerId)) throw new Error(`Proveedor no admitido: ${providerId}`);
  const provider = campaign.providers.find((entry) => entry.providerId === providerId);
  if (!provider?.catalog || provider.preparation?.intervened) {
    throw new Error(`El proveedor ${providerId} no tiene un origen libre de intervenciones; no se aplican scripts sobre un derivado existente`);
  }
  if (scripts.length === 0 || new Set(scripts.map((path) => resolve(root, path))).size !== scripts.length) {
    throw new Error("Selecciona al menos un script distinto para esta campaña");
  }
  for (const script of scripts) {
    if (interventionScriptCampaign(script, root) !== campaign.runId) {
      throw new Error(`El script no pertenece al lote actual ${campaign.runId}`);
    }
  }
  const groups = await Promise.all(scripts.map((script) => loadInterventionScript(script, providerId, root)));
  const proposals = validateInterventionProposals(groups.flat(), providerId);
  const source = provider.catalog.path;
  const original = await readInterventionSource(source);
  if (original.catalogSha256 !== provider.catalog.sha256) {
    throw new Error("El catálogo original ha cambiado desde el descubrimiento");
  }
  const simulation = simulateIntervention(original.catalog, original.catalogSha256, proposals);
  onSimulation?.(simulation);
  if (!apply) return { runId: campaign.runId, simulation, applied: false };
  if (simulation.changes.length === 0) throw new Error("No hay modificaciones que aplicar");
  const resultDir = join(root, "storage", "interventions", campaign.runId, "results", simulation.planSha256);
  let present = false;
  try {
    present = (await stat(resultDir)).isDirectory();
    if (!present) throw new Error("El resultado del plan no es un directorio");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  let derivedFile: string;
  let derivedSha256: string;
  if (present) {
    if (await realpath(resultDir) !== resultDir) throw new Error("Resultado de intervención fuera del directorio permitido");
    derivedFile = join(resultDir, "catalog-derived.json");
    const verified = await readAppliedIntervention(derivedFile, source);
    const recordValue: unknown = JSON.parse(await readFile(join(resultDir, "intervention-record.json"), "utf8"));
    const record = parseAppliedInterventionRecord(recordValue);
    const names = scripts.map((script) => basename(script)).sort();
    if (verified.provenance.campaign !== campaign.runId ||
      verified.provenance.planSha256 !== simulation.planSha256 ||
      verified.provenance.sourceCatalogSha256 !== simulation.catalogSha256 ||
      JSON.stringify(record.scripts) !== JSON.stringify(names)) {
      throw new Error("El resultado existente no corresponde a estos scripts ni al lote actual");
    }
    derivedSha256 = verified.catalogSha256;
  } else {
    const applied = await persistAppliedIntervention({
      source, scripts, campaign: campaign.runId, confirmation: simulation.planSha256,
      simulation, workspaceRoot: root
    });
    derivedFile = join(applied.path, "catalog-derived.json");
    derivedSha256 = applied.derivedSha256;
  }
  const preparationFile = join(resultDir, "prepared", `${providerId}-intervention-preparation.json`);
  const verified = await readAppliedIntervention(derivedFile, source);
  if (verified.provenance.planSha256 !== simulation.planSha256 || verified.catalogSha256 !== derivedSha256) {
    throw new Error("El derivado no corresponde al plan que se acaba de aplicar");
  }
  await prepareSavedCatalog({
    providerId, source: derivedFile, originalSource: source, out: preparationFile,
    dryRun: false, compare: null
  });
  const validation = await validateOfflinePreparation(providerId, preparationFile, derivedFile, null, source);
  return {
    runId: campaign.runId, simulation, applied: true, derivedFile, preparationFile,
    ready: validation.ready, review: validation.review
  };
};
