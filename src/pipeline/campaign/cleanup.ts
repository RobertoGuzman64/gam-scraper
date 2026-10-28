import { readFile, stat } from "node:fs/promises";
import { dirname, basename, join, resolve } from "node:path";
import { inspectCleanupArea } from "../../infrastructure/filesystem/campaign-cleanup.js";
import type { CleanupArea, CleanupInventory } from "../../infrastructure/filesystem/campaign-cleanup.js";
import { CAMPAIGN_PROVIDERS, discoverCampaign } from "./discovery.js";
import { verifyDeliveredCampaign } from "./delivery-verification.js";

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

export type CampaignCleanupPlan = {
  readonly runId: string;
  readonly directories: readonly string[];
  readonly bytes: number;
  readonly preservedScripts: string | null;
  readonly inventory: readonly { readonly area: CleanupArea; readonly path: string; readonly details: CleanupInventory }[];
};

type RunOutputs = { readonly providers: readonly {
  readonly providerId: string;
  readonly outputDir: string;
  readonly outputPrefix: string;
}[] };

const readRun = async (runFile: string, runId: string): Promise<RunOutputs> => {
  const input: unknown = JSON.parse(await readFile(runFile, "utf8"));
  if (!isRecord(input) || input.version !== 1 || input.runId !== runId || input.status !== "complete" ||
    !Array.isArray(input.providers) || input.providers.length < 3 || input.providers.length > CAMPAIGN_PROVIDERS.length ||
    !input.providers.every((provider: unknown) => isRecord(provider) &&
      typeof provider.providerId === "string" && CAMPAIGN_PROVIDERS.some((id) => id === provider.providerId) &&
      typeof provider.outputDir === "string" && typeof provider.outputPrefix === "string" &&
    /^[a-zA-Z0-9_-]+$/.test(provider.outputPrefix))) {
    throw new Error("El run.json no corresponde a un lote completo y reconocible");
  }
  const providers = input.providers.filter((provider: unknown): provider is {
    readonly providerId: string; readonly outputDir: string; readonly outputPrefix: string;
  } => isRecord(provider) && typeof provider.providerId === "string" &&
    typeof provider.outputDir === "string" && typeof provider.outputPrefix === "string");
  if (new Set(providers.map((provider) => provider.providerId)).size !== providers.length) {
    throw new Error("El lote tiene proveedores repetidos");
  }
  return { providers };
};

export const planDeliveredCampaignCleanup = async (
  rootDirectory: string, desktopDirectory: string, targetRunId?: string
): Promise<CampaignCleanupPlan> => {
  const root = resolve(rootDirectory);
  const { runId, runFile } = await verifyDeliveredCampaign(root, desktopDirectory, targetRunId);
  const run = await readRun(runFile, runId);
  const campaign = await discoverCampaign(root, runId);
  if (run.providers.length !== campaign.requestedProviders.length ||
    run.providers.some((provider) => !campaign.requestedProviders.includes(provider.providerId))) throw new Error("Proveedores de campaña incongruentes");
  const scrapedCampaign = dirname(resolve(run.providers[0]?.outputDir ?? ""));
  const expectedParent = join(root, "storage", "scraped", "campaigns");
  if (dirname(scrapedCampaign) !== expectedParent ||
    !/^[a-zA-Z0-9_-]+$/.test(basename(scrapedCampaign)) ||
    run.providers.some((provider) =>
      resolve(provider.outputDir) !== join(scrapedCampaign, provider.providerId))) {
    throw new Error("Los archivos de extracción no están en la carpeta aislada esperada; no se borran");
  }
  const areas: readonly { path: string; area: CleanupArea }[] = [
    { path: join(root, "storage", "interventions", runId, "results"), area: "intervention" },
    { path: join(root, "storage", "campaigns", runId), area: "campaign" },
    { path: scrapedCampaign, area: "scraped" },
    { path: join(root, "storage", "runs", runId), area: "run" }
  ];
  const directories: string[] = [];
  const inventory: { area: CleanupArea; path: string; details: CleanupInventory }[] = [];
  const errors: string[] = [];
  const prefixes = new Map(run.providers.map((provider) => [provider.providerId, provider.outputPrefix]));
  let bytes = 0;
  for (const candidate of areas) {
    try {
      const details = await inspectCleanupArea(root, candidate.path, candidate.area, prefixes);
      if (details !== null) {
        bytes += details.bytes;
        directories.push(candidate.path);
        inventory.push({ ...candidate, details });
      }
    } catch (error) { errors.push(String(error)); }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  const scripts = join(root, "storage", "interventions", runId, "scripts");
  let preservedScripts: string | null = null;
  try {
    if ((await stat(scripts)).isDirectory()) {
      preservedScripts = scripts;
    }
  } catch (error) {
    if (!isRecord(error) || error.code !== "ENOENT") throw error;
  }
  return { runId, directories, bytes, preservedScripts, inventory };
};

export const cleanDeliveredCampaign = async (
  rootDirectory: string, desktopDirectory: string, dryRun: boolean
): Promise<CampaignCleanupPlan> => {
  const plan = await planDeliveredCampaignCleanup(rootDirectory, desktopDirectory);
  if (!dryRun) throw new Error("La limpieza manual ordinaria está retirada; la rotación segura es automática");
  return plan;
};
