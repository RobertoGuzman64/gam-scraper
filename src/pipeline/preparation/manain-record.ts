import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ProductRecord, SpecScalar, SpecsMap } from "../../contracts/catalog.js";
import type { PreparedProduct } from "../../catalog/preparation/contracts.js";
import { buildProductIdentity } from "../../catalog/identity.js";
import { prepareImportBatch } from "../../catalog/preparation/prepare.js";
import { discardedManainProductUrls } from "../../catalog/preparation/evidence/providers/manain/discarded-urls.js";
import { baseProductHeaders } from "../publication/csv-serializer.js";
import { parseCsv } from "../../shared/csv-parse.js";

export type ManainRecordOptions = {
  readonly source: string;
  readonly census: string;
  readonly out: string;
  readonly dryRun: boolean;
};

export type ManainRecord = {
  readonly providerId: "manain";
  readonly quality: { readonly status: "partial"; readonly published: false };
  readonly sourceCsvSha256: string;
  readonly discoveredProductUrls: number;
  readonly discardedUrls: readonly string[];
  readonly totals: { readonly ready: number; readonly review: number };
  readonly products: readonly { readonly original: ProductRecord; readonly prepared: PreparedProduct }[];
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const validText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const optionalText = (value: string | undefined): string | null => value?.trim() || null;
const scalar = (value: unknown): value is SpecScalar =>
  typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));

const parseSpecs = (value: string): SpecsMap => {
  const parsed: unknown = JSON.parse(value);
  if (!record(parsed)) throw new Error("Especificaciones originales inválidas");
  const specs: Record<string, SpecScalar | readonly SpecScalar[]> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (scalar(entry) || (Array.isArray(entry) && entry.every(scalar))) specs[key] = entry;
    else throw new Error(`Especificación original inválida: ${key}`);
  }
  return specs;
};

const parseStrings = (value: string, field: string): readonly string[] => {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((entry: unknown) => typeof entry === "string")) {
    throw new Error(`Campo original inválido: ${field}`);
  }
  return parsed;
};

const parseProduct = (row: Readonly<Record<string, string>>): ProductRecord => {
  const providerId = row.providerId;
  const categoryKey = row.categoryKey;
  const categoryName = row.categoryName;
  const url = row.url;
  const reference = optionalText(row.reference);
  if (providerId !== "manain" || !validText(categoryKey) || !validText(categoryName) || !validText(url) || !reference) {
    throw new Error(`Identidad de producto Manain incompleta: ${url ?? "sin URL"}`);
  }
  try { new URL(url); } catch { throw new Error(`URL original inválida: ${url}`); }
  const condition = optionalText(row.condition);
  if (condition !== null && condition !== "Nuevo" && condition !== "Segunda mano") {
    throw new Error(`Condición original inválida: ${reference}`);
  }
  const yearSource = optionalText(row.yearSource);
  if (yearSource !== null && yearSource !== "ficha" && yearSource !== "descripcion" && yearSource !== "titulo" && yearSource !== "url") {
    throw new Error(`Procedencia de año inválida: ${reference}`);
  }
  const scrapedAt = optionalText(row.scrapedAt);
  if (scrapedAt && !Number.isFinite(Date.parse(scrapedAt))) throw new Error(`Fecha de extracción inválida: ${reference}`);
  return {
    providerId, categoryKey, categoryName, url,
    title: optionalText(row.title),
    shortDescription: optionalText(row.shortDescription),
    longDescription: optionalText(row.longDescription),
    price: optionalText(row.price),
    priceText: optionalText(row.priceText),
    condition,
    breadcrumbs: parseStrings(row.breadcrumbsJson ?? "", "breadcrumbsJson"),
    subcategory: optionalText(row.subcategory),
    externalReference: optionalText(row.externalReference),
    shortDescriptionHtml: optionalText(row.shortDescriptionHtml),
    longDescriptionHtml: optionalText(row.longDescriptionHtml),
    technicalSheetUrl: optionalText(row.technicalSheetUrl),
    ...(scrapedAt === null ? {} : { scrapedAt }),
    yearSource,
    reference,
    brand: optionalText(row.brand),
    model: optionalText(row.model),
    year: optionalText(row.year),
    location: optionalText(row.location),
    country: optionalText(row.country),
    horometer: optionalText(row.horometer),
    serialNumber: optionalText(row.serialNumber),
    image: optionalText(row.image),
    images: parseStrings(row.imagesJson ?? "", "imagesJson"),
    specs: parseSpecs(row.specJson ?? "")
  };
};

const jsonFile = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));

export const buildManainRecord = (
  csv: string,
  summary: unknown,
  errors: unknown,
  census: unknown
): ManainRecord => {
  if (!record(summary) || !record(summary.quality) || !record(summary.totals) || !record(summary.artifacts) ||
    summary.quality.status !== "partial" || summary.quality.published !== false ||
    !Number.isSafeInteger(summary.totals.scrapedProducts) ||
    !Number.isSafeInteger(summary.totals.discoveredProductUrls) ||
    !Number.isSafeInteger(summary.totals.failures) ||
    summary.artifacts.csvSha256 !== sha256(csv)) {
    throw new Error("Resumen parcial de Manain inválido o CSV alterado");
  }
  if (!record(census) || census.type !== "manain-diagnostic-census" || census.providerId !== "manain" ||
    census.complete !== true || census.published !== false || census.endReason !== "control-exhausted" ||
    !Array.isArray(census.urls) || !census.urls.every(validText) ||
    census.urlCount !== census.urls.length) {
    throw new Error("Censo original de Manain incompleto o inválido");
  }
  if (!record(errors) || errors.quality !== "partial" || !Array.isArray(errors.failures) ||
    !errors.failures.every((item: unknown) => record(item) && item.categoryKey === "venta" && validText(item.url) && validText(item.error))) {
    throw new Error("Evidencia de errores de Manain inválida");
  }
  const parsed = parseCsv(csv.replace(/^\uFEFF/, ""));
  if (!baseProductHeaders.every((header) => parsed.headers.includes(header))) {
    throw new Error("CSV parcial sin todas las columnas de origen");
  }
  const products = parsed.rows.map(parseProduct);
  const censusUrls = new Set<string>(census.urls);
  const extractedUrls = new Set(products.map((product) => product.url));
  const discarded = new Set(discardedManainProductUrls);
  const failedUrls = new Set<string>(errors.failures.map((item: Record<string, unknown>) => String(item.url)));
  const identities = new Set(products.map((product) => buildProductIdentity(product).key));
  const missing = [...censusUrls].filter((url) => !extractedUrls.has(url));
  if (products.length === 0 || products.length !== summary.totals.scrapedProducts ||
    censusUrls.size !== census.urls.length || censusUrls.size !== summary.totals.discoveredProductUrls ||
    extractedUrls.size !== products.length || identities.size !== products.length ||
    products.some((product) => !censusUrls.has(product.url)) ||
    errors.failures.length !== summary.totals.failures || failedUrls.size !== errors.failures.length ||
    missing.length !== discarded.size || failedUrls.size !== discarded.size ||
    !missing.every((url) => failedUrls.has(url) && discarded.has(url)) ||
    [...failedUrls].some((url) => extractedUrls.has(url))) {
    throw new Error("Cobertura o identidades Manain no conciliadas con los descartes autorizados");
  }
  const prepared = prepareImportBatch(products);
  if (prepared.products.length !== products.length || prepared.totals.ready + prepared.totals.review !== products.length) {
    throw new Error("Preparación técnica Manain incompleta");
  }
  return {
    providerId: "manain",
    quality: { status: "partial", published: false },
    sourceCsvSha256: sha256(csv),
    discoveredProductUrls: censusUrls.size,
    discardedUrls: [...discardedManainProductUrls],
    totals: prepared.totals,
    products: products.map((original, index) => {
      const entry = prepared.products[index];
      if (!entry || entry.product.sourceUrl !== original.url || entry.product.reference !== original.reference) {
        throw new Error("Preparación Manain no corresponde al producto original");
      }
      return { original, prepared: entry };
    })
  };
};

export const prepareManainRecord = async (options: ManainRecordOptions): Promise<ManainRecord> => {
  const source = resolve(options.source);
  const summaryPath = source.replace(/-partial-all\.csv$/, "-summary.json");
  const errorsPath = source.replace(/-partial-all\.csv$/, "-errors.json");
  if (summaryPath === source || errorsPath === source) {
    throw new Error("El origen debe ser un fichero -partial-all.csv de Manain");
  }
  const [csv, summary, errors, census] = await Promise.all([
    readFile(source, "utf8"), jsonFile(summaryPath), jsonFile(errorsPath), jsonFile(resolve(options.census))
  ]);
  const result = buildManainRecord(csv, summary, errors, census);
  if (!options.dryRun) {
    const out = resolve(options.out);
    await mkdir(dirname(out), { recursive: true });
    const content = JSON.stringify(result, null, 2) + "\n";
    try {
      await writeFile(out, content, { flag: "wx" });
    } catch (error) {
      if (!record(error) || error.code !== "EEXIST" || await readFile(out, "utf8") !== content) throw error;
    }
  }
  return result;
};
