import type { ScraperProvider } from "../../scraping/provider.js";
import type { CategoryConfig, CategoryScrapeResult, ScrapeOptions, Summary } from "../../contracts/scraping.js";

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

export type ScrapeRunReporter = {
  readonly verbose: boolean;
  start(total: number): void;
  stage(stage: string, resource?: string): void;
  beginCategory(category: CategoryConfig, position: number, count: number): void;
  listingProgress(pages: number, total: number, stage?: string): void;
  listingDone(total: number): void;
  productDone(done: number, total: number): void;
  failure(stage: string, resource: string, reason: string): void;
  endCategory(result: CategoryScrapeResult): void;
  finish(summary: Summary | null, startedAt: string, error: unknown, failureDetail: string | null): void;
  categoriesSaved(count: number): void;
};
