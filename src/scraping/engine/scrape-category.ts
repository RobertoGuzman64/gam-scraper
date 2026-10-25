import type { CategoryConfig, CategoryScrapeResult, ScrapeOptions } from "../../contracts/scraping.js";
import type { ScraperProvider } from "../provider.js";
import { discoverProductUrls } from "./discover-listing.js";
import { scrapeProductPages } from "./scrape-products.js";
import type { ProductPageCache, ScrapeProgressCallbacks } from "./scrape-types.js";

export type { ProductPageCache, ScrapeProgressCallbacks } from "./scrape-types.js";

const nowIso = (): string => new Date().toISOString();

const log = (scope: string, msg: string, verbose: boolean): void => {
  if (verbose) console.log(`[${nowIso()}] ${scope} ${msg}`);
};

export const scrapeCategory = async (
  category: CategoryConfig,
  options: ScrapeOptions,
  provider: ScraperProvider,
  cache?: ProductPageCache,
  progress?: ScrapeProgressCallbacks
): Promise<CategoryScrapeResult> => {
  for (const [key, value] of [
    ["maxPages", options.maxPages],
    ["stallStopAfter", options.stallStopAfter],
    ["concurrencyPages", options.concurrencyPages],
    ["concurrencyProducts", options.concurrencyProducts]
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${key} debe ser un entero positivo`);
  }

  const concurrentPages = Math.min(options.concurrencyPages, provider.defaultOptions.concurrencyPages);
  const concurrentProducts = Math.min(options.concurrencyProducts, provider.defaultOptions.concurrencyProducts);
  const verbose = progress?.verbose ?? false;
  const report = (scope: string, message: string): void => log(scope, message, verbose);
  const failures: { url: string; error: string }[] = [];
  const recordFailure = (stage: string, url: string, error: string): void => {
    failures.push({ url, error });
    progress?.onFailure?.(stage, url, error);
  };
  const failureDetail = (error: unknown): string => error instanceof Error ? error.stack ?? error.message : String(error);

  const { urls, expectedProductUrls } = await discoverProductUrls(
    category, options, provider, concurrentPages, recordFailure, failureDetail, report, progress
  );
  progress?.onListingDone(urls.length);
  report("category", `productsStart key=${category.key} count=${urls.length}`);

  const scraped = await scrapeProductPages(
    category, options, provider, urls, concurrentProducts, cache, failureDetail, report, progress
  );
  failures.push(...scraped.failures);
  report("category", `end key=${category.key} ok=${scraped.products.length} fail=${failures.length}`);

  return {
    category,
    discoveredProductUrls: urls.length,
    ...(expectedProductUrls === undefined ? {} : { expectedProductUrls }),
    products: scraped.products,
    failures
  };
};
