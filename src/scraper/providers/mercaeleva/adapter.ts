import type { ScraperProvider } from "../contracts.js";
import { renderMercaelevaCatalog } from "./browser.js";
import { MERCAELeVA_CATEGORIES, MERCAELeVA_OPTIONS } from "./config.js";
import { buildMercaelevaPageUrl, extractMercaelevaLinks, extractMercaelevaReference, parseMercaelevaProduct } from "./parsers.js";

export const mercaelevaProvider: ScraperProvider = {
  id: "mercaeleva",
  categories: MERCAELeVA_CATEGORIES,
  defaultOptions: MERCAELeVA_OPTIONS,
  buildPagedUrl: buildMercaelevaPageUrl,
  extractProductLinksFromListing: extractMercaelevaLinks,
  parseProductPage: parseMercaelevaProduct,
  extractReference: extractMercaelevaReference,
  discoverCategoryTree: async () => MERCAELeVA_CATEGORIES,
  async discoverListing(category, options) {
    const catalog = await renderMercaelevaCatalog(category.url, options.timeoutMs, options.maxPages, options.delayMs);
    const urls = new Set(catalog.pages.flatMap((html) => extractMercaelevaLinks(category.url, html)));
    return { urls: [...urls], expectedTotal: catalog.expectedTotal };
  }
};
