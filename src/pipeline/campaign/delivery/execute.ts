import { createHash, randomUUID } from "node:crypto";
import { copyFile, lstat, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { constants } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { createZipArchive, readZipArchive, type ZipFile } from "../../../infrastructure/archive/zip.js";
import { CAMPAIGN_PROVIDERS } from "../discovery/report.js";
import { finalizeActiveCampaign } from "../finalization.js";
import { PortableCampaignConflictError } from "../../../infrastructure/filesystem/catalog/portable-campaign.js";
import { persistCampaignDelivery, removeDeliveredRunLogs } from "../../../infrastructure/filesystem/campaign/campaign-cleanup.js";

export type CampaignDeliveryResult = {
  readonly runId: string;
  readonly zipFile: string;
  readonly date: string;
  readonly products: Readonly<Record<(typeof CAMPAIGN_PROVIDERS)[number], number>>;
};

const deliveryDate = (date: Date): string => {
  if (!Number.isFinite(date.getTime())) throw new Error("Fecha de entrega inválida");
  return `${date.getFullYear().toString().padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const assertNotDelivered = async (rootDirectory: string, runId: string): Promise<void> => {
  const receipt = join(resolve(rootDirectory), "storage", "campaigns", runId, "delivery.json");
  try { await lstat(receipt); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error("La campaña ya tiene una entrega; no se reemplaza ni se entrega dos veces");
};

export const deliverActiveCampaign = async (
  rootDirectory: string, desktopDirectory: string, deliveredAt: Date = new Date()
): Promise<CampaignDeliveryResult> => {
  const date = deliveryDate(deliveredAt);
  // Finalization validates the selection and its immutable portable snapshot.
  // A later approved intervention may conflict with that snapshot before the
  // delivery receipt guard runs. In that case, report the existing delivery,
  // but never suppress a conflict when no receipt exists.
  const selection = await finalizeActiveCampaign(rootDirectory, false).catch(async (error: unknown) => {
    if (error instanceof PortableCampaignConflictError) {
      await assertNotDelivered(rootDirectory, error.runId);
    }
    throw error;
  });
  if (selection.status !== "selected" || !selection.selectionDir || !selection.selection) {
    throw new Error(`Entrega bloqueada: la campaña necesita acreditación aprobada (estado: ${selection.status})`);
  }
  await assertNotDelivered(rootDirectory, selection.runId);
  const source = selection.selection;
  if (source.products.length !== source.totals.publishable ||
    source.totals.original !== source.totals.publishable + source.totals.excluded) {
    throw new Error("La selección no cuadra con sus totales");
  }
  const counts: Record<(typeof CAMPAIGN_PROVIDERS)[number], number> = { gam: 0, gomariz: 0, mercaeleva: 0, manain: 0 };
  const files: ZipFile[] = [];
  for (const providerId of CAMPAIGN_PROVIDERS) {
    const raw = await readFile(join(selection.selectionDir, `${providerId}-publishable.json`), "utf8");
    const products: unknown = JSON.parse(raw);
    const expected = source.products.filter((product) => product.providerId === providerId);
    if (!Array.isArray(products) || !isDeepStrictEqual(products, expected)) {
      throw new Error(`El JSON seleccionado de ${providerId} no corresponde a la acreditación actual`);
    }
    counts[providerId] = expected.length;
    files.push({ name: `${providerId}-${date}.json`, data: raw });
  }
  if (Object.values(counts).reduce((sum, count) => sum + count, 0) !== source.totals.publishable) {
    throw new Error("Los proveedores no suman el total publicable");
  }
  const desktop = resolve(desktopDirectory);
  const destinationInfo = await stat(desktop);
  if (!destinationInfo.isDirectory()) throw new Error("La ruta del Escritorio no es un directorio");
  const destination = join(desktop, `equipzilla-${date}-${selection.runId}.zip`);
  const pending = join(desktop, `.equipzilla-${date}-${randomUUID()}.tmp`);
  try {
    await writeFile(pending, createZipArchive(files), { flag: "wx" });
    const verified = readZipArchive(await readFile(pending));
    if (verified.length !== files.length || verified.some((entry, index) =>
      entry.name !== files[index]?.name || !entry.data.equals(Buffer.from(files[index]?.data ?? "", "utf8")))) {
      throw new Error("El ZIP temporal no contiene exactamente los JSON esperados");
    }
    try { await copyFile(pending, destination, constants.COPYFILE_EXCL); }
    catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    }
    const actual = await readFile(destination);
    if (!actual.equals(await readFile(pending))) throw new Error("Ya existe un ZIP distinto con ese nombre; no se sobrescribe");
  } finally {
    await rm(pending, { force: true });
  }
  await persistCampaignDelivery(rootDirectory, {
    version: 1, runId: selection.runId, date, zipFile: destination,
    zipSha256: createHash("sha256").update(await readFile(destination)).digest("hex"),
    selectionSha256: createHash("sha256").update(JSON.stringify(source)).digest("hex")
  });
  try {
    await removeDeliveredRunLogs(rootDirectory, selection.runId);
  } catch (error) {
    console.warn(`Entrega correcta, pero los logs no se pudieron limpiar: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { runId: selection.runId, zipFile: destination, date, products: counts };
};
