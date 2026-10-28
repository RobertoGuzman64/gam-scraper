import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../../infrastructure/filesystem/import-catalog-loader.js";
import { prepareProduct } from "../../../../catalog/import/preparation/prepare-product.js";
import { scrapeCategory } from "../../../engine/scrape-category.js";
import type { ScraperProvider } from "../../../provider.js";
import { manainProvider, requireCompleteManainListing } from "../adapter.js";
import type { ManainListingResult } from "../listing.js";

const catalogUrl = "https://manain.com/catalogo/venta/";
const firstUrl = "https://manain.com/producto/venta-movimiento-tierra-miniexcavadora-kubota-kx080-4a2-2/";
const secondUrl = "https://manain.com/producto/venta-movimiento-tierra-miniexcavadora-kubota-kx080-4a2/";

const fixture = (reference: string, year: number, hours: number): string => `<main><article class="product">
  <div class="summary"><h1>KUBOTA KX080-4A2</h1><div class="product_meta">
    <span class="sku_wrapper">SKU: <span class="sku">${reference}</span></span></div>
    <p class="price">Consultar precio</p>
    <div class="woocommerce-product-details__short-description">Miniexcavadora de 8,3 toneladas.</div></div>
  <table><tr><th>Marca</th><td>KUBOTA</td></tr><tr><th>Modelo</th><td>KX080-4A2</td></tr>
    <tr><th>Año</th><td>${year}</td></tr><tr><th>Horas</th><td>${hours}</td></tr>
    <tr><th>Nueva o usada</th><td>usada</td></tr></table>
  <div class="woocommerce-product-gallery"><a href="/wp-content/uploads/foto-${reference}.jpg"><img src="/wp-content/uploads/foto-${reference}.jpg"></a></div>
  <div class="related-products"><span class="sku">OTRA-UNIDAD</span></div>
</article></main>`;

test("Manain: un listado sin cierre acreditado no pasa al motor común", () => {
  const incomplete: ManainListingResult = {
    urls: [firstUrl], pagesVisited: 1, complete: false, endReason: "unverified-single-page"
  };
  assert.throws(() => requireCompleteManainListing(incomplete), /se cancela la extracción/);
  assert.throws(() => requireCompleteManainListing({
    ...incomplete, pagesVisited: 500, endReason: "page-limit"
  }), /page-limit/);
  assert.deepEqual(requireCompleteManainListing({
    urls: [firstUrl, secondUrl], pagesVisited: 2, complete: true, endReason: "control-exhausted"
  }), { urls: [firstUrl, secondUrl], expectedTotal: 2 });
  assert.equal(manainProvider.extractReference(firstUrl), null);
  assert.throws(() => manainProvider.buildPagedUrl(catalogUrl, 2), /navegador/);
});

test("Manain: motor y preparación conservan unidades distintas en una extracción aislada", async () => {
  const one = manainProvider.parseProductPage(fixture("MAN1802", 2023, 3280), firstUrl);
  const two = manainProvider.parseProductPage(fixture("MAN1268", 2022, 3377), secondUrl);
  const cache = new Map([
    [firstUrl, Promise.resolve(one)],
    [secondUrl, Promise.resolve(two)]
  ]);
  const isolated: ScraperProvider = {
    ...manainProvider,
    discoverListing: async () => ({ urls: [firstUrl, secondUrl], expectedTotal: 2 })
  };
  const result = await scrapeCategory(manainProvider.categories[0]!, manainProvider.defaultOptions, isolated, cache);
  assert.equal(result.discoveredProductUrls, 2);
  assert.equal(result.expectedProductUrls, 2);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.products.map((item) => item.reference), ["MAN1802", "MAN1268"]);
  assert.deepEqual(result.products.map((item) => item.year), ["2023", "2022"]);
  assert.ok(result.products.every((item) => item.providerId === "manain" && item.images?.length === 1));
  assert.ok(result.products.every((item) => item.condition === "Segunda mano"));
  const catalog = await loadImportCatalog();
  const prepared = result.products.map((item) => prepareProduct(item, catalog));
  assert.deepEqual(prepared.map((item) => item.product.reference), ["MAN1802", "MAN1268"]);
  assert.ok(prepared.every((item) => item.product.condition === "Segunda_Mano"));
  assert.ok(prepared.every((item) => item.product.categorySellID !== null));
});


test("Manain: el motor recibe las fichas mediante el lector propio sin hacer HTTP directo", async () => {
  const seen: string[] = [];
  const isolated: ScraperProvider = {
    ...manainProvider,
    discoverListing: async () => ({ urls: [firstUrl], expectedTotal: 1 }),
    loadProductHtml: async (url) => {
      seen.push(url);
      return fixture("MAN1802", 2023, 3280);
    }
  };
  const result = await scrapeCategory(manainProvider.categories[0]!, manainProvider.defaultOptions, isolated);
  assert.deepEqual(seen, [firstUrl]);
  assert.equal(result.products[0]?.reference, "MAN1802");
  assert.deepEqual(result.failures, []);
});
