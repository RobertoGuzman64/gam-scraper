import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { getProvider } from "../../scraping/registry.js";
import { parseCsv } from "../../shared/csv-parse.js";
import { parsePreparation } from "../../catalog/import/preparation-document.js";
import { loadImportCatalog } from "../../catalog/import/catalog-loader.js";
import { validateImportCandidate } from "../../catalog/import/import-validation.js";

export type PreflightOptions = {
  readonly providerId: string;
  readonly outputDir: string;
  readonly outputPrefix: string;
  readonly maxAgeHours: number;
};

export type PreflightReport = {
  readonly providerId: string;
  readonly checkedAt: string;
  readonly summaryFile: string;
  readonly productCount: number;
  readonly ready: number;
  readonly review: number;
  readonly suspectedMissing: number;
  readonly status: "passed" | "review";
  readonly warnings: readonly string[];
};

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isNonnegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8")) as unknown;

const referenceKey = (reference: string): string => reference.trim().toLocaleUpperCase("es");

export const validateCatalogPublication = async (options: PreflightOptions): Promise<PreflightReport> => {
  getProvider(options.providerId);
  if (!Number.isFinite(options.maxAgeHours) || options.maxAgeHours <= 0) {
    throw new Error("maxAgeHours debe ser positivo");
  }
  if (!options.outputPrefix.trim() || options.outputPrefix.includes("/") || options.outputPrefix.includes("\\") ||
    options.outputPrefix === "." || options.outputPrefix === "..") {
    throw new Error("Prefijo de salida inválido");
  }

  const base = resolve(options.outputDir, options.outputPrefix);
  const summaryFile = `${base}-summary.json`;
  const preparationFile = `${base}-preparation.json`;
  const csvFile = `${base}-all.csv`;
  const changesFile = `${base}-changes.json`;
  const [summary, rawPreparation, rawCsv, changes, summaryStat, preparationStat, csvStat, changesStat] = await Promise.all([
    readJson(summaryFile), readFile(preparationFile, "utf8"), readFile(csvFile, "utf8"), readJson(changesFile),
    stat(summaryFile), stat(preparationFile), stat(csvFile), stat(changesFile)
  ]);
  if (!isRecord(summary) || !isRecord(summary.quality) || summary.quality.status !== "complete" ||
    summary.quality.published !== true || !isRecord(summary.totals) ||
    !isNonnegativeInteger(summary.totals.scrapedProducts) || summary.totals.scrapedProducts === 0 ||
    summary.totals.failures !== 0 || typeof summary.startedAt !== "string" ||
    typeof summary.endedAt !== "string") {
    throw new Error("El resumen no confirma un catálogo completo y sin errores");
  }
  if (!isRecord(summary.artifacts) || typeof summary.artifacts.csvSha256 !== "string" ||
    typeof summary.artifacts.preparationSha256 !== "string" ||
    createHash("sha256").update(rawCsv).digest("hex") !== summary.artifacts.csvSha256 ||
    createHash("sha256").update(rawPreparation).digest("hex") !== summary.artifacts.preparationSha256) {
    throw new Error("Los archivos publicados no coinciden con sus huellas de integridad; ejecutar de nuevo el scraping");
  }
  const preparation: unknown = JSON.parse(rawPreparation);
  const started = Date.parse(summary.startedAt);
  const ended = Date.parse(summary.endedAt);
  const checkedAt = Date.now();
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started ||
    started > checkedAt + 60_000 || checkedAt - ended > options.maxAgeHours * 3_600_000) {
    throw new Error("Fecha de extracción inválida o catálogo demasiado antiguo");
  }
  for (const metadata of [summaryStat, preparationStat, csvStat, changesStat]) {
    if (metadata.mtimeMs < started - 2_000) {
      throw new Error("Se han mezclado archivos de ejecuciones distintas");
    }
  }
  if (!isRecord(changes) || changes.status !== "comparable" ||
    !Array.isArray(changes.suspectedMissing) || !changes.suspectedMissing.every((v: unknown) => typeof v === "string")) {
    throw new Error("Informe de cambios incompleto, no comparable o antiguo");
  }
  const document = parsePreparation(preparation, options.providerId);
  if (isRecord(preparation) && isRecord(preparation.totals)) {
    const totals = preparation.totals;
    const actualReady = document.products.filter((entry) => entry.status === "ready").length;
    const actualReview = document.products.length - actualReady;
    if (totals.ready !== actualReady || totals.review !== actualReview) {
      throw new Error("Los totales ready/review de la preparación no coinciden con sus productos");
    }
  }
  const catalog = await loadImportCatalog();
  const csv = parseCsv(rawCsv.replace(/^\ufeff/, ""));
  if (new Set(csv.headers).size !== csv.headers.length ||
    !["providerId", "url", "reference"].every((header) => csv.headers.includes(header))) {
    throw new Error("El CSV no contiene las columnas esperadas o tiene cabeceras duplicadas");
  }
  if (document.products.length !== summary.totals.scrapedProducts ||
    csv.rows.length !== summary.totals.scrapedProducts) {
    throw new Error("Los totales de CSV, preparación y resumen no coinciden");
  }
  const csvRows = new Map<string, { providerId: string; reference: string }>();
  const references = new Set<string>();
  for (const row of csv.rows) {
    const url = row.url;
    if (!url || row.providerId !== options.providerId || csvRows.has(url)) {
      throw new Error("CSV con URLs repetidas o proveedor incorrecto");
    }
    const reference = referenceKey(row.reference ?? "");
    if (reference) {
      if (references.has(reference)) throw new Error("CSV con referencias duplicadas; revisar identidades");
      references.add(reference);
    }
    csvRows.set(url, { providerId: row.providerId, reference: row.reference ?? "" });
  }
  const urls = new Set<string>();
  let ready = 0;
  let review = 0;
  for (const entry of document.products) {
    const url = entry.product.sourceUrl;
    const csvRow = csvRows.get(url);
    if (!csvRow || urls.has(url) || referenceKey(entry.product.reference ?? "") !== referenceKey(csvRow.reference)) {
      throw new Error("El CSV y la preparación contienen productos diferentes");
    }
    urls.add(url);
    if (entry.status === "ready") {
      if (entry.product.condition !== "Segunda_Mano") throw new Error("Producto ready sin condición de importación compatible");
      if (entry.issues.length > 0) throw new Error("Producto marcado ready con incidencias");
      const candidateIssues = validateImportCandidate(entry.product, catalog);
      if (candidateIssues.length > 0) {
        throw new Error(`Producto ${entry.product.reference ?? url} marcado ready sin cumplir el contrato de importación: ${candidateIssues.join("; ")}`);
      }
      ready += 1;
    } else {
      review += 1;
    }
  }
  const warnings: string[] = [];
  if (review > 0) warnings.push(`${review} productos pendientes de revisión; no se deben importar`);
  if (ready === 0) warnings.push("Ningún producto preparado para importar");
  if (changes.suspectedMissing.length > 0) {
    warnings.push(`${changes.suspectedMissing.length} posibles bajas; no dar de baja automáticamente`);
  }
  return {
    providerId: options.providerId,
    checkedAt: new Date(checkedAt).toISOString(),
    summaryFile,
    productCount: document.products.length,
    ready, review,
    suspectedMissing: changes.suspectedMissing.length,
    status: warnings.length ? "review" : "passed",
    warnings
  };
};
