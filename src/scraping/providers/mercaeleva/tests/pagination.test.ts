import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { writeOutputs } from "../../../../pipeline/publication/publish.js";
import { assessCatalogQuality } from "../../../../catalog/quality.js";
import { scrapeCategory } from "../../../engine/scrape-category.js";
import { buildMercaelevaCatalogScript } from "../browser.js";
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

type PageFixture = {
  readonly body: { innerText: string };
  readonly documentElement: { readonly outerHTML: string };
  querySelectorAll(selector: string): readonly { readonly href?: string; readonly disabled?: boolean; readonly title?: string; getAttribute?(name: string): string | null; click?(): void }[];
};

const simulateCatalog = async (pages: readonly (readonly string[])[], announced: number, maxPages = 10): Promise<unknown> => {
  let current = 0;
  const document: PageFixture = {
    body: { innerText: `Resultados: ${announced}` },
    documentElement: { get outerHTML() { return `<html data-page="${current + 1}"></html>`; } },
    querySelectorAll(selector) {
      if (selector === "a[href]") return (pages[current] ?? []).map((id) => ({ href: `${baseUrl}${id}` }));
      if (selector === "button") return [{
        disabled: current >= pages.length - 1,
        getAttribute: (key: string) => key === "aria-label" ? "Next page" : null,
        click: () => { current += 1; }
      }];
      return [];
    }
  };
  return runInNewContext(buildMercaelevaCatalogScript(maxPages, 100, 0), { document, URL, setTimeout });
};

test("Mercaeleva: recorre primera, intermedia y última página mediante botones", async () => {
  const result = await simulateCatalog([["M1", "M2"], ["M3", "M4"], ["M5"]], 5);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    pages: ["<html data-page=\"1\"></html>", "<html data-page=\"2\"></html>", "<html data-page=\"3\"></html>"],
    expectedTotal: 5
  });
});

test("Mercaeleva: detecta página repetida y paginación sin botón siguiente", async () => {
  await assert.rejects(simulateCatalog([["M1", "M2"], ["M1", "M2"]], 5, 2), /no hay página siguiente|tiempo agotado/);
  await assert.rejects(simulateCatalog([["M1", "M2"]], 5, 2), /no hay página siguiente/);
});

test("Mercaeleva: al llegar al límite de páginas no confunde la cobertura incompleta con una extracción completa", async () => {
  const result: unknown = await simulateCatalog([["M1", "M2"], ["M3", "M4"], ["M5"]], 5, 2);
  assert.ok(result && typeof result === "object" && "pages" in result && Array.isArray(result.pages));
  assert.equal(result.pages.length, 2);
});
