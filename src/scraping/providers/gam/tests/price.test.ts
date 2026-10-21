import assert from "node:assert/strict";
import test from "node:test";
import { parseProductPage } from "../parsers.js";

const auctionUrl = "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6934-2007-jlg-e300ajp";
const standardUrl = "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6945-2007-jlg-800-aj";

const page = (main: string, head = "", header = ""): string =>
  `<html><head>${head}</head><body><header>${header}</header><main><h1>JLG E300AJP</h1>${main}</main></body></html>`;

const related = `<section class="related-products"><article class="product-miniature">
  <div class="current-price"><span itemprop="price" content="21000" class="price">21.000,00 €</span></div>
  <div class="product-price">21.000,00 €</div>
</article></section>`;

test("GAM: una ficha en subasta no hereda el precio de productos relacionados", () => {
  const html = page(`<section class="product-information">Para participar en la subasta:
    <a>Regístrate</a><a>Inicia sesión</a></section>${related}`);
  const result = parseProductPage(html, auctionUrl);
  assert.equal(result.price, null);
  assert.equal(result.priceText, "Para participar en la subasta:");
});

test("GAM: no confunde la puja con un precio de venta aunque existan metadatos antiguos", () => {
  const html = page(`<section class="product-information">Para participar en la subasta:</section>
    <div class="current-price"><span class="price">Puja actual 12.000,00 €</span></div>${related}`,
  '<meta property="product:price:amount" content="21000" />');
  const result = parseProductPage(html, auctionUrl);
  assert.equal(result.price, null);
  assert.equal(result.priceText, "Para participar en la subasta:");
});

test("GAM: el enlace general de subastas no cambia el precio de una ficha de venta", () => {
  const html = page('<div class="current-price"><span class="price">25.500,00 €</span></div>', "",
    "Para participar en la subasta: Regístrate");
  const result = parseProductPage(html, standardUrl);
  assert.equal(result.price, "25500");
  assert.equal(result.priceText, "25.500,00 €");
});

test("GAM: sin precio propio no extrae importes de productos recomendados", () => {
  const result = parseProductPage(page(`${related}<div class="product-information">Pedir presupuesto</div>`), auctionUrl);
  assert.equal(result.price, null);
  assert.equal(result.priceText, null);
});

test("GAM: preserva el precio propio y su texto frente a los relacionados", () => {
  const html = page(`<div class="product-prices"><div class="current-price">
    <span class="price">26.400,00 €</span></div></div>${related}`);
  const result = parseProductPage(html, standardUrl);
  assert.equal(result.price, "26400");
  assert.equal(result.priceText, "26.400,00 €");
});

test("GAM: el texto monetario solo acompaña a su precio, nunca al de otro producto", () => {
  const html = page(related, '<meta property="product:price:amount" content="25500.00">');
  const result = parseProductPage(html, standardUrl);
  assert.equal(result.price, "25500");
  assert.equal(result.priceText, "25500.00");
});

test("GAM: los datos estructurados requieren identidad del producto", () => {
  const unrelated = JSON.stringify({
    "@type": "Product",
    name: "Otra máquina",
    url: "https://online.gamrentals.com/es/plataformas/6000-otra-maquina",
    offers: { "@type": "Offer", price: "21000", priceCurrency: "EUR" }
  });
  const result = parseProductPage(page(related, `<script type="application/ld+json">${unrelated}</script>`), auctionUrl);
  assert.equal(result.price, null);
});

test("GAM: encuentra el producto correcto en @graph y conserva precios europeos", () => {
  const graph = JSON.stringify({
    "@graph": [
      { "@type": "Product", name: "Otra máquina", offers: { price: "21000", priceCurrency: "EUR" } },
      { "@type": "Product", name: "JLG E300AJP", url: `${auctionUrl}#product`,
        offers: { "@type": "Offer", priceSpecification: { price: "21.000,00" }, priceCurrency: "EUR" } }
    ]
  });
  const result = parseProductPage(page(related, `<script type="application/ld+json">${graph}</script>`), auctionUrl);
  assert.equal(result.price, "21000");
  assert.equal(result.priceText, "21000");
});

test("GAM: no mezcla una oferta en divisa distinta con un precio EUR", () => {
  const graph = JSON.stringify({
    "@type": "Product", name: "JLG E300AJP",
    offers: [
      { price: "10000", priceCurrency: "USD" },
      { price: "21,000.50", priceCurrency: "EUR" }
    ]
  });
  const result = parseProductPage(page("", `<script type="application/ld+json">${graph}</script>`), auctionUrl);
  assert.equal(result.price, "21000.5");
});

test("GAM: pujas mostradas como importe no se tratan como precio de venta", () => {
  const result = parseProductPage(page('<div class="current-price">Puja mínima 15.000,00 €</div>'), auctionUrl);
  assert.equal(result.price, null);
  assert.equal(result.priceText, "Puja mínima 15.000,00 €");
});

test("GAM: conserva precios que se publican en tablas de término y definición", () => {
  const result = parseProductPage(page("<dl><dt>Precio:</dt><dd>18.500,00 €</dd></dl>"), standardUrl);
  assert.equal(result.price, "18500");
  assert.equal(result.priceText, "18.500,00 €");
});

test("GAM: reconoce el aviso de subasta cuando la plantilla usa #content", () => {
  const html = `<html><body><header>Subasta activa</header><div id="content">
    <h1>JLG E300AJP</h1><p>Para participar en la subasta:</p>${related}
  </div></body></html>`;
  const result = parseProductPage(html, auctionUrl);
  assert.equal(result.price, null);
  assert.equal(result.priceText, "Para participar en la subasta:");
});
