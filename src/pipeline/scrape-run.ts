import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ScraperProvider } from "../scraping/provider.js";
import type { CategoryConfig, CategoryScrapeResult, ScrapeOptions, Summary } from "../contracts/scraping.js";

import { writeCategoriesCsv, writeGroupedOutputs, writeOutputs } from "./publication/publish.js";

import { scrapeCategory, type ProductPageCache } from "../scraping/engine/scrape-category.js";

export type ScrapeRunSelection =
  | { readonly mode: "tree"; readonly rootUrl: string; readonly onlyCategories: boolean; readonly options: ScrapeOptions; readonly provider: ScraperProvider }
  | {
    readonly mode: "config";
    readonly categories: readonly CategoryConfig[];
    readonly discoverSubcategories: boolean;
    readonly onlyCategories: boolean;
    readonly options: ScrapeOptions;
    readonly provider: ScraperProvider;
  }
  | {
    readonly mode: "single";
    readonly category: CategoryConfig;
    readonly discoverSubcategories: boolean;
    readonly onlyCategories: boolean;
    readonly options: ScrapeOptions;
    readonly provider: ScraperProvider;
  };

type ScrapeRunReporter = {
  readonly verbose: boolean;
  start(total: number): void;
  beginCategory(category: CategoryConfig, position: number, count: number): void;
  listingProgress(pages: number, total: number): void;
  listingDone(total: number): void;
  productDone(done: number, total: number): void;
  endCategory(result: CategoryScrapeResult): void;
  finish(summary: Summary | null, startedAt: string, error: unknown, failureDetail: string | null): void;
  categoriesSaved(count: number): void;
};

const nowIso = (): string => new Date().toISOString();

const uniqueByUrl = (cats: readonly CategoryConfig[]): readonly CategoryConfig[] => {
  const map = new Map<string, CategoryConfig>();
  for (const c of cats) {
    if (!map.has(c.url)) map.set(c.url, c);
  }
  return [...map.values()];
};

const isSummary = (value: unknown): value is Summary => {
  if (typeof value !== "object" || value === null || !("totals" in value) ||
      !("quality" in value) || !("startedAt" in value) || !("endedAt" in value)) return false;
  if (typeof value.startedAt !== "string" || typeof value.endedAt !== "string") return false;
  const totals = value.totals;
  const quality = value.quality;
  if (typeof totals !== "object" || totals === null || typeof quality !== "object" || quality === null) return false;
  return "categories" in totals && typeof totals.categories === "number" &&
    "scrapedProductsRaw" in totals && typeof totals.scrapedProductsRaw === "number" &&
    "scrapedProducts" in totals && typeof totals.scrapedProducts === "number" &&
    "failures" in totals && typeof totals.failures === "number" &&
    "status" in quality && (quality.status === "complete" || quality.status === "partial" || quality.status === "blocked") &&
    "reasons" in quality && Array.isArray(quality.reasons) && quality.reasons.every((reason: unknown) => typeof reason === "string");
};

const readSummary = async (outDir: string, outPrefix: string, startedAt: string): Promise<Summary | null> => {
  try {
    const content = await readFile(resolve(outDir, `${outPrefix}-summary.json`), "utf8");
    const parsed: unknown = JSON.parse(content);
    return isSummary(parsed) && parsed.startedAt === startedAt ? parsed : null;
  } catch {
    return null;
  }
};

const readFirstFailure = async (outDir: string, outPrefix: string): Promise<string | null> => {
  try {
    const content = await readFile(resolve(outDir, `${outPrefix}-errors.json`), "utf8");
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null || !("failures" in parsed) || !Array.isArray(parsed.failures)) return null;
    for (const failure of parsed.failures) {
      if (typeof failure === "object" && failure !== null && "error" in failure && typeof failure.error === "string") return failure.error;
    }
    return null;
  } catch {
    return null;
  }
};

const scrapeSafely = async (
  category: CategoryConfig,
  options: ScrapeOptions,
  provider: ScraperProvider,
  cache: ProductPageCache,
  reporter: ScrapeRunReporter,
  position: number,
  count: number
): Promise<CategoryScrapeResult> => {
  reporter.beginCategory(category, position, count);
  let result: CategoryScrapeResult;
  try {
    result = await scrapeCategory(category, options, provider, cache, {
      verbose: reporter.verbose,
      onListingDone: (total) => reporter.listingDone(total),
      onListingProgress: (pages, total) => reporter.listingProgress(pages, total),
      onProductDone: (done, total) => reporter.productDone(done, total)
    });
  } catch (error) {
    result = { category, discoveredProductUrls: 0, products: [], failures: [{ url: category.url, error: String(error) }] };
  }
  reporter.endCategory(result);
  return result;
};

export const runScrape = async (selection: ScrapeRunSelection, reporter: ScrapeRunReporter): Promise<boolean> => {
  const startedAt = nowIso();
  const options = selection.options;
  const provider = selection.provider;
  const cache: ProductPageCache = new Map();

  const finish = async (write: () => Promise<void>): Promise<boolean> => {
    let error: unknown = null;
    try {
      await write();
    } catch (reason) {
      error = reason;
    }
    const summary = await readSummary(options.outDir, options.outPrefix, startedAt);
    const failureDetail = error !== null && summary ? await readFirstFailure(options.outDir, options.outPrefix) : null;
    reporter.finish(summary, startedAt, error, failureDetail);
    return error === null && summary?.quality?.status === "complete" && summary.quality.published === true;
  };

  if (selection.mode === "tree") {
    const cats = await provider.discoverCategoryTree(selection.rootUrl, options);
    reporter.start(cats.length);
    await writeCategoriesCsv(options.outDir, options.outPrefix, cats);

    if (selection.onlyCategories) {
      reporter.categoriesSaved(cats.length);
      return true;
    }

    const results: CategoryScrapeResult[] = [];
    for (let i = 0; i < cats.length; i += 1) {
      const c = cats[i]!;
      results.push(await scrapeSafely(c, options, provider, cache, reporter, i + 1, cats.length));
    }
    return finish(() => writeOutputs(options.outDir, options.outPrefix, results, startedAt, nowIso()));
  }

  if (selection.mode === "single") {
    if (!selection.discoverSubcategories) {
      reporter.start(1);
      const result = await scrapeSafely(selection.category, options, provider, cache, reporter, 1, 1);
      return finish(() => writeOutputs(options.outDir, options.outPrefix, [result], startedAt, nowIso()));
    }

    const discovered = await provider.discoverCategoryTree(selection.category.url, options);
    const toScrape = uniqueByUrl(discovered);
    reporter.start(toScrape.length);
    await writeCategoriesCsv(options.outDir, options.outPrefix, uniqueByUrl([selection.category, ...toScrape]));

    if (selection.onlyCategories) {
      reporter.categoriesSaved(uniqueByUrl([selection.category, ...toScrape]).length);
      return true;
    }

    const resultsForRoot: CategoryScrapeResult[] = [];
    for (let i = 0; i < toScrape.length; i += 1) {
      const c = toScrape[i]!;
      resultsForRoot.push(await scrapeSafely(c, options, provider, cache, reporter, i + 1, toScrape.length));
    }
    return finish(() => writeGroupedOutputs(
      options.outDir,
      options.outPrefix,
      [{ parent: selection.category, results: resultsForRoot }],
      startedAt,
      nowIso()
    ));
  }

  const roots = selection.categories;
  reporter.start(roots.length);
  if (roots.length === 0) {
    const keys = provider.categories.map((c) => c.key).join(", ");
    throw new Error(`categoryKey no encontrado. Disponibles: ${keys}`);
  }

  if (!selection.discoverSubcategories) {
    const results: CategoryScrapeResult[] = [];
    for (let i = 0; i < roots.length; i += 1) {
      const c = roots[i]!;
      results.push(await scrapeSafely(c, options, provider, cache, reporter, i + 1, roots.length));
    }
    return finish(() => writeOutputs(options.outDir, options.outPrefix, results, startedAt, nowIso()));
  }

  const groups: { parent: CategoryConfig; results: CategoryScrapeResult[] }[] = [];
  const allDiscoveredForCsv: CategoryConfig[] = [];

  for (const root of roots) {
    const discovered = await provider.discoverCategoryTree(root.url, options);
    const toScrape = uniqueByUrl(discovered);
    for (const c of uniqueByUrl([root, ...toScrape])) allDiscoveredForCsv.push(c);
    if (selection.onlyCategories) {
      groups.push({ parent: root, results: [] });
      continue;
    }

    const resultsForRoot: CategoryScrapeResult[] = [];
    for (let j = 0; j < toScrape.length; j += 1) {
      const c = toScrape[j]!;
      resultsForRoot.push(await scrapeSafely(c, options, provider, cache, reporter, j + 1, toScrape.length));
    }
    groups.push({ parent: root, results: resultsForRoot });
  }

  await writeCategoriesCsv(options.outDir, options.outPrefix, uniqueByUrl(allDiscoveredForCsv));
  if (selection.onlyCategories) {
    reporter.categoriesSaved(uniqueByUrl(allDiscoveredForCsv).length);
    return true;
  }

  return finish(() => writeGroupedOutputs(options.outDir, options.outPrefix, groups, startedAt, nowIso()));
};

