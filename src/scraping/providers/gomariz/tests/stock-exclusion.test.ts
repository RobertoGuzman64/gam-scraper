import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assessCatalogQuality, type CatalogSnapshot } from "../../../../catalog/quality.js";
import { writeOutputs } from "../../../output/publish.js";
import { scrapeCategory } from "../../../engine/scrape-category.js";
import { gomarizProvider } from "../adapter.js";
import { GOMARIZ_CATEGORIES, GOMARIZ_OPTIONS } from "../config.js";
import { gomarizStockExclusion } from "../parsers.js";

const category = GOMARIZ_CATEGORIES[0]!;
const sold = "https://www.gomarizrent.com/limpieza/barredora/johnston-cn201-2/";
const available = "https://www.gomarizrent.com/producto/pramac-gpw100i_fs2/";
const unavailableHtml = `<html><body><main><h1>Johnston CN201</h1>
  <p>Referencia: BR953 Categoría: Barredora, Limpieza</p><p class="stock out-of-stock">Sin existencias</p>
  <p>Año: 2015 Marca: Johnston Ver precio</p><h2>Descripción</h2><p>Barredora urbana.</p>
  <h2>Máquinas similares</h2></main></body></html>`;
const availableHtml = `<html><body><main><h1>PRAMAC GPW100I_FS2</h1>
  <p>Referencia: GR1354 Categoría: Generador</p><p>Año: 2023 Marca: Pramac Ver precio</p>
  <h2>Descripción</h2><p>Grupo electrógeno.</p></main></body></html>`;

test("Gomariz excluye solamente la señal de falta de existencias en la cabecera de la ficha", () => {
  assert.equal(gomarizStockExclusion(unavailableHtml, sold), "Sin existencias");
  assert.equal(gomarizStockExclusion(unavailableHtml.replace("Referencia: BR953 ", ""), sold), "Sin existencias");
  assert.equal(gomarizStockExclusion(availableHtml, available), null);
  assert.equal(gomarizStockExclusion(unavailableHtml.replace("Sin existencias", "En stock"), sold), null);
  assert.equal(gomarizStockExclusion(availableHtml.replace("Grupo electrógeno.", "Sin existencias en nuestras instalaciones."), available), null);
  assert.equal(gomarizStockExclusion(availableHtml.replace("</main>", "<h2>Máquinas similares</h2><p>Sin existencias</p></main>"), available), null);
  assert.equal(gomarizStockExclusion(availableHtml.replace("</body>", "<footer>Sin existencias</footer></body>"), available), null);
  assert.equal(gomarizStockExclusion("<html><body><p>Sin existencias</p></body></html>", sold), null);
});

test("Gomariz excluye la ficha agotada sin parsearla, sin fallos y con trazabilidad en el resumen", async () => {
  const pages = new Map([[sold, unavailableHtml], [available, availableHtml]]);
  const provider = {
    ...gomarizProvider,
    discoverListing: async () => ({ urls: [sold, available], expectedTotal: 2 }),
    loadProductHtml: async (url: string): Promise<string> => {
      const html = pages.get(url);
      if (!html) throw new Error(`URL no esperada: ${url}`);
      return html;
    },
    parseProductPage: (html: string, url: string) => {
      if (url === sold) throw new Error("No debe parsearse una ficha sin existencias");
      return gomarizProvider.parseProductPage(html, url);
    }
  };
  const result = await scrapeCategory(category, { ...GOMARIZ_OPTIONS, delayMs: 0 }, provider);
  assert.equal(result.discoveredProductUrls, 2);
  assert.deepEqual(result.products.map((product) => product.reference), ["GR1354"]);
  assert.deepEqual(result.exclusions, [{ url: sold, reason: "Sin existencias" }]);
  assert.deepEqual(result.failures, []);
  assert.equal(assessCatalogQuality([result], result.products, null).status, "complete");

  const directory = await mkdtemp(join(tmpdir(), "equipzilla-gomariz-stock-"));
  try {
    await writeOutputs(directory, "gomariz-stock", [result], "2026-11-11T10:00:00Z", "2026-11-11T10:01:00Z");
    const summary = JSON.parse(await readFile(join(directory, "gomariz-stock-summary.json"), "utf8"));
    const errors = JSON.parse(await readFile(join(directory, "gomariz-stock-errors.json"), "utf8"));
    const catalog = JSON.parse(await readFile(join(directory, "gomariz-stock-catalog.json"), "utf8"));
    assert.equal(summary.quality.status, "complete");
    assert.equal(summary.totals.discoveredProductUrls, 2);
    assert.equal(summary.totals.scrapedProducts, 1);
    assert.equal(summary.totals.excludedProductUrls, 1);
    assert.equal(summary.totals.failures, 0);
    assert.deepEqual(errors.exclusions, [{ categoryKey: "venta", url: sold, reason: "Sin existencias" }]);
    assert.deepEqual(errors.failures, []);
    assert.deepEqual(catalog.products.map((product: { readonly reference: string }) => product.reference), ["GR1354"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("una exclusión no puede encubrir pérdidas de cobertura ni suprimir el bloqueo por caída anómala", async () => {
  const provider = {
    ...gomarizProvider,
    discoverListing: async () => ({ urls: [sold], expectedTotal: 2 }),
    loadProductHtml: async () => unavailableHtml
  };
  const result = await scrapeCategory(category, { ...GOMARIZ_OPTIONS, delayMs: 0 }, provider);
  assert.equal(result.exclusions?.length, 1);
  assert.equal(result.failures.length, 1);
  assert.notEqual(assessCatalogQuality([result], result.products, null).status, "complete");
});

test("una bajada de volumen justificada por existencias no se confunde con una pérdida de cobertura", () => {
  const validProduct = {
    providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria de ocasión",
    url: available, reference: "GR1354", title: "PRAMAC GPW100I_FS2", shortDescription: null,
    longDescription: null, price: null, brand: null, model: null, year: null,
    location: null, country: null, horometer: null, serialNumber: null,
    image: null, images: [], specs: {}
  };
  const original = {
    category, discoveredProductUrls: 10, expectedProductUrls: 10,
    products: [validProduct], failures: [],
    exclusions: Array.from({ length: 9 }, (_, index) => ({
      url: `https://www.gomarizrent.com/producto/agotada-${index}/`, reason: "Sin existencias"
    }))
  };
  const previous: CatalogSnapshot = {
    version: 1, scope: "venta", createdAt: "2026-11-10T10:00:00Z",
    items: Array.from({ length: 10 }, (_, index) => ({ key: `gomariz:ref:${index}`, fingerprint: "hash" }))
  };
  assert.equal(assessCatalogQuality([original], [validProduct], previous).status, "complete");
  const incomplete = { ...original, discoveredProductUrls: 12, expectedProductUrls: 12 };
  assert.notEqual(assessCatalogQuality([incomplete], [validProduct], previous).status, "complete");
  const conflicting = { ...original, exclusions: [{ url: available, reason: "Sin existencias" }, ...original.exclusions.slice(1)] };
  assert.equal(assessCatalogQuality([conflicting], [validProduct], previous).status, "blocked");
});
