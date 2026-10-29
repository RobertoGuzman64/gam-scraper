import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import type { ScraperProvider } from "../../../scraping/provider.js";
import { GOMARIZ_CATEGORIES, GOMARIZ_OPTIONS } from "../../../scraping/providers/gomariz/config.js";
import type { ScrapeRunSelection } from "../types.js";
import { isPortableExtraction } from "../portable-eligibility.js";

const root = join("/tmp", "equipzilla-workspace");
const provider: ScraperProvider = {
  id: "gomariz", categories: GOMARIZ_CATEGORIES, defaultOptions: GOMARIZ_OPTIONS,
  buildPagedUrl: (url) => url,
  extractProductLinksFromListing: () => [],
  parseProductPage: () => { throw new Error("No se extraen productos en esta prueba"); },
  extractReference: () => null,
  discoverCategoryTree: async () => []
};
const selection: ScrapeRunSelection = {
  mode: "config", provider, categories: GOMARIZ_CATEGORIES,
  onlyCategories: false, discoverSubcategories: false,
  options: { ...GOMARIZ_OPTIONS, outDir: join(root, "storage", "scraped", "gomariz") }
};

test("solo una extracción completa en destino estándar es consolidable", () => {
  assert.equal(isPortableExtraction(selection, root), true);
  assert.equal(isPortableExtraction({ ...selection, categories: [] }, root), false);
  assert.equal(isPortableExtraction({ ...selection, onlyCategories: true }, root), false);
  assert.equal(isPortableExtraction({ ...selection, discoverSubcategories: true }, root), false);
  assert.equal(isPortableExtraction({ ...selection,
    options: { ...selection.options, maxPages: 2 } }, root), false);
  assert.equal(isPortableExtraction({ ...selection,
    options: { ...selection.options, outPrefix: "prueba" } }, root), false);
  assert.equal(isPortableExtraction({ ...selection,
    options: { ...selection.options, outDir: join(root, "otro") } }, root), false);
});
