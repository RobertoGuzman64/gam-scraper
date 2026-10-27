import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dedupeBy } from "../../catalog/identity.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveCliSelection } from "../../cli/options/scrape.js";
import { writeOutputs } from "../../pipeline/publication/publish.js";
import { getProvider, listProviders } from "../registry.js";
import { scrapeCategory } from "../engine/scrape-category.js";
import type { ScraperProvider } from "../provider.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../contracts/scraping.js";

import type { ProductRecord } from "../../contracts/catalog.js";

const category: CategoryConfig = {
  key: "test",
  name: "Test",
  url: "https://example.test/listing"
};

const product = (providerId: string, url: string): ProductRecord => ({
  providerId,
  categoryKey: category.key,
  categoryName: category.name,
  url,
  title: "Máquina",
  shortDescription: null,
  longDescription: null,
  price: null,
  reference: "123",
  brand: null,
  model: null,
  year: null,
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  image: null,
  specs: {}
});

const result = (products: readonly ProductRecord[]): CategoryScrapeResult => ({
  category,
  discoveredProductUrls: products.length,
  products,
  failures: []
});

test("proveedor por defecto y fallo temprano para proveedores no registrados", () => {
  assert.deepEqual(listProviders(), ["gam", "gomariz", "mercaeleva", "manain"]);
  assert.equal(resolveCliSelection([]).provider.id, "gam");
  assert.equal(resolveCliSelection(["--provider", "gam"]).provider, getProvider("gam"));
  assert.throws(() => resolveCliSelection(["--provider", "inexistente"]), /Proveedor no registrado/);
});

test("deduplicación separada por proveedor y publicación canónica compatible", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scraper-compatibility-"));
  try {
    const gam = product("gam", "https://online.gamrentals.com/es/a");
    const gomariz = product("gomariz", "https://www.gomarizrent.com/a");
    const separated = dedupeBy([gam, gam, gomariz], (item) => item);
    assert.equal(separated.unique.length, 2);
    assert.equal(separated.report.removed, 1);
    assert.deepEqual(separated.unique.map((item) => item.providerId), ["gam", "gomariz"]);

    await writeOutputs(dir, "test", [result([
      gam, gam,
      { ...product("gam", "https://online.gamrentals.com/es/b"), reference: "456" }
    ])], "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z");
    await writeOutputs(dir, "gomariz", [result([gomariz])], "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z");

    const summary = JSON.parse(await readFile(join(dir, "test-summary.json"), "utf8")) as {
      totals: { scrapedProducts: number; dedupe: { withinCategories: { removed: number }; globalAll: { removed: number } } };
    };
    const csv = await readFile(join(dir, "test-all.csv"), "utf8");
    const gomarizCsv = await readFile(join(dir, "gomariz-all.csv"), "utf8");
    assert.equal(summary.totals.scrapedProducts, 2);
    assert.equal(summary.totals.dedupe.withinCategories.removed, 1);
    assert.equal(summary.totals.dedupe.globalAll.removed, 0);
    assert.ok(csv.split("\n")[0]?.includes("providerId"));
    assert.ok(csv.includes("gam"));
    assert.ok(!csv.includes("gomariz"));
    assert.ok(gomarizCsv.includes("gomariz"));
    assert.equal(JSON.parse(await readFile(join(dir, "test-catalog.json"), "utf8")).providerId, "gam");
    assert.equal(JSON.parse(await readFile(join(dir, "gomariz-catalog.json"), "utf8")).providerId, "gomariz");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("una publicación con proveedores mezclados no reemplaza un catálogo válido", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scraper-compatibility-"));
  const startedAt = "2026-01-01T00:00:00.000Z";
  const endedAt = "2026-01-01T00:00:01.000Z";
  try {
    await writeOutputs(dir, "test", [result([product("gam", "https://online.gamrentals.com/es/a")])], startedAt, endedAt);
    const catalogBefore = await readFile(join(dir, "test-catalog.json"), "utf8");
    const summaryBefore = await readFile(join(dir, "test-summary.json"), "utf8");
    await assert.rejects(writeOutputs(dir, "test", [result([
      product("gam", "https://online.gamrentals.com/es/a"),
      product("gomariz", "https://www.gomarizrent.com/a")
    ])], startedAt, endedAt), /proveedores distintos/);
    assert.equal(await readFile(join(dir, "test-catalog.json"), "utf8"), catalogBefore);
    assert.equal(await readFile(join(dir, "test-summary.json"), "utf8"), summaryBefore);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("la extracción usa el adaptador y registra fallos parciales del listado", async () => {
  const adapter: ScraperProvider = {
    id: "test",
    categories: [category],
    defaultOptions: getProvider("gam").defaultOptions,
    buildPagedUrl: (url, page) => `${url}?page=${page}`,
    extractProductLinksFromListing: () => ["https://example.test/product/123"],
    parseProductPage: () => ({
      title: "Máquina", shortDescription: null, longDescription: null, price: null,
      brand: null, model: null, year: null, location: null, country: null,
      horometer: null, serialNumber: null, image: null, specs: {}
    }),
    extractReference: () => "123",
    discoverCategoryTree: async () => [category]
  };
  const options = { ...adapter.defaultOptions, concurrencyPages: 2, maxPages: 2, delayMs: 0 };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("page=2")) return new Response("No encontrado", { status: 404 });
    return new Response("<html></html>", { status: 200 });
  };
  try {
    const data = await scrapeCategory(category, options, adapter);
    assert.equal(data.products.length, 1);
    assert.equal(data.products[0]?.providerId, "test");
    assert.equal(data.failures.length, 2);
    assert.match(data.failures[0]?.url ?? "", /page=2/);
    assert.match(data.failures[1]?.error ?? "", /Límite de páginas/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("si fallan todos los listados se interrumpe la extracción", async () => {
  const adapter = getProvider("gam");
  const options = { ...adapter.defaultOptions, concurrencyPages: 1, maxPages: 1, delayMs: 0 };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("No encontrado", { status: 404 });
  try {
    await assert.rejects(scrapeCategory(adapter.categories[0]!, options, adapter), /No se pudo leer ninguna página/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("se rechaza concurrencia inválida antes de iniciar peticiones", async () => {
  const provider = getProvider("gam");
  await assert.rejects(scrapeCategory(category, { ...provider.defaultOptions, concurrencyPages: 0 }, provider), /concurrencyPages/);
});
