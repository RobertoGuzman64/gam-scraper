import { basename, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readFile, realpath, stat } from "node:fs/promises";
import { readAppliedIntervention } from "../../infrastructure/filesystem/interventions/intervention-derived.js";
import { readInterventionSource } from "../../infrastructure/filesystem/interventions/intervention-source.js";
import { persistAppliedIntervention } from "../../infrastructure/filesystem/interventions/intervention-application.js";
import { validateOfflinePreparation } from "../validation/offline.js";
import { prepareSavedCatalog } from "../preparation/prepare.js";
import { readSelectedInterventionScripts } from "../../infrastructure/filesystem/intervention-scripts/script-selection.js";
import { compareInterventionScripts } from "../../catalog/interventions/comparison.js";
import type { InterventionComparison } from "../../catalog/interventions/comparison.js";
import { validateInterventionScriptSelection } from "../../infrastructure/filesystem/intervention-scripts/script-location.js";
import { simulateIntervention } from "../../catalog/interventions/simulation.js";
import { parseAppliedInterventionRecord } from "../../catalog/interventions/record.js";
import type { VersionedInterventionScript } from "../../catalog/interventions/record.js";
import type { InterventionSimulation } from "../../catalog/interventions/simulation.js";
import { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import { discoverCampaign } from "./discovery/search.js";

export type CampaignInterventionResult = {
  readonly runId: string;
  readonly simulation: InterventionSimulation | null;
  readonly comparison: InterventionComparison;
  readonly applied: boolean;
  readonly derivedFile?: string;
  readonly preparationFile?: string;
  readonly ready?: number;
  readonly review?: number;
};

export const interveneActiveCampaign = async (
  rootDirectory: string, providerId: string, scripts: readonly string[], apply: boolean,
  onSimulation?: (simulation: InterventionSimulation | null, comparison: InterventionComparison) => void
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
  const selectedScripts = validateInterventionScriptSelection(scripts, providerId, campaign.runId, root);
  const selections = await readSelectedInterventionScripts(selectedScripts, providerId, root);
  const scriptVersions: readonly VersionedInterventionScript[] = selections.flatMap((selection) =>
    selection.version === null ? [] : [selection.version]).sort((a, b) => a.script.localeCompare(b.script));
  const source = provider.catalog.path;
  const original = await readInterventionSource(source);
  if (original.catalogSha256 !== provider.catalog.sha256) {
    throw new Error("El catálogo original ha cambiado desde el descubrimiento");
  }
  const comparison = compareInterventionScripts(original.catalog, selections);
  const simulation = comparison.blocked || !comparison.pending.length ? null :
    simulateIntervention(original.catalog, original.catalogSha256, comparison.pending);
  onSimulation?.(simulation, comparison);
  if (comparison.blocked) throw new Error("Hay intervenciones divergentes o parcialmente corregidas; no se permite aplicar este conjunto");
  if (!apply) return { runId: campaign.runId, simulation, comparison, applied: false };
  if (simulation === null) throw new Error("No hay modificaciones pendientes que aplicar");
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
    const names = selectedScripts.map((script) => basename(script)).sort();
    if (verified.provenance.campaign !== campaign.runId ||
      verified.provenance.planSha256 !== simulation.planSha256 ||
      verified.provenance.sourceCatalogSha256 !== simulation.catalogSha256 ||
      JSON.stringify(record.scripts) !== JSON.stringify(names) ||
      (record.version === 2 && !isDeepStrictEqual(record.scriptVersions, scriptVersions)) ||
      (record.version === 1 && scriptVersions.length > 0)) {
      throw new Error("El resultado existente no corresponde a estos scripts ni al lote actual");
    }
    derivedSha256 = verified.catalogSha256;
  } else {
    const applied = await persistAppliedIntervention({
      source, scripts: selectedScripts, campaign: campaign.runId, confirmation: simulation.planSha256,
      simulation, workspaceRoot: root, scriptVersions
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
    runId: campaign.runId, simulation, comparison, applied: true, derivedFile, preparationFile,
    ready: validation.ready, review: validation.review
  };
};
