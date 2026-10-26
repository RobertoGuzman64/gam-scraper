import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, basename, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readZipArchive } from "../../infrastructure/archive/zip.js";
import { inspectCleanupArea, removeCleanupDirectories } from "../../infrastructure/filesystem/campaign-cleanup.js";
import type { CleanupArea } from "../../infrastructure/filesystem/campaign-cleanup.js";
import { CAMPAIGN_PROVIDERS, discoverCampaign } from "./discovery.js";
import { finalizeActiveCampaign } from "./finalization.js";

const sha256 = (data: Buffer | string): string => createHash("sha256").update(data).digest("hex");
const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

export type CampaignCleanupPlan = {
  readonly runId: string;
  readonly directories: readonly string[];
  readonly bytes: number;
  readonly preservedScripts: string | null;
};

type RunOutputs = { readonly providers: readonly {
  readonly providerId: string;
  readonly outputDir: string;
}[] };

const readRun = async (runFile: string, runId: string): Promise<RunOutputs> => {
  const input: unknown = JSON.parse(await readFile(runFile, "utf8"));
  if (!isRecord(input) || input.version !== 1 || input.runId !== runId || input.status !== "complete" ||
    !Array.isArray(input.providers) || input.providers.length !== CAMPAIGN_PROVIDERS.length ||
    !input.providers.every((provider: unknown) => isRecord(provider) &&
      typeof provider.providerId === "string" && CAMPAIGN_PROVIDERS.some((id) => id === provider.providerId) &&
      typeof provider.outputDir === "string" && typeof provider.outputPrefix === "string")) {
    throw new Error("El run.json no corresponde a un lote completo y reconocible");
  }
  const providers = input.providers.filter((provider: unknown): provider is {
    readonly providerId: string; readonly outputDir: string;
  } => isRecord(provider) && typeof provider.providerId === "string" &&
    typeof provider.outputDir === "string");
  if (new Set(providers.map((provider) => provider.providerId)).size !== CAMPAIGN_PROVIDERS.length) {
    throw new Error("El lote tiene proveedores repetidos");
  }
  return { providers };
};

export const planDeliveredCampaignCleanup = async (
  rootDirectory: string, desktopDirectory: string
): Promise<CampaignCleanupPlan> => {
  const root = resolve(rootDirectory);
  const desktop = resolve(desktopDirectory);
  const campaign = await discoverCampaign(root);
  if (!campaign.runId || !campaign.runFile || campaign.status !== "complete" || campaign.issues.length) {
    throw new Error("No se elimina una campaña incompleta, no verificable o con incidencias pendientes");
  }
  const runId = campaign.runId;
  const receiptPath = join(root, "storage", "campanas", runId, "delivery.json");
  let receiptText: string;
  try { receiptText = await readFile(receiptPath, "utf8"); }
  catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      throw new Error("Falta justificante válido de la entrega del lote actual");
    }
    throw error;
  }
  const receiptValue: unknown = JSON.parse(receiptText);
  if (!isRecord(receiptValue) || receiptValue.version !== 1 || receiptValue.runId !== runId ||
    typeof receiptValue.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(receiptValue.date) ||
    typeof receiptValue.zipFile !== "string" || typeof receiptValue.zipSha256 !== "string" ||
    typeof receiptValue.selectionSha256 !== "string" ||
    receiptValue.zipFile !== join(desktop, `equipzilla-${receiptValue.date}.zip`)) {
    throw new Error("Falta justificante válido de la entrega del lote actual");
  }
  const selection = await finalizeActiveCampaign(root, true);
  if (selection.status !== "simulation" || !selection.selection) {
    throw new Error("La acreditación cambió; el lote no está listo para limpieza");
  }
  if (sha256(JSON.stringify(selection.selection)) !== receiptValue.selectionSha256) {
    throw new Error("La selección no es la que se entregó; se conserva el trabajo");
  }
  const zip = await readFile(receiptValue.zipFile);
  if (sha256(zip) !== receiptValue.zipSha256) throw new Error("El ZIP entregado fue modificado; no se limpia");
  const archive = readZipArchive(zip);
  if (archive.length !== CAMPAIGN_PROVIDERS.length) throw new Error("El ZIP entregado no contiene tres archivos");
  for (const [index, id] of CAMPAIGN_PROVIDERS.entries()) {
    const entry = archive[index];
    if (!entry || entry.name !== `${id}-${receiptValue.date}.json`) throw new Error("El ZIP tiene entradas inesperadas");
    const parsed: unknown = JSON.parse(entry.data.toString("utf8"));
    if (!isDeepStrictEqual(parsed, selection.selection.products.filter((product) => product.providerId === id))) {
      throw new Error("El ZIP ya no reproduce la selección acreditada");
    }
  }
  const run = await readRun(campaign.runFile, runId);
  const scrapedCampaign = dirname(resolve(run.providers[0]?.outputDir ?? ""));
  const expectedParent = join(root, "storage", "scraped", "campanas");
  if (dirname(scrapedCampaign) !== expectedParent ||
    !/^[a-zA-Z0-9_-]+$/.test(basename(scrapedCampaign)) ||
    run.providers.some((provider) =>
      resolve(provider.outputDir) !== join(scrapedCampaign, provider.providerId))) {
    throw new Error("Los archivos de extracción no están en la carpeta aislada esperada; no se borran");
  }
  const areas: readonly { path: string; area: CleanupArea }[] = [
    { path: join(root, "storage", "interventions", runId, "results"), area: "intervention" },
    { path: join(root, "storage", "campanas", runId), area: "campaign" },
    { path: scrapedCampaign, area: "scraped" },
    { path: join(root, "storage", "runs", runId), area: "run" }
  ];
  const directories: string[] = [];
  let bytes = 0;
  for (const candidate of areas) {
    const total = await inspectCleanupArea(root, candidate.path, candidate.area);
    if (total !== null) { bytes += total; directories.push(candidate.path); }
  }
  const scripts = join(root, "storage", "interventions", runId, "scripts");
  let preservedScripts: string | null = null;
  try {
    if ((await stat(scripts)).isDirectory()) {
      preservedScripts = scripts;
    }
  } catch (error) {
    if (!isRecord(error) || error.code !== "ENOENT") throw error;
  }
  return { runId, directories, bytes, preservedScripts };
};

export const cleanDeliveredCampaign = async (
  rootDirectory: string, desktopDirectory: string, dryRun: boolean
): Promise<CampaignCleanupPlan> => {
  const plan = await planDeliveredCampaignCleanup(rootDirectory, desktopDirectory);
  if (!dryRun) {
    await removeCleanupDirectories(plan.directories);
  }
  return plan;
};
