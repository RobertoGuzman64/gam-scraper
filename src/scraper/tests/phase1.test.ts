import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveGamConverterOptions } from "../../converter/convertGamCsvToSeedTs.js";
import { resolveCliSelection } from "../cli.js";
import { writeOutputs } from "../io.js";
import { getProvider, listProviders } from "../providers/index.js";
import { scrapeCategory } from "../scrape.js";
import type { ScraperProvider } from "../providers/contracts.js";
import type { CategoryConfig, CategoryScrapeResult, ProductRecord } from "../types.js";

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
  assert.deepEqual(listProviders(), ["gam", "gomariz", "mercaeleva"]);
  assert.equal(resolveCliSelection([]).provider.id, "gam");
  assert.equal(resolveCliSelection(["--provider", "gam"]).provider, getProvider("gam"));
  assert.throws(() => resolveCliSelection(["--provider", "inexistente"]), /Proveedor no registrado/);
});

test("se mantienen los valores históricos del conversor GAM y admiten configuración", () => {
  const legacy = resolveGamConverterOptions(["input.csv", "out.ts", "categories.json"]);
  assert.equal(legacy.companyID, 208);
  assert.equal(legacy.idStart, 681);
  assert.equal(legacy.referencePrefix, "GAM-");

  const custom = resolveGamConverterOptions([
    "input.csv", "out.ts", "categories.json", "--companyID", "301", "--idStart", "10", "--referencePrefix", "PROV-"
  ]);
  assert.equal(custom.companyID, 301);
  assert.equal(custom.idStart, 10);
  assert.equal(custom.referencePrefix, "PROV-");
  assert.throws(() => resolveGamConverterOptions(["a", "b", "c", "--companyID", "0"]), /entero positivo/);
});

test("deduplicación separada por proveedor y exportación compatible", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scraper-phase1-"));
  try {
    await writeOutputs(dir, "test", [result([
      product("gam", "https://online.gamrentals.com/es/a"),
      product("gam", "https://online.gamrentals.com/es/a"),
      product("gomariz", "https://www.gomarizrent.com/a")
    ])], "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z");

    const summary = JSON.parse(await readFile(join(dir, "test-summary.json"), "utf8")) as {
      totals: { scrapedProducts: number; dedupe: { withinCategories: { removed: number }; globalAll: { removed: number } } };
    };
    const csv = await readFile(join(dir, "test-all.csv"), "utf8");
    assert.equal(summary.totals.scrapedProducts, 2);
    assert.equal(summary.totals.dedupe.withinCategories.removed, 1);
    assert.equal(summary.totals.dedupe.globalAll.removed, 0);
    assert.ok(csv.split("\n")[0]?.includes("providerId"));
    assert.ok(csv.includes("gam"));
    assert.ok(csv.includes("gomariz"));
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
