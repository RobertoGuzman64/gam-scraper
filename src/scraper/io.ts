import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { buildProductIdentity } from "./identity.js";
import { assessCatalogQuality, buildCatalogItems, categoryScope, compareCatalog, parseCatalogSnapshot } from "./quality.js";
import type { CatalogSnapshot } from "./quality.js";
import type {
  CategoryConfig,
  CategoryScrapeResult,
  DedupeReason,
  DedupeReport,
  SpecScalar,
  SpecValue,
  SpecsMap,
  Summary
} from "./types.js";
import { toCsv } from "../shared/csv.js";
import { loadImportCatalog, prepareImportBatch } from "../import/prepare.js";

const baseProductHeaders = [
  "categoryKey",
  "categoryName",
  "title",
  "shortDescription",
  "longDescription",
  "price",
  "reference",
  "brand",
  "model",
  "year",
  "location",
  "country",
  "horometer",
  "serialNumber",
  "image",
  "url",
  "specJson",
  "providerId",
  "imagesJson"
] as const;

const categoryHeaders = ["categoryKey", "categoryName", "categoryUrl"] as const;

type CategoryHeader = (typeof categoryHeaders)[number];
type CategoryCsvRow = Record<CategoryHeader, string>;

type ParentProduct = {
  readonly parent: CategoryConfig;
  readonly product: CategoryScrapeResult["products"][number];
};

const normalizeSpecKey = (s: string): string => s.trim().replace(/\s+/g, " ");

const specColumnName = (specKey: string): string => `spec__${specKey}`;

const specScalarToString = (v: SpecScalar): string => {
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};

const specValueToString = (v: SpecValue): string => {
  if (Array.isArray(v)) return v.map(specScalarToString).join(" | ");
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return specScalarToString(v);
  return "";
};

const normalizeSpecs = (specs: SpecsMap): Record<string, SpecValue> => {
  const out: Record<string, SpecValue> = {};
  for (const [k, v] of Object.entries(specs)) out[normalizeSpecKey(k)] = v;
  return out;
};

const listSpecKeys = (products: readonly { readonly specs?: SpecsMap }[]): string[] => {
  const set = new Set<string>();
  for (const p of products) {
    const specs = p.specs;
    if (!specs) continue;
    for (const k of Object.keys(specs)) set.add(normalizeSpecKey(k));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
};

const buildProductHeaders = (specKeys: readonly string[]): readonly string[] => [
  ...baseProductHeaders,
  ...specKeys.map(specColumnName)
];

const emptyDedupeReport = (): DedupeReport => ({
  kept: 0,
  removed: 0,
  byReason: { reference: 0, serialNumber: 0, canonicalUrl: 0 }
});

const mergeDedupeReports = (a: DedupeReport, b: DedupeReport): DedupeReport => ({
  kept: a.kept + b.kept,
  removed: a.removed + b.removed,
  byReason: {
    reference: a.byReason.reference + b.byReason.reference,
    serialNumber: a.byReason.serialNumber + b.byReason.serialNumber,
    canonicalUrl: a.byReason.canonicalUrl + b.byReason.canonicalUrl
  }
});

const dedupeBy = <T>(
  items: readonly T[],
  getEntity: (item: T) => CategoryScrapeResult["products"][number]
): { readonly unique: T[]; readonly report: DedupeReport } => {
  const seen = new Set<string>();
  const unique: T[] = [];
  const byReason: Record<DedupeReason, number> = { reference: 0, serialNumber: 0, canonicalUrl: 0 };

  for (const item of items) {
    const k = buildProductIdentity(getEntity(item));
    if (seen.has(k.key)) {
      byReason[k.reason] += 1;
      continue;
    }
    seen.add(k.key);
    unique.push(item);
  }

  return {
    unique,
    report: {
      kept: unique.length,
      removed: items.length - unique.length,
      byReason
    }
  };
};

export const writeCategoriesCsv = async (
  outDir: string,
  outPrefix: string,
  categories: readonly CategoryConfig[]
): Promise<void> => {
  await mkdir(outDir, { recursive: true });

  const rows = categories.map<CategoryCsvRow>((c) => ({
    categoryKey: c.key,
    categoryName: c.name,
    categoryUrl: c.url
  }));

  const csv = toCsv(rows, categoryHeaders);
  await atomicWrite(resolve(outDir, `${outPrefix}-categories.csv`), csv);
};

const toProductRow = (
  category: CategoryConfig,
  p: CategoryScrapeResult["products"][number],
  specKeys: readonly string[]
): Record<string, string> => {
  const specs: SpecsMap = p.specs ?? {};
  const specsNorm = normalizeSpecs(specs);
  const specJson = JSON.stringify(specs) ?? "{}";

  const row: Record<string, string> = {
    categoryKey: category.key,
    categoryName: category.name,
    title: p.title ?? "",
    shortDescription: p.shortDescription ?? "",
    longDescription: p.longDescription ?? "",
    price: p.price ?? "",
    reference: p.reference ?? "",
    brand: p.brand ?? "",
    model: p.model ?? "",
    year: p.year ?? "",
    location: p.location ?? "",
    country: p.country ?? "",
    horometer: p.horometer ?? "",
    serialNumber: p.serialNumber ?? "",
    image: p.image ?? "",
    url: p.url,
    specJson,
    providerId: p.providerId,
    imagesJson: JSON.stringify(p.images ?? (p.image ? [p.image] : []))
  };

  for (const k of specKeys) {
    const v = specsNorm[k];
    row[specColumnName(k)] = v === undefined ? "" : specValueToString(v);
  }

  return row;
};

type OutputGroup = {
  readonly parent: CategoryConfig;
  readonly results: readonly CategoryScrapeResult[];
};

const atomicWrite = async (filePath: string, content: string): Promise<void> => {
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, "utf8");
  try {
    await rename(temporary, filePath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
};

const loadSnapshot = async (filePath: string, scope: string): Promise<CatalogSnapshot | null> => {
  try {
    return parseCatalogSnapshot(await readFile(filePath, "utf8"), scope);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
};

const writeResultGroups = async (
  outDir: string,
  outPrefix: string,
  groups: readonly OutputGroup[],
  startedAt: string,
  endedAt: string,
  grouped: boolean
): Promise<void> => {
  await mkdir(outDir, { recursive: true });
  const scope = categoryScope(groups.map((group) => group.parent), grouped ? "grouped" : "flat");
  const snapshotFile = resolve(outDir, `${outPrefix}-snapshot-${scope}.json`);
  const previous = await loadSnapshot(snapshotFile, scope);
  const allResults = groups.flatMap((group) => [...group.results]);
  const allProductsPreGlobal: ParentProduct[] = [];
  const categoryData: { readonly parent: CategoryConfig; readonly products: readonly CategoryScrapeResult["products"][number][] }[] = [];
  const categorySummaries: Summary["categories"][number][] = [];
  let withinCategories = emptyDedupeReport();

  for (const group of groups) {
    const rawProducts = group.results.flatMap((result) => [...result.products]);
    const deduped = dedupeBy(rawProducts, (product) => product);
    withinCategories = mergeDedupeReports(withinCategories, deduped.report);
    for (const product of deduped.unique) allProductsPreGlobal.push({ parent: group.parent, product });
    categoryData.push({ parent: group.parent, products: deduped.unique });
    categorySummaries.push({
      key: group.parent.key,
      name: group.parent.name,
      url: group.parent.url,
      discoveredProductUrls: group.results.reduce((sum, result) => sum + result.discoveredProductUrls, 0),
      ...(group.results.length === 1 && group.results[0]?.expectedProductUrls !== undefined
        ? { expectedProductUrls: group.results[0].expectedProductUrls } : {}),
      scrapedProductsRaw: rawProducts.length,
      scrapedProducts: deduped.unique.length,
      failures: group.results.reduce((sum, result) => sum + result.failures.length, 0),
      dedupe: deduped.report
    });
  }

  const global = dedupeBy(allProductsPreGlobal, (entry) => entry.product);
  const currentProducts = global.unique.map((entry) => entry.product);
  const quality = assessCatalogQuality(allResults, currentProducts, previous);
  const catalog = await loadImportCatalog();
  const preparation = prepareImportBatch(currentProducts, catalog);
  const outputPrefix = quality.published ? outPrefix : `${outPrefix}-partial`;

  if (!grouped) {
    await writeCategoriesCsv(outDir, outputPrefix, groups.map((group) => group.parent));
  }

  for (const { parent, products } of categoryData) {
    const specKeys = listSpecKeys(products);
    await atomicWrite(resolve(outDir, `${outputPrefix}-${parent.key}.csv`), toCsv(
      products.map((product) => toProductRow(parent, product, specKeys)), buildProductHeaders(specKeys)
    ));
  }
  const globalSpecKeys = listSpecKeys(currentProducts);
  const aggregateCsv = toCsv(
    global.unique.map(({ parent, product }) => toProductRow(parent, product, globalSpecKeys)),
    buildProductHeaders(globalSpecKeys)
  );
  await atomicWrite(resolve(outDir, `${outputPrefix}-all.csv`), aggregateCsv);
  const preparationContent = JSON.stringify({
    quality: quality.status, published: quality.published, ...preparation
  }, null, 2);
  const hash = (content: string): string => createHash("sha256").update(content).digest("hex");

  const summary: Summary = {
    startedAt,
    endedAt,
    quality,
    artifacts: { csvSha256: hash(aggregateCsv), preparationSha256: hash(preparationContent) },
    totals: {
      categories: groups.length,
      discoveredProductUrls: categorySummaries.reduce((sum, category) => sum + category.discoveredProductUrls, 0),
      scrapedProductsRaw: categorySummaries.reduce((sum, category) => sum + category.scrapedProductsRaw, 0),
      scrapedProductsByCategorySum: categorySummaries.reduce((sum, category) => sum + category.scrapedProducts, 0),
      scrapedProducts: currentProducts.length,
      failures: categorySummaries.reduce((sum, category) => sum + category.failures, 0),
      dedupe: { withinCategories, globalAll: global.report }
    },
    categories: categorySummaries
  };
  const failures = allResults.flatMap((result) => result.failures.map((failure) => ({
    categoryKey: result.category.key,
    ...failure
  })));
  await atomicWrite(resolve(outDir, `${outPrefix}-summary.json`), JSON.stringify(summary, null, 2));
  await atomicWrite(resolve(outDir, `${outPrefix}-errors.json`), JSON.stringify({
    quality: quality.status, failures
  }, null, 2));
  await atomicWrite(resolve(outDir, `${outputPrefix}-preparation.json`), preparationContent);

  if (!quality.published) {
    await atomicWrite(resolve(outDir, `${outPrefix}-changes.json`), JSON.stringify({
      status: "not-comparable", reasons: quality.reasons, suspectedMissing: []
    }, null, 2));
    throw new Error(`Extracción ${quality.status}: ${quality.reasons.join("; ")}. Los CSV anteriores se conservan; revisar ${outPrefix}-summary.json`);
  }

  const items = buildCatalogItems(currentProducts);
  const changes = compareCatalog(previous, items);
  await atomicWrite(resolve(outDir, `${outPrefix}-changes.json`), JSON.stringify({
    status: "comparable", scope, ...changes
  }, null, 2));
  await atomicWrite(snapshotFile, JSON.stringify({ version: 1, scope, createdAt: endedAt, items } satisfies CatalogSnapshot, null, 2));
};

export const writeGroupedOutputs = async (
  outDir: string,
  outPrefix: string,
  groups: readonly OutputGroup[],
  startedAt: string,
  endedAt: string
): Promise<void> => writeResultGroups(outDir, outPrefix, groups, startedAt, endedAt, true);

export const writeOutputs = async (
  outDir: string,
  outPrefix: string,
  results: readonly CategoryScrapeResult[],
  startedAt: string,
  endedAt: string
): Promise<void> => writeResultGroups(outDir, outPrefix, results.map((result) => ({
  parent: result.category, results: [result]
})), startedAt, endedAt, false);
