import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { sha256 } from "../../catalog/editorial/campaign-accreditation.js";
import { createZipArchive, readZipArchive } from "../../infrastructure/archive/zip.js";
import { deliverIndividualProvider } from "./individual-delivery.js";
import type { IndividualDeliveryResult } from "./individual-delivery.js";
import type { IndividualEditorialOptions } from "./individual-editorial.js";

type ArchiveReceipt = {
  readonly version: 1;
  readonly providerId: string;
  readonly approvalSha256: string;
  readonly productSha256: string;
  readonly date: string;
  readonly zipFile: string;
  readonly zipSha256: string;
};

export type IndividualArchiveResult = IndividualDeliveryResult & {
  readonly zipFile: string | null;
};

const digest = (buffer: Buffer): string => createHash("sha256").update(buffer).digest("hex");

const exists = async (path: string): Promise<boolean> => {
  try { await lstat(path); return true; }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
};

const dateText = (date: Date): string => {
  if (!Number.isFinite(date.getTime())) throw new Error("Fecha de entrega individual inválida");
  return `${date.getFullYear().toString().padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const isReceipt = (value: unknown): value is ArchiveReceipt => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return "version" in value && value.version === 1 &&
    "providerId" in value && typeof value.providerId === "string" &&
    "approvalSha256" in value && typeof value.approvalSha256 === "string" &&
    "productSha256" in value && typeof value.productSha256 === "string" &&
    "date" in value && typeof value.date === "string" &&
    "zipFile" in value && typeof value.zipFile === "string" &&
    "zipSha256" in value && typeof value.zipSha256 === "string";
};

const readReceipt = async (path: string): Promise<ArchiveReceipt> => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Recibo individual alterado");
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!isReceipt(raw)) throw new Error("Recibo individual inválido");
  return raw;
};

const checkArchive = async (
  receipt: ArchiveReceipt, providerId: string, approvalSha256: string,
  productText: string, desktop: string
): Promise<void> => {
  if (receipt.providerId !== providerId || receipt.approvalSha256 !== approvalSha256 ||
    receipt.productSha256 !== sha256(productText) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(receipt.date) ||
    !/^[a-f0-9]{64}$/.test(receipt.zipSha256) ||
    receipt.zipFile !== join(desktop, `equipzilla-${providerId}-${receipt.date}-${approvalSha256.slice(0, 16)}.zip`)) {
    throw new Error("Recibo de entrega individual incoherente");
  }
  const metadata = await lstat(receipt.zipFile);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("ZIP individual no es un archivo regular");
  const zip = await readFile(receipt.zipFile);
  if (digest(zip) !== receipt.zipSha256) throw new Error("ZIP individual alterado");
  const entries = readZipArchive(zip);
  if (entries.length !== 1 || entries[0]?.name !== `${providerId}-${receipt.date}.json` ||
    !entries[0].data.equals(Buffer.from(productText, "utf8"))) {
    throw new Error("ZIP individual no corresponde al JSON comercial acreditado");
  }
};

export const deliverIndividualArchive = async (
  options: IndividualEditorialOptions, desktopDirectory: string,
  mode: "simulation" | "publish" | "verify" = "publish", deliveredAt: Date = new Date()
): Promise<IndividualArchiveResult> => {
  const desktop = resolve(desktopDirectory);
  if (mode !== "simulation") {
    const info = await stat(desktop);
    if (!info.isDirectory()) throw new Error("La ruta del Escritorio no es un directorio");
  }
  const publication = await deliverIndividualProvider(options, mode);
  if (mode === "simulation") return { ...publication, zipFile: null };

  const approvalSha256 = basename(publication.publicationDirectory);
  if (!/^[a-f0-9]{64}$/.test(approvalSha256)) throw new Error("Identificador de publicación individual inválido");
  const productText = await readFile(publication.productFile, "utf8");
  const receiptFile = join(resolve(options.rootDirectory), "storage", "providers", options.providerId,
    "deliveries", `${approvalSha256}.json`);
  if (await exists(receiptFile)) {
    const receipt = await readReceipt(receiptFile);
    await checkArchive(receipt, options.providerId, approvalSha256, productText, desktop);
    return { ...publication, status: "verified", zipFile: receipt.zipFile };
  }
  if (mode === "verify") throw new Error("No existe todavía un ZIP de entrega individual acreditado");

  await mkdir(dirname(receiptFile), { recursive: true });
  const lockFile = `${receiptFile}.lock`;
  let lock;
  try { lock = await open(lockFile, "wx"); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error("Otra entrega ZIP individual está en curso");
    }
    throw error;
  }
  try {
    if (await exists(receiptFile)) {
      const receipt = await readReceipt(receiptFile);
      await checkArchive(receipt, options.providerId, approvalSha256, productText, desktop);
      return { ...publication, status: "verified", zipFile: receipt.zipFile };
    }
    const date = dateText(deliveredAt);
    const zipFile = join(desktop, `equipzilla-${options.providerId}-${date}-${approvalSha256.slice(0, 16)}.zip`);
    const data = createZipArchive([{ name: `${options.providerId}-${date}.json`, data: productText }]);
    const pending = join(desktop, `.equipzilla-${randomUUID()}.tmp`);
    try {
      await writeFile(pending, data, { flag: "wx" });
      const content = readZipArchive(await readFile(pending));
      if (content.length !== 1 || content[0]?.name !== `${options.providerId}-${date}.json` ||
        !content[0].data.equals(Buffer.from(productText, "utf8"))) {
        throw new Error("El ZIP individual temporal no contiene el JSON esperado");
      }
      try { await copyFile(pending, zipFile, constants.COPYFILE_EXCL); }
      catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      }
      const actual = await readFile(zipFile);
      if (!actual.equals(data)) throw new Error("Ya existe un ZIP distinto con ese nombre; no se sobrescribe");
    } finally {
      await rm(pending, { force: true });
    }
    const receipt: ArchiveReceipt = {
      version: 1, providerId: options.providerId, approvalSha256,
      productSha256: sha256(productText), date, zipFile, zipSha256: digest(data)
    };
    await checkArchive(receipt, options.providerId, approvalSha256, productText, desktop);
    await writeFile(receiptFile, JSON.stringify(receipt, null, 2), { flag: "wx" });
    return { ...publication, status: "published", zipFile };
  } finally {
    await lock.close();
    await rm(lockFile, { force: true });
  }
};
