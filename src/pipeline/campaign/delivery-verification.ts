import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readZipArchive } from "../../infrastructure/archive/zip.js";
import { discoverCampaign } from "./discovery.js";
import { finalizeActiveCampaign } from "./finalization.js";

const sha256 = (data: Buffer | string): string => createHash("sha256").update(data).digest("hex");
const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);
const missing = (error: unknown): boolean => isRecord(error) && error.code === "ENOENT";

export type VerifiedCampaignDelivery = {
  readonly runId: string;
  readonly runFile: string;
  readonly zipStatus: "verified" | "absent" | "not-checked";
};

export const verifyDeliveredCampaign = async (
  rootDirectory: string, desktopDirectory?: string, targetRunId?: string, skipRunId?: string
): Promise<VerifiedCampaignDelivery> => {
  const root = resolve(rootDirectory);
  const campaign = await discoverCampaign(root, targetRunId, skipRunId);
  if (!campaign.runId || !campaign.runFile || campaign.status !== "complete" || campaign.issues.length) {
    throw new Error(`La campaña ${targetRunId ?? "actual"} no tiene canónicos íntegros o presenta incidencias`);
  }
  const runId = campaign.runId;
  const receiptPath = join(root, "storage", "campaigns", runId, "delivery.json");
  let receiptText: string;
  try { receiptText = await readFile(receiptPath, "utf8"); }
  catch (error) {
    if (missing(error)) throw new Error(`Falta justificante de entrega local de ${runId}`);
    throw error;
  }
  const receiptValue: unknown = JSON.parse(receiptText);
  if (!isRecord(receiptValue) || receiptValue.version !== 1 || receiptValue.runId !== runId ||
    typeof receiptValue.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(receiptValue.date) ||
    typeof receiptValue.zipFile !== "string" || typeof receiptValue.zipSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(receiptValue.zipSha256) ||
    typeof receiptValue.selectionSha256 !== "string" || !/^[a-f0-9]{64}$/.test(receiptValue.selectionSha256) ||
    !new RegExp(`^equipzilla-${receiptValue.date}(?:-[a-zA-Z0-9_-]+)?\\.zip$`).test(basename(receiptValue.zipFile)) ||
    resolve(receiptValue.zipFile) !== receiptValue.zipFile ||
    (desktopDirectory !== undefined && resolve(desktopDirectory) !== resolve(receiptValue.zipFile, ".."))) {
    throw new Error(`Justificante de entrega local incoherente: ${runId}`);
  }
  const selection = await finalizeActiveCampaign(root, true, runId, skipRunId);
  if (selection.status !== "simulation" || !selection.selection) {
    throw new Error(`La acreditación local de ${runId} ya no está aprobada`);
  }
  if (sha256(JSON.stringify(selection.selection)) !== receiptValue.selectionSha256) {
    throw new Error(`La selección local de ${runId} no coincide con la entrega`);
  }
  const approval = selection.selection.accreditation;
  if (!approval || approval.runId !== runId || !/^[a-f0-9]{64}$/.test(approval.approvalSha256)) {
    throw new Error(`Acreditación vinculada a un lote distinto: ${runId}`);
  }
  const selectionDir = join(root, "storage", "campaigns", runId, "selection", approval.approvalSha256);
  const expectedFiles = ["selection.json", ...campaign.requestedProviders.map((provider) => `${provider}-publishable.json`)];
  for (const name of expectedFiles) {
    const path = join(selectionDir, name);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Selección no regular: ${path}`);
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    const expected = name === "selection.json" ? selection.selection :
      selection.selection.products.filter((product) => `${product.providerId}-publishable.json` === name);
    if (!isDeepStrictEqual(parsed, expected)) throw new Error(`La selección entregada ha cambiado: ${path}`);
  }
  const external = receiptValue.zipFile;
  let zip: Buffer;
  try { zip = await readFile(external); }
  catch (error) {
    if (missing(error)) return { runId, runFile: campaign.runFile, zipStatus: "absent" };
    throw error;
  }
  if (sha256(zip) !== receiptValue.zipSha256) throw new Error(`ZIP físico alterado para ${runId}`);
  const archive = readZipArchive(zip);
  if (archive.length !== campaign.requestedProviders.length) throw new Error(`ZIP físico incompleto de ${runId}`);
  for (const [index, id] of campaign.requestedProviders.entries()) {
    const entry = archive[index];
    if (!entry || entry.name !== `${id}-${receiptValue.date}.json`) throw new Error("El ZIP contiene entradas inesperadas");
    const parsed: unknown = JSON.parse(entry.data.toString("utf8"));
    if (!isDeepStrictEqual(parsed, selection.selection.products.filter((product) => product.providerId === id))) {
      throw new Error(`El ZIP no reproduce la selección local de ${runId}`);
    }
  }
  return { runId, runFile: campaign.runFile, zipStatus: "verified" };
};
