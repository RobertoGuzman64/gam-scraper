import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Summary } from "../../../contracts/scraping.js";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import type { ScraperProvider } from "../../../scraping/provider.js";
import { GOMARIZ_CATEGORIES, GOMARIZ_OPTIONS } from "../../../scraping/providers/gomariz/config.js";
import { runScrape } from "../run.js";
import type { ScrapeRunReporter, ScrapeRunSelection } from "../types.js";

const prefix = GOMARIZ_OPTIONS.outPrefix;
const originalFiles = [`${prefix}-catalog.json`, `${prefix}-catalog.manifest.json`, `${prefix}-summary.json`] as const;
const productUrl = "https://www.gomarizrent.com/venta/fixture";

test("la extracción estándar consolida el original y una ejecución parcial posterior no lo sustituye", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-extraction-"));
  const previousDirectory = process.cwd();
  let expectedTotal = 1;
  const summaries: (Summary | null)[] = [];
  const provider: ScraperProvider = {
    id: "gomariz",
    categories: GOMARIZ_CATEGORIES,
    defaultOptions: GOMARIZ_OPTIONS,
    buildPagedUrl: (url) => url,
    extractProductLinksFromListing: () => [],
    extractReference: () => "TEST-1",
    discoverCategoryTree: async () => [],
    discoverListing: async () => ({ urls: [productUrl], expectedTotal }),
    loadProductHtml: async () => "<html></html>",
    parseProductPage: () => ({
      title: "Equipo de prueba",
      shortDescription: null,
      longDescription: null,
      price: null,
      brand: null,
      model: null,
      year: null,
      location: null,
      country: null,
      horometer: null,
      serialNumber: null,
      image: null
    })
  };
  const reporter: ScrapeRunReporter = {
    verbose: false,
    start: () => {},
    stage: () => {},
    beginCategory: () => {},
    listingProgress: () => {},
    listingDone: () => {},
    productDone: () => {},
    failure: () => {},
    endCategory: () => {},
    finish: (summary) => { summaries.push(summary); },
    categoriesSaved: () => {}
  };
  const sourceDir = join(root, "storage", "scraped", provider.id);
  const selection: ScrapeRunSelection = {
    mode: "config",
    provider,
    categories: GOMARIZ_CATEGORIES,
    discoverSubcategories: false,
    onlyCategories: false,
    options: { ...GOMARIZ_OPTIONS, outDir: sourceDir }
  };
  const portableDir = join(root, "catalogs", "providers", provider.id, "original");

  try {
    process.chdir(root);
    assert.equal(await runScrape(selection, reporter), true);
    assert.equal(summaries[0]?.quality?.status, "complete");
    assert.deepEqual((await readdir(portableDir)).sort(), [...originalFiles].sort());
    const originalContents = await Promise.all(originalFiles.map(async (filename) => {
      const source = await readFile(join(sourceDir, filename));
      const portable = await readFile(join(portableDir, filename));
      assert.deepEqual(portable, source);
      return portable;
    }));
    assert.equal((await readPortableOriginal(root, provider.id)).productCount, 1);

    expectedTotal = 2;
    assert.equal(await runScrape(selection, reporter), false);
    assert.equal(summaries[1]?.quality?.status, "partial");
    for (const [index, filename] of originalFiles.entries()) {
      assert.deepEqual(await readFile(join(portableDir, filename)), originalContents[index]);
    }
    assert.equal((await readPortableOriginal(root, provider.id)).productCount, 1);
  } finally {
    process.chdir(previousDirectory);
    await rm(root, { recursive: true, force: true });
  }
});
