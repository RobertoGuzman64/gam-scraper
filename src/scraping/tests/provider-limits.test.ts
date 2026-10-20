import assert from "node:assert/strict";
import test from "node:test";
import { scrapeCategory } from "../engine/scrape-category.js";
import type { ScraperProvider } from "../provider.js";
import type { CategoryConfig } from "../../contracts/scraping.js";

const category: CategoryConfig = { key: "venta", name: "Maquinaria usada", url: "https://test.example/venta" };

test("limita concurrencia por proveedor aunque la CLI solicite más y rechaza fichas sin título", async () => {
  const options = {
    outDir: "", outPrefix: "", maxPages: 1, stallStopAfter: 1,
    concurrencyPages: 1, concurrencyProducts: 2, timeoutMs: 1000, delayMs: 0, userAgent: "test"
  };
  const provider: ScraperProvider = {
    id: "proveedor-prueba", categories: [category], defaultOptions: options,
    buildPagedUrl: (url) => url,
    extractProductLinksFromListing: () => Array.from({ length: 8 }, (_, i) => `https://test.example/maquina/${i}`),
    parseProductPage: (_html, url) => ({
      title: url.endsWith("/0") ? null : "Máquina", reference: url.split("/").at(-1) ?? null,
      price: null, shortDescription: null, longDescription: null, brand: null, model: null,
      year: null, location: null, country: null, horometer: null, serialNumber: null, image: null
    }),
    extractReference: () => null,
    discoverCategoryTree: async () => [category]
  };
  let active = 0;
  let maxActive = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return new Response("<html></html>", { status: 200 });
  };
  try {
    const result = await scrapeCategory(category, {
      ...options, concurrencyPages: 20, concurrencyProducts: 20
    }, provider);
    assert.equal(maxActive, 2);
    assert.equal(result.products.length, 7);
    assert.equal(result.failures.length, 2);
    assert.match(result.failures[0]?.error ?? "", /Límite de páginas/);
    assert.match(result.failures[1]?.error ?? "", /Ficha sin título/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
