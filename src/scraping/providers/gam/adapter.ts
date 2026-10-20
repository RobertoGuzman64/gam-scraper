import type { ScraperProvider } from "../../provider.js";
import { DEFAULT_CATEGORIES, DEFAULT_OPTIONS } from "./config.js";
import { buildPagedUrl, extractExpectedTotalFromListing, extractProductLinksFromListing, parseProductPage } from "./parsers.js";
import { discoverCategoryTree } from "./tree.js";

const extractReference = (url: string): string | null => {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).at(-1);
    return last?.match(/^(\d+)-/)?.[1] ?? null;
  } catch {
    return null;
  }
};

export const gamProvider: ScraperProvider = {
  id: "gam",
  categories: DEFAULT_CATEGORIES,
  defaultOptions: DEFAULT_OPTIONS,
  buildPagedUrl,
  extractProductLinksFromListing,
  extractExpectedTotalFromListing,
  parseProductPage,
  extractReference,
  discoverCategoryTree
};
