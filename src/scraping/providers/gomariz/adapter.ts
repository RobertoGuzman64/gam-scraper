import type { ScraperProvider } from "../../provider.js";
import { isGomarizOccasionSale } from "../../../catalog/normalization/gomariz-sale.js";
import { GOMARIZ_CATEGORIES, GOMARIZ_OPTIONS } from "./config.js";
import { buildGomarizPageUrl, extractGomarizLinks, parseGomarizProduct } from "./parsers.js";

export const gomarizProvider: ScraperProvider = {
  id: "gomariz",
  categories: GOMARIZ_CATEGORIES,
  defaultOptions: GOMARIZ_OPTIONS,
  buildPagedUrl: buildGomarizPageUrl,
  extractProductLinksFromListing: extractGomarizLinks,
  parseProductPage: parseGomarizProduct,
  resolveCondition: (category, condition, providerId) => condition ??
    (providerId === "gomariz" && isGomarizOccasionSale(category.url, category.key, category.name) ? "Segunda mano" : null),
  extractReference: () => null,
  discoverCategoryTree: async () => GOMARIZ_CATEGORIES
};
