import type { DedupeReport } from "./catalog.js";
import type { ProductRecord } from "./catalog.js";

export type CategoryConfig = {
  readonly key: string;
  readonly name: string;
  readonly url: string;
};

export type ScrapeOptions = {
  readonly outDir: string;
  readonly outPrefix: string;
  readonly maxPages: number;
  readonly stallStopAfter: number;
  readonly concurrencyPages: number;
  readonly concurrencyProducts: number;
  readonly timeoutMs: number;
  readonly delayMs: number;
  readonly userAgent: string;
};

export type CategoryScrapeResult = {
  readonly category: CategoryConfig;
  readonly discoveredProductUrls: number;
  readonly expectedProductUrls?: number;
  readonly products: readonly ProductRecord[];
  readonly failures: readonly { readonly url: string; readonly error: string }[];
};

export type Summary = {
  readonly quality?: {
    readonly status: "complete" | "partial" | "blocked";
    readonly reasons: readonly string[];
    readonly published: boolean;
  };
  readonly startedAt: string;
  readonly endedAt: string;
  readonly artifacts?: { readonly csvSha256: string; readonly preparationSha256: string; readonly catalogSha256?: string };
  readonly totals: {
    readonly categories: number;
    readonly discoveredProductUrls: number;
    readonly scrapedProductsRaw: number;
    readonly scrapedProductsByCategorySum: number;
    readonly scrapedProducts: number;
    readonly failures: number;
    readonly dedupe: {
      readonly withinCategories: DedupeReport;
      readonly globalAll: DedupeReport;
    };
  };
  readonly categories: readonly {
    readonly key: string;
    readonly name: string;
    readonly url: string;
    readonly discoveredProductUrls: number;
    readonly expectedProductUrls?: number;
    readonly scrapedProductsRaw: number;
    readonly scrapedProducts: number;
    readonly failures: number;
    readonly dedupe: DedupeReport;
  }[];
};