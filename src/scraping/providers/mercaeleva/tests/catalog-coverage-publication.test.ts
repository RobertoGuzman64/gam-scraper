import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeOutputs } from "../../../../pipeline/publication/publish.js";
import { assessCatalogQuality } from "../../../../catalog/quality.js";
import { scrapeCategory } from "../../../engine/scrape-category.js";
import type { ScraperProvider } from "../../../provider.js";
import type { CategoryConfig, ScrapeOptions } from "../../../../contracts/scraping.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";

const category: CategoryConfig = { key: "venta", name: "Maquinaria en venta", url: "https://sales.mercaeleva.com/es/for-sale" };
const options: ScrapeOptions = {
  outDir: "", outPrefix: "test", maxPages: 12, stallStopAfter: 2,
  concurrencyPages: 1, concurrencyProducts: 1, timeoutMs: 1000, delayMs: 0, userAgent: "test"
};
const baseUrl = "https://sales.mercaeleva.com/es/for-sale/machine/";
const product = (id: string): ProductRecord => ({
  providerId: "mercaeleva", categoryKey: category.key, categoryName: category.name,
  url: `${baseUrl}${id}`, reference: id, title: `Máquina ${id}`, shortDescription: "Máquina usada",
  longDescription: "Máquina usada", price: "1000", brand: "JLG", model: "450 AJ", year: "2015",
  location: null, country: null, horometer: null, serialNumber: null, image: `${baseUrl}${id}.jpg`
});

const providerFor = (ids: readonly string[], expectedTotal: number): ScraperProvider => ({
  id: "mercaeleva", categories: [category], defaultOptions: options,
  buildPagedUrl: (url) => url, extractProductLinksFromListing: () => [],
  parseProductPage: (_html, url) => ({ ...product(url.slice(baseUrl.length)) }),
  extractReference: (url) => url.slice(baseUrl.length),
  discoverCategoryTree: async () => [category],
  discoverListing: async () => ({ urls: ids.map((id) => `${baseUrl}${id}`), expectedTotal })
});

const withFetch = async (operation: () => Promise<void>): Promise<void> => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html></html>", { status: 200 });
  try { await operation(); } finally { globalThis.fetch = originalFetch; }
};

test("Mercaeleva: no publica un catálogo de 20 referencias si anuncia 221", async () => {
  await withFetch(async () => {
    const ids = Array.from({ length: 20 }, (_, i) => `M${i}`);
    const result = await scrapeCategory(category, options, providerFor(ids, 221));
    assert.equal(result.discoveredProductUrls, 20);
    assert.equal(result.expectedProductUrls, 221);
    assert.equal(result.products.length, 20);
    assert.match(result.failures[0]?.error ?? "", /20 de 221/);
    const quality = assessCatalogQuality([result], result.products, null);
    assert.equal(quality.status, "partial");
    assert.equal(quality.published, false);
    assert.ok(quality.reasons.some((reason) => reason.includes("20 de 221")));
  });
});

test("Mercaeleva: una extracción completa publica y una repetida conserva el CSV anterior", async () => {
  await withFetch(async () => {
    const dir = await mkdtemp(join(tmpdir(), "merca-pagination-"));
    try {
      const complete = await scrapeCategory(category, options, providerFor(["M1", "M2", "M3"], 3));
      assert.deepEqual(complete.failures, []);
      assert.equal(assessCatalogQuality([complete], complete.products, null).status, "complete");
      await writeOutputs(dir, "catalogo", [complete], "2026-10-20T10:00:00Z", "2026-10-20T10:01:00Z");
      const csv = await readFile(join(dir, "catalogo-all.csv"), "utf8");
      const incomplete = await scrapeCategory(category, options, providerFor(["M1", "M2"], 3));
      await assert.rejects(
        writeOutputs(dir, "catalogo", [incomplete], "2026-10-20T10:02:00Z", "2026-10-20T10:03:00Z"),
        /Extracción partial/
      );
      assert.equal(await readFile(join(dir, "catalogo-all.csv"), "utf8"), csv);
      const summary: unknown = JSON.parse(await readFile(join(dir, "catalogo-summary.json"), "utf8"));
      assert.ok(summary && typeof summary === "object" && "categories" in summary && Array.isArray(summary.categories));
      assert.equal(summary.categories[0]?.expectedProductUrls, 3);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

