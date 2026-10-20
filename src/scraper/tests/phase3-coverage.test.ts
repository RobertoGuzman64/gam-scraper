import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CATEGORIES } from "../providers/gam/config.js";
import {
  extractExpectedTotalFromListing,
  extractProductLinksFromListing,
  parseProductPage
} from "../providers/gam/parsers.js";
import { parseMercaelevaProduct } from "../providers/mercaeleva/parsers.js";
import { buildCatalogItems } from "../quality.js";
import type { ProductRecord } from "../types.js";

const listing = "https://online.gamrentals.com/es/34-carretillas-elevadoras-nuevas";
const productUrl = `${listing}/8000-carretilla-hyster.html`;

const sample = `
  <html><head><meta property="product:price:amount" content="21000.00"></head><body>
  <nav class="breadcrumb"><ol>
  <li>Inicio</li><li>Maquinaria nueva</li><li>Carretillas elevadoras</li><li>Diésel</li>
  </ol></nav>
  <main><h1>Carretilla elevadora Hyster H2.5A</h1>
  <div class="current-price"><span class="price">21.000,00 €</span></div>
  <div class="product-description-short"><p>Máquina nueva <strong>Hyster</strong>.</p></div>
  <div id="description"><p>Motor fiable y eficiente.</p></div>
  <dl><dt>Año de fabricación:</dt><dd></dd>
  <dt>Dimensiones Cesta:</dt><dd>1,22X0,76</dd>
  <dt>Potencia motor (kW):</dt><dd>35,5</dd>
  <dt>Motorización:</dt><dd>Diésel</dd>
  <dt>1930</dt><dd>Valor desplazado</dd>
  <dt>Referencia</dt><dd>GAM-02734</dd></dl>
  <table><tr><th>Tipo motor:</th><td>Combustión</td></tr></table>
  <div class="images-container">
  <a href="/img/101-large_default.jpg"><img src="/img/101-small_default.jpg" /></a>
  <img src="/img/101-product_main_2x.jpg" />
  <img src="/img/102-product_main_2x.jpg" />
  </div>
  <a href="/files/ficha-tecnica-8000.pdf">Descargar ficha técnica</a>
  </main></body></html>`;

test("GAM permite enlaces nuevos y comprueba el total anunciado", () => {
  const page = `<main><div class="total-products">Mostrando 1-12 de 57 artículo(s)</div>
    <div id="js-product-list"><div class="product-miniature"><a href="${productUrl}">Ficha</a></div></div></main>`;
  assert.equal(extractExpectedTotalFromListing(page), 57);
  assert.deepEqual(extractProductLinksFromListing(listing, page), [productUrl]);
  assert.ok(DEFAULT_CATEGORIES.some((category) => category.key === "marcas-nuevas"));
});

test("GAM identifica las fichas actuales sin .html y excluye páginas de categorías", () => {
  const currentUrl = "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6934-2007-jlg-e300ajp";
  const categoryUrl = "https://online.gamrentals.com/es/8-plataformas-elevadoras-segunda-mano";
  const html = `<main><div id="js-product-list"><div class="product-miniature">
    <a href="${currentUrl}">Ficha</a>
    <a href="${categoryUrl}">Categoría</a>
  </div></div></main>`;
  assert.deepEqual(extractProductLinksFromListing(categoryUrl, html), [currentUrl]);
});

test("GAM conserva fichas, estado, HTML, referencias, specs e imágenes 2x", () => {
  const parsed = parseProductPage(sample, productUrl);
  assert.equal(parsed.condition, "Nuevo");
  assert.equal(parsed.price, "21000");
  assert.equal(parsed.priceText, "21.000,00 €");
  assert.equal(parsed.subcategory, "Diésel");
  assert.equal(parsed.externalReference, "GAM-02734");
  assert.equal(parsed.technicalSheetUrl, "https://online.gamrentals.com/files/ficha-tecnica-8000.pdf");
  assert.match(parsed.shortDescriptionHtml ?? "", /<strong>Hyster<\/strong>/);
  assert.match(parsed.longDescriptionHtml ?? "", /Motor fiable/);
  assert.equal(parsed.specs["Dimensiones Cesta"], "1,22X0,76");
  assert.equal(parsed.specs["Potencia motor (kW)"], "35,5");
  assert.equal(parsed.specs["Motorización"], "Diésel");
  assert.equal(parsed.specs["Tipo motor"], "Combustión");
  assert.equal(parsed.specs["1930"], undefined);
  assert.equal(parsed.year, null);
  assert.deepEqual(parsed.images, [
    "https://online.gamrentals.com/img/101-product_main_2x.jpg",
    "https://online.gamrentals.com/img/102-product_main_2x.jpg"
  ]);
});

test("GAM no infiere precios ni años desde importes ausentes o pies de página", () => {
  const parsed = parseProductPage(`<html><body><h1>Máquina nueva</h1>
    <div class="current-price">Pedir presupuesto</div><footer>© 2026</footer></body></html>`, productUrl);
  assert.equal(parsed.price, null);
  assert.equal(parsed.priceText, "Pedir presupuesto");
  assert.equal(parsed.year, null);
});

test("Mercaeleva selecciona la imagen de mejor resolución para cada fotografía", () => {
  const url = "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M571-2568";
  const html = `<main><h1>Máquina JLG</h1><div class="machine-gallery">
    <img src="https://files2.machineric.com/images/1.jpg?width=100" data-large_image="https://files2.machineric.com/images/1.jpg?width=1800" />
    <img src="https://files2.machineric.com/images/2.jpg" />
    </div></main>`;
  const parsed = parseMercaelevaProduct(html, url);
  assert.deepEqual(parsed.images, [
    "https://files2.machineric.com/images/1.jpg?width=1800",
    "https://files2.machineric.com/images/2.jpg"
  ]);
});

test("scrapedAt no cambia la huella del producto entre ejecuciones", () => {
  const base: ProductRecord = {
    providerId: "gam", categoryKey: "elevacion", categoryName: "Elevación", url: productUrl,
    title: "Máquina", reference: "8000", price: null, shortDescription: null, longDescription: null,
    brand: null, model: null, year: null, location: null, country: null,
    horometer: null, serialNumber: null, image: null, scrapedAt: "2026-10-19T11:00:00Z"
  };
  assert.deepEqual(buildCatalogItems([base]), buildCatalogItems([{ ...base, scrapedAt: "2026-10-20T11:00:00Z" }]));
});
