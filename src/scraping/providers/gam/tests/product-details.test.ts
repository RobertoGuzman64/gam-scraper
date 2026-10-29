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


test("GAM: recupera referencias comerciales del encabezado sin tomar referencias relacionadas", () => {
  const html = fixture(`<section class="product-header"><p>Referencia: IB-01953</p></section>
    <div class="related-products"><p>Referencia: JP-JTC-12</p></div>`);
  assert.equal(parseProductPage(html, base).externalReference, "IB-01953");
  const withoutOwn = fixture(`<div class="related-products"><p>Referencia: JP-JTC-12</p></div>`);
  assert.equal(parseProductPage(withoutOwn, base).externalReference, null);
});

test("GAM: conserva referencias comerciales con puntos en etiquetas, atributos y texto de ficha", () => {
  const structured = fixture("<dl><dt>Referencia</dt><dd>H2.0FTS</dd></dl>");
  const attribute = fixture('<span class="product-reference" data-product-reference="H2.0FTS"></span>');
  const header = fixture("<section class='product-header'><p>Referencia:H2.0FTS</p></section>");
  const separated = fixture("<section><div>Referencia: XG0807ACW-LI</div></section>");
  const slash = fixture("<p>Ref.: Z45/25J.</p>");
  assert.equal(parseProductPage(structured, base).externalReference, "H2.0FTS");
  assert.equal(parseProductPage(attribute, base).externalReference, "H2.0FTS");
  assert.equal(parseProductPage(header, base).externalReference, "H2.0FTS");
  assert.equal(parseProductPage(separated, base).externalReference, "XG0807ACW-LI");
  assert.equal(parseProductPage(slash, base).externalReference, "Z45/25J");
});

test("GAM: no inventa la referencia a partir del modelo ni importa referencias relacionadas", () => {
  const noReference = fixture("<dl><dt>Modelo</dt><dd>H2.0FTS</dd></dl>");
  const unrelated = fixture("<div class='related-products'><p>Referencia: H2.0FTS</p></div>");
  const incomplete = fixture("<p>Referencia: H2.0FTS/</p>");
  assert.equal(parseProductPage(noReference, base).externalReference, null);
  assert.equal(parseProductPage(unrelated, base).externalReference, null);
  assert.equal(parseProductPage(incomplete, base).externalReference, null);
});

test("GAM: únicamente extrae atributos técnicos explícitos de la ficha principal", () => {
  const html = fixture(`<section class="product-description-short">
    <p>Altura de trabajo: 11 m. Tipo de mástil: Tríplex.</p>
  </section><dl><dt>Capacidad de carga (kg)</dt><dd>220 kg</dd></dl>
  <section class="related-products"><dl>
    <dt>Altura de trabajo</dt><dd>16 m</dd>
    <dt>Nº de serie</dt><dd>AJENO-01</dd>
  </dl><table><tr><td>Tipo de mástil</td><td>Simple</td></tr></table></section>`);
  const parsed = parseProductPage(html, base);
  assert.equal(parsed.specs["Altura de trabajo"], "11 m");
  assert.equal(parsed.specs["Tipo de mástil"], "Tríplex");
  assert.equal(parsed.specs["Capacidad de carga (kg)"], "220 kg");
  assert.equal(parsed.specs["Nº de serie"], undefined);
  assert.equal(parsed.serialNumber, null);
});

test("GAM: conserva alturas distintas y rechaza declaraciones explícitas contradictorias", () => {
  const html = fixture(`<div class="product-description-short">
    Altura de trabajo: 10 m. Altura de trabajo: 12 m. Altura de elevación: 8 m.
  </div>`);
  const parsed = parseProductPage(html, base);
  assert.equal(parsed.specs["Altura de trabajo"], undefined);
  assert.equal(parsed.specs["Altura de elevación"], "8 m");
  const onlyElevation = parseProductPage(fixture(`<div class="product-description-short">Altura de elevación: 11 metros</div>`), base);
  assert.equal(onlyElevation.specs["Altura de trabajo"], undefined);
});

test("GAM: el valor técnico estructurado prevalece frente al texto promocional", () => {
  const html = fixture(`<div class="product-description-short">Altura de trabajo: 11 m.</div>
    <dl><dt>Altura de trabajo</dt><dd>10 m</dd></dl>`);
  assert.equal(parseProductPage(html, base).specs["Altura de trabajo"], "10 m");
});

test("GAM: no importa enlaces PDF de máquinas relacionadas", () => {
  const html = fixture(`<a href="/docs/ficha-tecnica-6934.pdf">Descargar ficha técnica</a>
    <div class="related-products"><a href="/docs/ficha-tecnica-otra.pdf">Otra ficha</a></div>`);
  assert.equal(parseProductPage(html, base).technicalSheetUrl, "https://online.gamrentals.com/docs/ficha-tecnica-6934.pdf");
  const related = fixture(`<div class="related-products"><a href="/docs/ficha-tecnica-otra.pdf">Ficha técnica</a></div>`);
  assert.equal(parseProductPage(related, base).technicalSheetUrl, null);
});


test("GAM: un atributo técnico publicado solo en productos relacionados no se asigna al principal", () => {
  const html = fixture(`<section class="related-products">
    <div class="product-description-short">Altura de trabajo: 15 m. Tipo de mástil: Simple.</div>
  </section>`);
  const parsed = parseProductPage(html, base);
  assert.equal(parsed.specs["Altura de trabajo"], undefined);
  assert.equal(parsed.specs["Tipo de mástil"], undefined);
});

test("GAM: recupera dimensiones y rotación explícitas solo de la ficha principal cuando faltan especificaciones", () => {
  const html = fixture(`<section class="product-description-short">
    <p>Dimensiones Cesta: 1,83 x 0,76 metros; Rotación de torreta: 700º.</p>
  </section>`);
  const parsed = parseProductPage(html, base);
  assert.equal(parsed.specs["Dimensiones Cesta"], "1,83 x 0,76 metros");
  assert.equal(parsed.specs["Rotación de torreta"], "700º");
  const three = parseProductPage(fixture(`<meta name="description" content="Medidas de la cesta: 140x70x110 cm; Rotación de la torreta: 320°."/>`), base);
  assert.equal(three.specs["Dimensiones Cesta"], "140x70x110 cm");
  assert.equal(three.specs["Rotación de torreta"], "320°");
});

test("GAM: las unidades ausentes, las rotaciones compuestas y las dimensiones corruptas no se reconstruyen", () => {
  const html = fixture(`<section class="product-description-short">
    <p>Dimensiones Cesta: 1 76 83X0 metros; Rotación de torreta: 190º+190º.</p>
  </section>`);
  const parsed = parseProductPage(html, base);
  assert.equal(parsed.specs["Dimensiones Cesta"], undefined);
  assert.equal(parsed.specs["Rotación de torreta"], undefined);
  const units = parseProductPage(fixture(`<meta name="description" content="Dimensiones Cesta: 1,83 x 0,76; Rotación de torreta: 700º+20º."/>`), base);
  assert.equal(units.specs["Dimensiones Cesta"], undefined);
  assert.equal(units.specs["Rotación de torreta"], undefined);
});

test("GAM: no decide entre medidas explícitas contradictorias ni sustituye valores estructurados", () => {
  const conflicting = fixture(`<section class="product-description-short">
    Dimensiones Cesta: 1,83 x 0,76 metros; Dimensiones Cesta: 2,4 x 1,17 metros;
    Rotación de torreta: 320º; Rotación de torreta: 700º.
  </section>`);
  assert.equal(parseProductPage(conflicting, base).specs["Dimensiones Cesta"], undefined);
  assert.equal(parseProductPage(conflicting, base).specs["Rotación de torreta"], undefined);
  const structured = fixture(`<section class="product-description-short">
    Dimensiones Cesta: 1,83 x 0,76 metros; Rotación de torreta: 320º.
  </section><dl><dt>Dimensiones Cesta</dt><dd>1 76 83X0 metros</dd>
    <dt>Rotación de torreta</dt><dd>190º+190º</dd></dl>`);
  const parsed = parseProductPage(structured, base);
  assert.equal(parsed.specs["Dimensiones Cesta"], "1 76 83X0 metros");
  assert.equal(parsed.specs["Rotación de torreta"], "190º+190º");
});
