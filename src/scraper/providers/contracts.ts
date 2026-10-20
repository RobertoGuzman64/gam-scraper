import type { CategoryConfig, ProductRecord, ScrapeOptions } from "../types.js";

export type ParsedProduct = Omit<ProductRecord, "providerId" | "categoryKey" | "categoryName" | "url" | "reference"> & { readonly reference?: string | null };

export interface ScraperProvider {
  readonly id: string;
  readonly categories: readonly CategoryConfig[];
  readonly defaultOptions: ScrapeOptions;
  buildPagedUrl(categoryUrl: string, page: number): string;
  extractProductLinksFromListing(listingUrl: string, html: string): readonly string[];
  parseProductPage(html: string, pageUrl: string): ParsedProduct;
  extractReference(url: string): string | null;
  loadListingHtml?(url: string, options: ScrapeOptions): Promise<string>;
  discoverCategoryTree(rootUrl: string, options: ScrapeOptions): Promise<readonly CategoryConfig[]>;
}
