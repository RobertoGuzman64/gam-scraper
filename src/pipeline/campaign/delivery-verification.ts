import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readZipArchive } from "../../infrastructure/archive/zip.js";
import { CAMPAIGN_PROVIDERS, discoverCampaign } from "./discovery.js";
import { finalizeActiveCampaign } from "./finalization.js";

const sha256 = (data: Buffer | string): string => createHash("sha256").update(data).digest("hex");
const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

export type VerifiedCampaignDelivery = {
  readonly runId: string;
  readonly runFile: string;
};

export const verifyDeliveredCampaign = async (
  rootDirectory: string, desktopDirectory: string
): Promise<VerifiedCampaignDelivery> => {
  const root = resolve(rootDirectory);
  const desktop = resolve(desktopDirectory);
  const campaign = await discoverCampaign(root);
  if (!campaign.runId || !campaign.runFile || campaign.status !== "complete" || campaign.issues.length) {
    throw new Error("La campaña está incompleta, no es verificable o tiene incidencias pendientes");
  }
  const runId = campaign.runId;
  const receiptPath = join(root, "storage", "campaigns", runId, "delivery.json");
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
    throw new Error("La acreditación cambió; el lote no está listo para usar la entrega");
  }
  if (sha256(JSON.stringify(selection.selection)) !== receiptValue.selectionSha256) {
    throw new Error("La selección no es la que se entregó; se conserva el trabajo");
  }
  const zip = await readFile(receiptValue.zipFile);
  if (sha256(zip) !== receiptValue.zipSha256) throw new Error("El ZIP entregado fue modificado");
  const archive = readZipArchive(zip);
  if (archive.length !== CAMPAIGN_PROVIDERS.length) throw new Error("El ZIP entregado no contiene todos los archivos");
  for (const [index, id] of CAMPAIGN_PROVIDERS.entries()) {
    const entry = archive[index];
    if (!entry || entry.name !== `${id}-${receiptValue.date}.json`) throw new Error("El ZIP tiene entradas inesperadas");
    const parsed: unknown = JSON.parse(entry.data.toString("utf8"));
    if (!isDeepStrictEqual(parsed, selection.selection.products.filter((product) => product.providerId === id))) {
      throw new Error("El ZIP ya no reproduce la selección acreditada");
    }
  }
  return { runId, runFile: campaign.runFile };
};
