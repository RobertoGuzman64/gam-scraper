import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { join, resolve } from "node:path";
import { readManainStocklist } from "../infrastructure/filesystem/catalog/manain-stocklist.js";
import { readManainHistoricalTechnicalEvidence } from "../infrastructure/filesystem/catalog/manain-historical-technical.js";
import { readPreparationOriginal } from "../infrastructure/filesystem/preparation/preparation-source.js";
import { readCanonicalCatalog, writeCanonicalCatalog } from "../infrastructure/filesystem/catalog/canonical-catalog.js";
import { atomicWrite } from "../infrastructure/filesystem/atomic-write.js";
import type { DocumentRunOrigin, ProviderRun } from "../contracts/batch-report.js";
import type { CanonicalCatalog } from "../catalog/canonical-catalog.js";

const prefix = "manain-stocklist";
const originalFiles = ["manain-stocklist.json", "manain-stocklist.manifest.json"] as const;
const evidenceFiles = ["manain-historical-technical.json", "manain-historical-technical.manifest.json"] as const;

const originalFolder = (root: string): string => join(resolve(root), "catalogs", "providers", "manain", "original");
const evidenceFolder = (root: string): string => join(resolve(root), "catalogs", "providers", "manain", "evidence");

export const readCampaignDocumentOrigin = async (root: string): Promise<DocumentRunOrigin> => {
  const [{ stocklist, stocklistSha256 }, evidence] = await Promise.all([
    readManainStocklist(originalFolder(root)), readManainHistoricalTechnicalEvidence(evidenceFolder(root))
  ]);
  return {
    kind: "document", stocklistSha256, pdfSha256: stocklist.fuente.sha256,
    pageCount: stocklist.fuente.paginas,
    ...(evidence === null ? {} : { technicalEvidenceSha256: evidence.evidenceSha256 })
  };
};

const documentLocation = (root: string, runId: string): string =>
  join(resolve(root), "storage", "scraped", "campaigns", runId, "manain");

const snapshotDocument = async (root: string, runId: string, expected: DocumentRunOrigin): Promise<string> => {
  const folder = documentLocation(root, runId);
  const original = join(folder, "original");
  await mkdir(original, { recursive: true });
  for (const file of originalFiles) await copyFile(join(originalFolder(root), file), join(original, file));
  if (expected.technicalEvidenceSha256 !== undefined) {
    const evidence = join(folder, "evidence");
    await mkdir(evidence);
    for (const file of evidenceFiles) await copyFile(join(evidenceFolder(root), file), join(evidence, file));
  }
  const actual = await readManainDocumentSnapshot(folder);
  if (!isDeepStrictEqual(actual, expected)) throw new Error("El original documental de Manain cambió durante la campaña");
  return folder;
};

export const readManainDocumentSnapshot = async (folder: string): Promise<DocumentRunOrigin> => {
  const [{ stocklist, stocklistSha256 }, evidence] = await Promise.all([
    readManainStocklist(join(folder, "original")),
    readManainHistoricalTechnicalEvidence(join(folder, "evidence"))
  ]);
  return {
    kind: "document", stocklistSha256, pdfSha256: stocklist.fuente.sha256,
    pageCount: stocklist.fuente.paginas,
    ...(evidence === null ? {} : { technicalEvidenceSha256: evidence.evidenceSha256 })
  };
};

export const verifyManainCampaignDocument = async (
  folder: string, catalog: CanonicalCatalog, origin: DocumentRunOrigin
): Promise<void> => {
  if (!isDeepStrictEqual(await readManainDocumentSnapshot(folder), origin)) {
    throw new Error("La fuente documental de la campaña no coincide con su procedencia");
  }
  const derived = await readPreparationOriginal(join(folder, "original", "manain-stocklist.json"));
  if (catalog.providerId !== "manain" || catalog.prefix !== prefix ||
    catalog.scope !== derived.scope || catalog.productCount !== derived.productCount ||
    !isDeepStrictEqual(catalog.products, derived.products)) {
    throw new Error("El catálogo de campaña de Manain no se deriva del stocklist acreditado");
  }
  const summary: unknown = JSON.parse(await readFile(join(folder, `${prefix}-summary.json`), "utf8"));
  if (typeof summary !== "object" || summary === null || !("origin" in summary) ||
    !isDeepStrictEqual(summary.origin, origin)) {
    throw new Error("La procedencia documental no coincide con el resumen canónico");
  }
};

export const writeManainCampaignDocument = async (
  root: string, runId: string, expected: DocumentRunOrigin
): Promise<ProviderRun> => {
  const startedAt = new Date().toISOString();
  const folder = await snapshotDocument(root, runId, expected);
  const source = await readPreparationOriginal(join(folder, "original", "manain-stocklist.json"));
  if (source.document?.kind !== "stocklist" || source.catalogSha256 !== expected.stocklistSha256) {
    throw new Error("El documento de campaña carece de procedencia acreditada");
  }
  const endedAt = new Date().toISOString();
  const catalogSha256 = await writeCanonicalCatalog(
    folder, prefix, source.scope, startedAt, endedAt, source.products
  );
  const summaryFile = join(folder, `${prefix}-summary.json`);
  const changesFile = join(folder, `${prefix}-changes.json`);
  const logFile = join(resolve(root), "storage", "runs", runId, "manain-source.json");
  await atomicWrite(summaryFile, JSON.stringify({
    startedAt, endedAt, origin: expected,
    quality: { status: "complete", published: true },
    totals: { documentProducts: source.productCount },
    artifacts: { catalogSha256 }
  }, null, 2));
  await atomicWrite(changesFile, JSON.stringify({ status: "not-comparable", origin: expected }, null, 2));
  await mkdir(join(resolve(root), "storage", "runs", runId), { recursive: true });
  await atomicWrite(logFile, JSON.stringify({ providerId: "manain", origin: expected }, null, 2));
  await readCanonicalCatalog(join(folder, `${prefix}-catalog.json`));
  const provider: ProviderRun = {
    providerId: "manain", origin: expected, status: "complete", startedAt, endedAt,
    durationMs: Date.parse(endedAt) - Date.parse(startedAt), outputDir: folder,
    outputPrefix: prefix, logFile, summaryFile, changesFile, products: source.productCount,
    failures: 0
  };
  return provider;
};
