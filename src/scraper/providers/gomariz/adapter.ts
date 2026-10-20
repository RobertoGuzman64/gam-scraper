import type { ScraperProvider } from "../contracts.js";
import { GOMARIZ_CATEGORIES, GOMARIZ_OPTIONS } from "./config.js";
import { buildGomarizPageUrl, extractGomarizLinks, parseGomarizProduct } from "./parsers.js";

export const gomarizProvider: ScraperProvider = {
  id: "gomariz",
  categories: GOMARIZ_CATEGORIES,
  defaultOptions: GOMARIZ_OPTIONS,
  buildPagedUrl: buildGomarizPageUrl,
  extractProductLinksFromListing: extractGomarizLinks,
  parseProductPage: parseGomarizProduct,
  extractReference: () => null,
  discoverCategoryTree: async () => GOMARIZ_CATEGORIES
};
