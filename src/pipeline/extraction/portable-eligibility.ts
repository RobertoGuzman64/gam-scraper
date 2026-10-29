import { join, resolve } from "node:path";
import type { ScrapeRunSelection } from "./types.js";

/** Only the full, default provider run may update the repository's current original. */
export const isPortableExtraction = (selection: ScrapeRunSelection, root: string): boolean => {
  if (selection.mode !== "config" || selection.onlyCategories || selection.discoverSubcategories) return false;
  const defaults = selection.provider.defaultOptions;
  return resolve(selection.options.outDir) === join(resolve(root), "storage", "scraped", selection.provider.id) &&
    selection.options.outPrefix === defaults.outPrefix && selection.options.maxPages === defaults.maxPages &&
    selection.categories.length === selection.provider.categories.length &&
    selection.categories.every((item, index) => item.key === selection.provider.categories[index]?.key &&
      item.url === selection.provider.categories[index]?.url);
};
