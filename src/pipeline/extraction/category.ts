import { scrapeCategory, type ProductPageCache } from "../../scraping/engine/scrape-category.js";
import type { ScraperProvider } from "../../scraping/provider.js";
import type { CategoryConfig, CategoryScrapeResult, ScrapeOptions } from "../../contracts/scraping.js";
import type { ScrapeRunReporter } from "./types.js";

export const scrapeSafely = async (
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
      onListingProgress: (pages, total, stage) => reporter.listingProgress(pages, total, stage),
      onProductDone: (done, total) => reporter.productDone(done, total),
      onFailure: (stage, url, reason) => reporter.failure(stage, url, reason)
    });
  } catch (error) {
    result = { category, discoveredProductUrls: 0, products: [], failures: [{ url: category.url, error: error instanceof Error ? error.stack ?? error.message : String(error) }] };
  }
  reporter.endCategory(result);
  return result;
};

