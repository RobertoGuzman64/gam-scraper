import type { CategoryConfig, ScrapeOptions } from "../contracts/scraping.js";

import type { ProductRecord } from "../contracts/catalog.js";

export type ParsedProduct = Omit<ProductRecord, "providerId" | "categoryKey" | "categoryName" | "url" | "reference"> & { readonly reference?: string | null };

export interface ScraperProvider {
  readonly id: string;
  readonly categories: readonly CategoryConfig[];
  readonly defaultOptions: ScrapeOptions;
  buildPagedUrl(categoryUrl: string, page: number): string;
  extractProductLinksFromListing(listingUrl: string, html: string): readonly string[];
  extractExpectedTotalFromListing?(html: string): number | null;
  parseProductPage(html: string, pageUrl: string): ParsedProduct;
  extractReference(url: string): string | null;
  loadListingHtml?(url: string, options: ScrapeOptions): Promise<string>;
  discoverListing?(category: CategoryConfig, options: ScrapeOptions): Promise<{ readonly urls: readonly string[]; readonly expectedTotal: number }>;
  discoverCategoryTree(rootUrl: string, options: ScrapeOptions): Promise<readonly CategoryConfig[]>;
}
