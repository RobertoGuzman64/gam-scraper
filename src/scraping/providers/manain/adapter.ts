import type { ScraperProvider } from "../../provider.js";
import { discoverManainSaleCatalog } from "./browser.js";
import { findReusableManainCensus } from "../../../infrastructure/filesystem/manain-census-storage.js";
import { loadManainProductViaCdp, manainCdpPort } from "./cdp.js";
import { fetchHtml } from "../../../infrastructure/http/fetch-html.js";
import { MANAIN_CATEGORIES, MANAIN_OPTIONS } from "./config.js";
import { extractManainSaleProductLinks } from "./listing.js";
import type { ManainListingResult } from "./listing.js";
import { parseManainProduct } from "./product.js";
import { discardedManainProductUrls } from "../../../catalog/preparation/evidence/providers/manain/discarded-urls.js";

const discardedManainUrls = new Set(discardedManainProductUrls);

export const requireCompleteManainListing = (
  listing: ManainListingResult
): { readonly urls: readonly string[]; readonly expectedTotal: number } => {
  if (!listing.complete || listing.endReason !== "control-exhausted") {
    throw new Error(`Manain: fin de catálogo sin acreditar (${listing.endReason}); se cancela la extracción de fichas`);
  }
  const urls = listing.urls.filter((url) => !discardedManainUrls.has(url));
  return { urls, expectedTotal: urls.length };
};

export const manainProvider: ScraperProvider = {
  id: "manain",
  categories: MANAIN_CATEGORIES,
  defaultOptions: MANAIN_OPTIONS,
  buildPagedUrl: (categoryUrl, page) => {
    if (page !== 1) throw new Error("Manain: la paginación requiere el descubrimiento con navegador");
    return categoryUrl;
  },
  extractProductLinksFromListing: extractManainSaleProductLinks,
  parseProductPage: parseManainProduct,
  loadProductHtml: (url, options) => manainCdpPort() !== null
    ? loadManainProductViaCdp(url, options)
    : fetchHtml(url, { timeoutMs: options.timeoutMs, userAgent: options.userAgent }),
  extractReference: () => null,
  discoverCategoryTree: async () => MANAIN_CATEGORIES,
  async discoverListing(category, options, onProgress) {
    const listing = await discoverManainSaleCatalog(category.url, options, onProgress);
    const reusable = await findReusableManainCensus(listing);
    if (reusable) {
      onProgress?.(reusable.pagesVisited, reusable.urls.length, "censo completo reutilizado");
      return requireCompleteManainListing(reusable);
    }
    return requireCompleteManainListing(listing);
  }
};
