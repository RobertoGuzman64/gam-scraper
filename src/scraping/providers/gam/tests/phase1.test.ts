import assert from "node:assert/strict";
import test from "node:test";
import { parseProductPage } from "../parsers.js";

const base = "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6934-2007-jlg-e300ajp";

const fixture = (body: string): string => `<html><body><main><h1>JLG E300AJP</h1>${body}</main></body></html>`;

test("GAM: interpreta precios europeos y numéricos sin convertir textos de consulta", () => {
  const formatted = parseProductPage(fixture('<div class="product-prices"><div class="current-price"><span class="price">21.000,00 €</span></div></div>'), base);
  assert.equal(formatted.price, "21000");
  assert.equal(formatted.priceText, "21.000,00 €");
  const numeric = parseProductPage(fixture('<meta property="product:price:amount" content="25500"/>'), base);
  assert.equal(numeric.price, "25500");
  const unavailable = parseProductPage(fixture('<div class="product-prices">Precio a consultar</div>'), base);
  assert.equal(unavailable.price, null);
});

test("GAM: recupera un precio publicado en los datos estructurados del producto", () => {
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@type": "Product", name: "JLG E300AJP", offers: { "@type": "Offer", price: "21.000,00", priceCurrency: "EUR" }
  })}</script></head><body><h1>JLG E300AJP</h1></body></html>`;
  const parsed = parseProductPage(html, base);
  assert.equal(parsed.price, "21000");
});

test("GAM: conserva todas las fotografías distintas del carrusel en tamaño product_main_2x", () => {
  const html = fixture(`<div id="product"><div class="product-cover"><img src="/60451-product_main_2x/2007-jlg-e300ajp.jpg"/></div>
    <div class="product-images">
      <div class="thumb-container"><img class="js-thumb" data-image-large-src="/60451-large_default/2007-jlg-e300ajp.jpg"/></div>
      <div class="thumb-container"><img class="js-thumb" data-image-large-src="/60452-large_default/2007-jlg-e300ajp.jpg"/></div>
      <div class="thumb-container"><img class="js-thumb" data-image-large-src="/60453-home_default/2007-jlg-e300ajp.jpg"/></div>
    </div></div>`);
  const parsed = parseProductPage(html, base);
  assert.deepEqual(parsed.images, [60451, 60452, 60453].map((id) =>
    `https://online.gamrentals.com/${id}-product_main_2x/2007-jlg-e300ajp.jpg`
  ));
  assert.equal(parsed.image, parsed.images[0]);
});

test("GAM: lee galerías presentes en el contrato JSON del producto sin incluir relacionados", () => {
  const images = Array.from({ length: 20 }, (_, index) => ({
    bySize: {
      large_default: { url: `https://online.gamrentals.com/${60596 + index}-large_default/2007-jlg-800-aj.jpg` }
    }
  }));
  const data = JSON.stringify({ images });
  const html = fixture(`<div id="product"><div id="product-details" data-product='${data}'></div></div>
    <div class="related-products"><img src="https://online.gamrentals.com/123-other/otro.jpg" /></div>`);
  const parsed = parseProductPage(html, base);
  assert.equal(parsed.images.length, 20);
  assert.ok(parsed.images.every((image) => image.includes("-product_main_2x/2007-jlg-800-aj.jpg")));
  assert.ok(!parsed.images.some((image) => image.includes("otro.jpg")));
});

test("GAM: lee imágenes embebidas de PrestaShop cuando no hay miniaturas HTML", () => {
  const product = { images: [{ bySize: { product_main_2x: { url: "/60451-product_main_2x/2007-jlg-e300ajp.jpg" } } }] };
  const html = fixture(`<script>var prestashop = ${JSON.stringify({ product })};</script>`);
  assert.deepEqual(parseProductPage(html, base).images, ["https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg"]);
});

test("GAM: conserva etiquetas reales y descarta valores convertidos en etiquetas", () => {
  const html = fixture(`<dl>
    <dt>Garantía</dt><dd>12 meses</dd>
    <dt>Dimensiones Cesta</dt><dd>1,72X0,76</dd>
  </dl><table>
    <tr><td>12 meses</td><td>12 meses</td></tr>
    <tr><td>1,72X0,76</td><td>1 72X0 76</td></tr>
    <tr><th>Capacidad de carga (kg)</th><td>230 KG</td></tr>
  </table>`);
  const specs = parseProductPage(html, base).specs;
  assert.equal(specs.Garantía, "12 meses");
  assert.equal(specs["Dimensiones Cesta"], "1,72X0,76");
  assert.equal(specs["Capacidad de carga (kg)"], "230 KG");
  assert.equal(specs["12 meses"], undefined);
  assert.equal(specs["1,72X0,76"], undefined);
});
