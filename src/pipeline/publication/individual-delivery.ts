import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { sha256 } from "../../catalog/editorial/campaign-accreditation.js";
import type { PublishableSelection } from "../../catalog/editorial/select-publishable.js";
import { inspectIndividualEditorial } from "./individual-editorial.js";
import type { IndividualEditorialOptions } from "./individual-editorial.js";
import { readIndividualSelection, selectIndividualPublishable } from "./individual-selection.js";

export type IndividualDeliveryResult = {
  readonly status: "simulation" | "published" | "verified";
  readonly providerId: string;
  readonly publicationDirectory: string;
  readonly productFile: string;
  readonly publishable: number;
  readonly excluded: number;
};

type PublicationFile = {
  readonly name: string;
  readonly content: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const missing = (error: unknown): boolean => isRecord(error) && error.code === "ENOENT";

const existing = async (path: string): Promise<boolean> => {
  try { await lstat(path); return true; }
  catch (error) { if (missing(error)) return false; throw error; }
};

const verifyPublication = async (directory: string, files: readonly PublicationFile[]): Promise<void> => {
  const directoryInfo = await lstat(directory);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) throw new Error("Publicación individual: directorio alterado");
  for (const file of files) {
    const path = join(directory, file.name);
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Publicación individual: archivo no regular (${file.name})`);
    const contents = await readFile(path, "utf8");
    if (contents !== file.content) throw new Error(`Publicación individual: archivo alterado (${file.name})`);
  }
  const names = await readdir(directory);
  if (names.length !== files.length || files.some((file) => !names.includes(file.name))) {
    throw new Error("Publicación individual: archivos adicionales o ausentes");
  }
};

const createFiles = (
  providerId: string, selection: PublishableSelection, accreditationText: string
): readonly PublicationFile[] => {
  const productName = `${providerId}-publishable.json`;
  const productsText = JSON.stringify(selection.products, null, 2);
  const approvalText = accreditationText;
  const approvalSha256 = sha256(approvalText);
  if (selection.accreditation?.approvalSha256 !== approvalSha256) {
    throw new Error("La selección no está vinculada a la aprobación individual actual");
  }
  const manifest = {
    version: 1,
    providerId,
    runId: selection.accreditation.runId,
    source: selection.source[0],
    preparationSha256: selection.accreditation.preparationSources[0]?.preparationSha256,
    approvalSha256,
    totals: selection.totals,
    files: {
      [productName]: sha256(productsText),
      "accreditation.json": approvalSha256
    }
  };
  return [
    { name: productName, content: productsText },
    { name: "accreditation.json", content: approvalText },
    { name: "manifest.json", content: JSON.stringify(manifest, null, 2) }
  ];
};

export const deliverIndividualProvider = async (
  options: IndividualEditorialOptions, mode: "simulation" | "publish" | "verify" = "publish"
): Promise<IndividualDeliveryResult> => {
  const review = await inspectIndividualEditorial(options);
  if (!review.inspection.approved || review.inspection.issues.length) {
    throw new Error("Publicación individual bloqueada: faltan aprobación humana o decisiones editoriales válidas");
  }
  const context = await readIndividualSelection(options.providerId, options.catalogFile, options.preparationFile);
  if (context.runId !== review.runId) throw new Error("La acreditación no corresponde a esta preparación");
  const accreditationText = await readFile(review.draftFile, "utf8");
  const selection = selectIndividualPublishable(context, accreditationText);
  if (!selection.accreditation || selection.source.length !== 1 || selection.source[0]?.providerId !== options.providerId ||
    selection.totals.original !== selection.totals.publishable + selection.totals.excluded ||
    selection.products.some((product) => product.providerId !== options.providerId) ||
    new Set(selection.products.map((product) => product.reference)).size !== selection.products.length ||
    selection.exclusions.some((item) => item.providerId !== options.providerId)) {
    throw new Error("Publicación individual: selección incoherente");
  }
  const files = createFiles(options.providerId, selection, accreditationText);
  const directory = join(resolve(options.rootDirectory), "catalogs", "providers", options.providerId,
    "publications", sha256(accreditationText));
  const productFile = join(directory, `${options.providerId}-publishable.json`);
  const result = {
    providerId: options.providerId, publicationDirectory: directory, productFile,
    publishable: selection.totals.publishable, excluded: selection.totals.excluded
  };
  if (mode === "simulation") return { ...result, status: "simulation" };
  if (await existing(directory)) {
    await verifyPublication(directory, files);
    return { ...result, status: "verified" };
  }
  if (mode === "verify") throw new Error("No existe una publicación individual para esta acreditación");
  const parent = dirname(directory);
  await mkdir(parent, { recursive: true });
  const lockFile = join(parent, ".publication.lock");
  let lock;
  try { lock = await open(lockFile, "wx"); }
  catch (error) {
    if (isRecord(error) && error.code === "EEXIST") throw new Error("Otra publicación individual está en curso");
    throw error;
  }
  const stage = join(parent, `.publication-${randomUUID()}.tmp`);
  try {
    if (await existing(directory)) {
      await verifyPublication(directory, files);
      return { ...result, status: "verified" };
    }
    await mkdir(stage);
    for (const file of files) await writeFile(join(stage, file.name), file.content, { flag: "wx" });
    const refreshed = await readIndividualSelection(options.providerId, options.catalogFile, options.preparationFile);
    const latestApproval = await readFile(review.draftFile, "utf8");
    if (refreshed.runId !== context.runId || !isDeepStrictEqual(refreshed.sources, context.sources) ||
      latestApproval !== accreditationText) {
      throw new Error("La preparación o aprobación cambió durante la publicación");
    }
    if (await existing(directory)) throw new Error("Otra publicación creó este destino; no se sobrescribe");
    await rename(stage, directory);
    await verifyPublication(directory, files);
    return { ...result, status: "published" };
  } finally {
    await rm(stage, { recursive: true, force: true });
    await lock.close();
    await rm(lockFile, { force: true });
  }
};
