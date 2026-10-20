import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { dedupeBy, emptyDedupeReport, mergeDedupeReports } from "../../catalog/identity.js";
import { assessCatalogQuality, buildCatalogItems, categoryScope, compareCatalog, findIdentityConflicts, parseCatalogSnapshot } from "../../catalog/quality.js";
import type { CatalogSnapshot } from "../../catalog/quality.js";
import type { CategoryConfig, CategoryScrapeResult, Summary } from "../../contracts/scraping.js";

import { toCsv } from "../../shared/csv.js";
import { serializeCategoriesCsv, listSpecKeys, buildProductHeaders, toProductRow } from "./csv-serializer.js";
import { atomicWrite } from "../../infrastructure/filesystem/atomic-write.js";
import { prepareImportBatch } from "../../catalog/import/prepare.js";
import { loadImportCatalog } from "../../catalog/import/catalog-loader.js";

type ParentProduct = {
  readonly parent: CategoryConfig;
  readonly product: CategoryScrapeResult["products"][number];
};

type OutputGroup = {
  readonly parent: CategoryConfig;
  readonly results: readonly CategoryScrapeResult[];
};

export const writeCategoriesCsv = async (
  outDir: string,
  outPrefix: string,
  categories: readonly CategoryConfig[]
): Promise<void> => {
  await mkdir(outDir, { recursive: true });
  await atomicWrite(resolve(outDir, `${outPrefix}-categories.csv`), serializeCategoriesCsv(categories));
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
  const identityConflicts = findIdentityConflicts(allResults.flatMap((result) => result.products));
  const quality = assessCatalogQuality(allResults, currentProducts, previous, identityConflicts);
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
  const summaryFile = resolve(outDir, `${outPrefix}-summary.json`);
  await atomicWrite(resolve(outDir, `${outPrefix}-errors.json`), JSON.stringify({
    quality: quality.status, failures, identityConflicts
  }, null, 2));
  await atomicWrite(resolve(outDir, `${outputPrefix}-preparation.json`), preparationContent);

  if (!quality.published) {
    await atomicWrite(summaryFile, JSON.stringify(summary, null, 2));
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
  await atomicWrite(summaryFile, JSON.stringify(summary, null, 2));
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
