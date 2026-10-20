import { fetchHtml } from "../../http.js";
import type { ScraperProvider } from "../contracts.js";
import { renderMercaelevaListing } from "./browser.js";
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
  async loadListingHtml(url, options) {
    const html = await fetchHtml(url, { timeoutMs: options.timeoutMs, userAgent: options.userAgent });
    if (extractMercaelevaLinks(url, html).length > 0) return html;
    const rendered = await renderMercaelevaListing(url, options.timeoutMs);
    if (extractMercaelevaLinks(url, rendered).length === 0 && !new URL(url).searchParams.has("page")) {
      throw new Error(`Mercaeleva no muestra enlaces de máquinas en el listado, incluso tras renderizar: ${url}`);
    }
    return rendered;
  }
};
