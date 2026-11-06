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

test("GAM: el respaldo de galería corta no incorpora portadas de otros productos", () => {
  const url = "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e";
  const own = "https://online.gamrentals.com/58026-product_main_2x/preparapedidos-yale-mo10e.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const html = fixture(`<div id="product"><img itemprop="image" src="${own}"/>
    <section class="related-products"><div class="product-miniature"><img src="${foreign}"/></div></section>
  </div>`);
  const parsed = parseProductPage(html, url);
  assert.deepEqual(parsed.images, [own]);
  assert.equal(parsed.image, own);
  const withoutOwn = parseProductPage(fixture(`<div id="product">
    <section class="related-products"><div class="product-miniature"><img src="${foreign}"/></div></section>
  </div>`), url);
  assert.deepEqual(withoutOwn.images, []);
  assert.equal(withoutOwn.image, null);
});

test("GAM: evita repetir fotografías de CDN cuando una fuente añade parámetros de consulta", () => {
  const first = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const second = "https://online.gamrentals.com/60452-product_main_2x/2007-jlg-e300ajp.jpg";
  const html = fixture(`<div class="product-cover"><img src="${first}" data-image-large-src="${first}?v=2"/></div>
    <div class="product-cover"><img src="${second}"/></div>`);
  assert.deepEqual(parseProductPage(html, base).images, [first, second]);
  assert.deepEqual(parseProductPage(fixture(`<div class="product-cover"><img src="${first}?v=2"/></div>`), base).images, [`${first}?v=2`]);
});

test("GAM: conserva variantes de consulta de imágenes de dominios externos", () => {
  const first = "https://imagenes.example.com/foto.jpg?imagen=1";
  const second = "https://imagenes.example.com/foto.jpg?imagen=2";
  const html = fixture(`<div class="product-cover"><img src="${first}" data-image-large-src="${second}"/></div>`);
  assert.deepEqual(parseProductPage(html, base).images, [first, second]);
});

test("GAM: los datos JSON-LD no mezclan imágenes de productos relacionados identificados", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const relatedUrl = "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e";
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@graph": [
      { "@type": "Product", url: base, image: own },
      { "@type": "Product", url: relatedUrl, image: foreign }
    ]
  })}</script></head><body><main><h1>JLG E300AJP</h1></main></body></html>`;
  assert.deepEqual(parseProductPage(html, base).images, [own]);

  const separateScripts = `<html><head>
    <script type="application/ld+json">${JSON.stringify({ "@type": "Product", "@id": `${base}#product`, image: own })}</script>
    <script type="application/ld+json">${JSON.stringify({ "@type": "Product", url: relatedUrl, image: foreign })}</script>
  </head><body><h1>JLG E300AJP</h1></body></html>`;
  assert.deepEqual(parseProductPage(separateScripts, base).images, [own]);
});

test("GAM: reconoce Product cuando @graph contiene un solo objeto", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const structured = {
    "@context": "https://schema.org",
    "@graph": { "@type": "Product", url: base, image: { contentUrl: own } }
  };
  const html = `<html><head><script type="application/ld+json">${JSON.stringify(structured)}</script></head>
    <body><h1>JLG E300AJP</h1></body></html>`;
  assert.deepEqual(parseProductPage(html, base).images, [own]);
});

test("GAM: el @graph con objeto único conserva el aislamiento de otras fichas", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const relatedUrl = "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e";
  const ownProduct = { "@graph": { "@type": "Product", url: base, image: own } };
  const relatedProduct = { "@graph": { "@type": "Product", url: relatedUrl, image: foreign } };
  const makeScript = (value: unknown): string => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
  const html = `<html><head>${makeScript(ownProduct)}${makeScript(relatedProduct)}</head>
    <body><h1>JLG E300AJP</h1></body></html>`;
  assert.deepEqual(parseProductPage(html, base).images, [own]);
  assert.deepEqual(parseProductPage(`<html><head>${makeScript(relatedProduct)}</head><body><h1>JLG E300AJP</h1></body></html>`, base).images, []);
});

test("GAM: descarta portadas de otros IDs GAM cuando el JSON-LD no incluye coincidencia exacta", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const relatedUrl = "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e";
  const foreignOnly = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@type": "Product", url: relatedUrl, image: foreign
  })}</script></head><body><h1>JLG E300AJP</h1></body></html>`;
  assert.deepEqual(parseProductPage(foreignOnly, base).images, []);
  const mixed = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@graph": [
      { "@type": "Product", image: own },
      { "@type": "Product", "@id": `${relatedUrl}#product`, image: foreign }
    ]
  })}</script></head><body><h1>JLG E300AJP</h1></body></html>`;
  assert.deepEqual(parseProductPage(mixed, base).images, [own]);
});

test("GAM: conserva URL alternativas del mismo ID y productos sin identidad comparable", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const unknown = "https://online.gamrentals.com/60452-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const canonical = "https://online.gamrentals.com/es/otro-catalogo/6934-jlg-e300ajp";
  const related = "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e";
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@graph": [
      { "@type": "Product", url: canonical, image: own },
      { "@type": "Product", url: "https://otro-dominio.example/catalogo", image: unknown },
      { "@type": "Product", url: related, image: foreign }
    ]
  })}</script></head><body><h1>JLG E300AJP</h1></body></html>`;
  assert.deepEqual(parseProductPage(html, base).images, [own, unknown]);
});

test("GAM: conserva la galería JSON-LD sin identidad de página inequívoca", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@type": "Product", image: [own]
  })}</script></head><body><h1>JLG E300AJP</h1></body></html>`;
  assert.deepEqual(parseProductPage(html, base).images, [own]);
});

test("GAM: reconoce tipos Product de Schema.org con URI completa y excluye productos ajenos", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const relatedUrl = "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e";
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@graph": [
      { "@type": "https://schema.org/Product", url: base, image: { "@type": "ImageObject", contentUrl: own } },
      { "@type": "http://schema.org/Product", url: relatedUrl, image: foreign }
    ]
  })}</script></head><body><h1>JLG E300AJP</h1></body></html>`;
  assert.deepEqual(parseProductPage(html, base).images, [own]);
});

test("GAM: reconoce tipos mixtos con URI de Product pero no acepta tipos de dominios ajenos", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@graph": [
      { "@type": ["Vehicle", "https://schema.org/Product"], url: base, image: own },
      { "@type": "https://unrelated.example/Product", image: foreign }
    ]
  })}</script></head><body><h1>JLG E300AJP</h1></body></html>`;
  assert.deepEqual(parseProductPage(html, base).images, [own]);
});

test("GAM: usa URL alternativa de ImageObject cuando contentUrl está vacío", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const second = "https://online.gamrentals.com/60452-product_main_2x/2007-jlg-e300ajp.jpg";
  const third = "https://online.gamrentals.com/60453-product_main_2x/2007-jlg-e300ajp.jpg";
  const html = fixture(`<script type="application/ld+json">${JSON.stringify({
    "@type": "Product", url: base, image: [
      { "@type": "ImageObject", contentUrl: "", url: own },
      { "@type": "ImageObject", contentUrl: " \t ", url: second },
      { "@type": "ImageObject", contentUrl: null, url: "", src: third }
    ]
  })}</script>`);
  assert.deepEqual(parseProductPage(html, base).images, [own, second, third]);
});

test("GAM: conserva prioridad de contentUrl cuando aporta una URL válida", () => {
  const preferred = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const alternative = "https://online.gamrentals.com/60452-product_main_2x/2007-jlg-e300ajp.jpg";
  const html = fixture(`<script type="application/ld+json">${JSON.stringify({
    "@type": "Product", url: base,
    image: { "@type": "ImageObject", contentUrl: preferred, url: alternative }
  })}</script>`);
  assert.deepEqual(parseProductPage(html, base).images, [preferred]);
});

test("GAM: recupera imágenes JSON-LD ImageObject declaradas mediante contentUrl", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const next = "https://online.gamrentals.com/60452-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const relatedUrl = "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e";
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@graph": [
      { "@type": "Product", url: base, image: [
        { "@type": "ImageObject", contentUrl: own },
        { "@type": "ImageObject", contentUrl: next }
      ] },
      { "@type": "Product", url: relatedUrl, image: { "@type": "ImageObject", contentUrl: foreign } }
    ]
  })}</script></head><body><h1>JLG E300AJP</h1></body></html>`;
  assert.deepEqual(parseProductPage(html, base).images, [own, next]);
});

test("GAM: prioriza contentUrl de ImageObject sobre la URL de su página de detalle", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@type": "Product", url: base, image: {
      "@type": "ImageObject", url: "https://online.gamrentals.com/es/galeria/imagen", contentUrl: own
    }
  })}</script></head><body><h1>JLG E300AJP</h1></body></html>`;
  assert.deepEqual(parseProductPage(html, base).images, [own]);
});

test("GAM: comprueba URL y @id antes de admitir imágenes JSON-LD de otra ficha", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const related = "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e";
  const html = fixture(`<script type="application/ld+json">${JSON.stringify({
    "@graph": [
      { "@type": "Product", url: "https://fabricante.example/producto", "@id": `${related}#product`, image: foreign },
      { "@type": "Product", url: base, image: own }
    ]
  })}</script>`);
  assert.deepEqual(parseProductPage(html, base).images, [own]);
  const withoutOwn = fixture(`<script type="application/ld+json">${JSON.stringify({
    "@type": "Product", url: "https://fabricante.example/producto", "@id": `${related}#product`, image: foreign
  })}</script>`);
  assert.deepEqual(parseProductPage(withoutOwn, base).images, []);
});

test("GAM: conserva productos JSON-LD si uno de sus IDs GAM identifica la propia ficha", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const related = "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e";
  const html = fixture(`<script type="application/ld+json">${JSON.stringify({
    "@type": "Product", url: related, "@id": `${base}#product`, image: own
  })}</script>`);
  assert.deepEqual(parseProductPage(html, base).images, [own]);
});

test("GAM: identifica la ficha por @id aunque su URL comercial sea distinta", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const html = fixture(`<script type="application/ld+json">${JSON.stringify({
    "@graph": [
      { "@type": "Product", url: "https://fabricante.example/jlg-e300ajp", "@id": `${base}#product`, image: own },
      { "@type": "Product", url: "https://fabricante.example/yale-gp80vx", image: foreign }
    ]
  })}</script>`);
  assert.deepEqual(parseProductPage(html, base).images, [own]);
});

test("GAM: mantiene la foto propia cuando @id coincide pero url apunta a otra ficha", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const related = "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e";
  const html = fixture(`<script type="application/ld+json">${JSON.stringify({
    "@graph": [
      { "@type": "Product", url: related, "@id": `${base}#product`, image: own },
      { "@type": "Product", url: "https://fabricante.example/producto", image: foreign }
    ]
  })}</script>`);
  assert.deepEqual(parseProductPage(html, base).images, [own]);
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

test("GAM: recupera imágenes de nodos anidados con data-src-large y data-lazy-src", () => {
  const html = fixture(`<div class="product-gallery">
    <span data-src-large="/60451-large_default/2007-jlg-e300ajp.jpg"></span>
    <div data-lazy-src="/60452-medium_default/2007-jlg-e300ajp.jpg"></div>
  </div>`);
  assert.deepEqual(parseProductPage(html, base).images, [60451, 60452].map((id) =>
    `https://online.gamrentals.com/${id}-product_main_2x/2007-jlg-e300ajp.jpg`
  ));
});

test("GAM: no recupera imágenes data-src-large o data-lazy-src de recomendaciones anidadas", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const html = fixture(`<div class="product-gallery">
    <span data-src-large="${own}"></span>
    <section class="related-products">
      <span data-src-large="/14287-large_default/carretilla-elevadora-diesel-yale-gp80vx-9.jpg"></span>
      <div data-lazy-src="/14288-medium_default/carretilla-elevadora-diesel-yale-gp80vx-9.jpg"></div>
    </section>
  </div>`);
  assert.deepEqual(parseProductPage(html, base).images, [own]);
});

test("GAM: excluye carruseles recomendados anidados dentro del producto aunque compartan modelo", () => {
  const own = [60451, 60452, 60453].map((id) =>
    `https://online.gamrentals.com/${id}-product_main_2x/2016-genie-z-3020n.jpg`);
  const recommendations = [
    "/60454-product_main_2x/2007-jlg-e300ajp.jpg",
    "/60455-product_main_2x/2016-genie-z-3020n.jpg",
    "/60456-product_main_2x/2016-genie-z-3020n.jpg",
    "/60457-product_main_2x/2016-genie-z-3020n-.jpg"
  ];
  const html = fixture(`<div id="product"><div class="images-container">
    ${own.map((image) => `<img src="${image}"/>`).join("")}
    <section class="related-products">
      <div class="product-gallery">
        ${recommendations.map((image) => `<div class="swiper-slide"><a data-fancybox="gallery" href="${image}"><img data-image-large-src="${image}" src="${image}"/></a></div>`).join("")}
      </div>
    </section>
  </div></div>`);
  const parsed = parseProductPage(html, base);
  assert.deepEqual(parsed.images, own);
  assert.equal(parsed.image, own[0]);
});

test("GAM: excluye miniaturas relacionadas sin descartar imágenes propias dentro del mismo contenedor", () => {
  const original = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const related = "https://online.gamrentals.com/60452-product_main_2x/2016-genie-z-3020n.jpg";
  const html = fixture(`<div id="product"><div class="product-gallery">
    <a data-fancybox="gallery" href="${original}"><img src="${original}"/></a>
    <div class="featured-products"><div class="product-miniature">
      <a data-fancybox="gallery" href="${related}"><img data-original="${related}" src="${related}"/></a>
    </div></div>
  </div></div>`);
  const parsed = parseProductPage(html, base);
  assert.deepEqual(parsed.images, [original]);
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

test("GAM: extrae completas las referencias comerciales con espacios de las fichas", () => {
  const examples: Array<[string, string]> = [
    ["<p>Referencia:TRACCESS 135 GASOLINA</p>", "TRACCESS 135 GASOLINA"],
    ["<span>Referencia:FCS T681 D70</span>", "FCS T681 D70"],
    ["<div class='product-reference'><span>Referencia:</span><span>ZED 20.4 HN</span></div>", "ZED 20.4 HN"],
    ["<span class='product-sku' data-product-reference='FCA I-MOP LITE'></span>", "FCA I-MOP LITE"],
    ["<dl><dt>Referencia</dt><dd>TRACCESS 135 DIESEL</dd></dl>", "TRACCESS 135 DIESEL"]
  ];
  for (const [body, expected] of examples) {
    assert.equal(parseProductPage(fixture(body), base).externalReference, expected);
  }
});

test("GAM: conserva símbolos y numerales Unicode de las referencias comerciales", () => {
  const examples: Array<[string, string]> = [
    ["<p>Referencia: XGS32ACK Ⅱ</p>", "XGS32ACK Ⅱ"],
    ["<p>Referencia: FCS T7+ D65</p>", "FCS T7+ D65"],
    ["<span>Referencia: FCS T7+ D80</span>", "FCS T7+ D80"],
    ["<span class='product-sku' data-product-reference='FCS T7+ D65'></span>", "FCS T7+ D65"]
  ];
  for (const [body, expected] of examples) {
    assert.equal(parseProductPage(fixture(body), base).externalReference, expected);
  }
  assert.equal(parseProductPage(fixture("<p>Referencia: FCS T7++ D65</p>"), base).externalReference, null);
  assert.equal(parseProductPage(fixture("<div class='related-products'><p>Referencia: XGS32ACK Ⅱ</p></div>"), base).externalReference, null);
});

test("GAM: no mezcla referencias comerciales con etiquetas adyacentes ni con fichas relacionadas", () => {
  const adjacent = fixture("<div><p>Referencia: TRACCESS 135 GASOLINA</p><p>Marca: CTE</p><p>Modelo: TRACCESS 135</p></div>");
  const inline = fixture("<div>Referencia: FCS T681 D70 <span>Modelo: FCS T681 D70</span></div>");
  const unrelated = fixture("<div class='related-products'><p>Referencia: TRACCESS 135 GASOLINA</p></div>");
  assert.equal(parseProductPage(adjacent, base).externalReference, "TRACCESS 135 GASOLINA");
  assert.equal(parseProductPage(inline, base).externalReference, "FCS T681 D70");
  assert.equal(parseProductPage(unrelated, base).externalReference, null);
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

test("GAM: ignora imágenes data-product de productos relacionados sin perder las propias", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const ownData = JSON.stringify({ images: [own] });
  const foreignData = JSON.stringify({ images: [foreign] });
  const html = fixture(`<div id="product">
    <div id="product-details" data-product='${ownData}'></div>
    <section class="related-products"><div data-product='${foreignData}'></div></section>
  </div>`);
  assert.deepEqual(parseProductPage(html, base).images, [own]);
  assert.deepEqual(parseProductPage(fixture(`<div id="product">
    <section class="related-products"><div data-product='${foreignData}'></div></section>
  </div>`), base).images, []);
});

test("GAM: ignora imágenes data-images de recomendaciones y conserva las de la ficha", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const ownImages = JSON.stringify([own]);
  const foreignImages = JSON.stringify([foreign]);
  const html = fixture(`<div id="product">
    <div class="product-gallery" data-images='${ownImages}'></div>
    <div class="crossselling"><div data-images='${foreignImages}'></div></div>
  </div>`);
  assert.deepEqual(parseProductPage(html, base).images, [own]);
  assert.deepEqual(parseProductPage(fixture(`<div id="product">
    <div class="crossselling"><div data-images='${foreignImages}'></div></div>
  </div>`), base).images, []);
});

test("GAM: recupera el tamaño disponible cuando bySize.product_main_2x está vacío", () => {
  const image = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const product = { images: [{ bySize: {
    product_main_2x: { url: "" },
    large_default: { url: "/60451-large_default/2007-jlg-e300ajp.jpg" }
  } }] };
  const html = fixture(`<div id="product"><div id="product-details" data-product='${JSON.stringify(product)}'></div></div>`);
  assert.deepEqual(parseProductPage(html, base).images, [image]);
});

test("GAM: busca tamaños alternativos en orden y conserva el mayor disponible", () => {
  const first = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const second = "https://online.gamrentals.com/60452-product_main_2x/2007-jlg-e300ajp.jpg";
  const third = "https://online.gamrentals.com/60453-product_main_2x/2007-jlg-e300ajp.jpg";
  const images = [
    { bySize: { product_main_2x: { url: first }, large_default: { url: second } } },
    { bySize: { product_main_2x: { url: "  " }, large_default: {}, medium_default: { url: "/60452-medium_default/2007-jlg-e300ajp.jpg" } } },
    { bySize: { product_main_2x: null, large_default: { url: null }, product_main: { url: "/60453-product_main/2007-jlg-e300ajp.jpg" } } }
  ];
  const related = { images: ["https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg"] };
  const html = fixture(`<div id="product"><div id="product-details" data-product='${JSON.stringify({ images })}'></div>
    <div class="related-products"><div data-product='${JSON.stringify(related)}'></div></div></div>`);
  assert.deepEqual(parseProductPage(html, base).images, [first, second, third]);
});

test("GAM: recupera las resoluciones secundarias cuando son las únicas disponibles", () => {
  const sizes = ["thickbox_default", "home_default", "small_default", "cart_default"];
  const images = sizes.map((size, index) => ({
    bySize: { [size]: { url: `/${60601 + index}-${size}/2007-jlg-e300ajp.jpg` } }
  }));
  const expected = sizes.map((_, index) =>
    `https://online.gamrentals.com/${60601 + index}-product_main_2x/2007-jlg-e300ajp.jpg`
  );
  const html = fixture(`<div id="product"><div id="product-details" data-product='${JSON.stringify({ images })}'></div></div>`);
  assert.deepEqual(parseProductPage(html, base).images, expected);
});

test("GAM: prioriza los tamaños principales y no recupera imágenes de recomendaciones", () => {
  const preferred = "https://online.gamrentals.com/60611-product_main_2x/2007-jlg-e300ajp.jpg";
  const fallback = "https://online.gamrentals.com/60612-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const images = [
    { bySize: { product_main_2x: { url: preferred }, thickbox_default: { url: "/60610-thickbox_default/2007-jlg-e300ajp.jpg" } } },
    { bySize: { product_main_2x: { url: " " }, medium_default: { url: "/60612-medium_default/2007-jlg-e300ajp.jpg" }, home_default: { url: "/60613-home_default/2007-jlg-e300ajp.jpg" } } },
    { bySize: { thickbox_default: { url: "/60614-thickbox_default/2007-jlg-e300ajp.jpg" }, home_default: { url: "/60615-home_default/2007-jlg-e300ajp.jpg" } } }
  ];
  const html = fixture(`<div id="product"><div id="product-details" data-product='${JSON.stringify({ images })}'></div>
    <div class="related-products"><div data-product='${JSON.stringify({ images: [{ bySize: { home_default: { url: foreign } } }] })}'></div></div></div>`);
  assert.deepEqual(parseProductPage(html, base).images, [preferred, fallback, "https://online.gamrentals.com/60614-product_main_2x/2007-jlg-e300ajp.jpg"]);
});

test("GAM: ignora JSON-LD de productos relacionados sin identidad comprobable", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const data = JSON.stringify({ images: [own] });
  const related = JSON.stringify({ "@type": "Product", image: foreign });
  const html = fixture(`<div id="product"><div id="product-details" data-product='${data}'></div>
    <section class="related-products"><script type="application/ld+json">${related}</script></section>
  </div>`);
  assert.deepEqual(parseProductPage(html, base).images, [own]);
});

test("GAM: ignora scripts PrestaShop dentro de recomendaciones sin perder los de la ficha", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const main = JSON.stringify({ product: { images: [own] } });
  const related = JSON.stringify({ product: { images: [foreign] } });
  const html = fixture(`<div id="product"><script>const prestashop = ${main};</script>
    <section class="related-products"><script>const prestashop = ${related};</script></section>
  </div>`);
  assert.deepEqual(parseProductPage(html, base).images, [own]);
});

test("GAM: descarta imágenes PrestaShop si el producto identifica otra referencia", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const relatedUrl = "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e";
  const other = { product: { url: relatedUrl, images: [foreign] } };
  const ownProduct = { product: { url: base, images: [own] } };
  const html = fixture(`<script>var prestashop = ${JSON.stringify(other)};</script>
    <script>var prestashop = ${JSON.stringify(ownProduct)};</script>`);
  assert.deepEqual(parseProductPage(html, base).images, [own]);
  assert.deepEqual(parseProductPage(fixture(`<script>var prestashop = ${JSON.stringify(other)};</script>`), base).images, []);
});

test("GAM: respeta identidades alternativas y protege data-product con ID ajeno", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
  const relatedUrl = "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e";
  const same = { url: relatedUrl, "@id": `${base}#product`, images: [own] };
  const foreignProduct = { url: relatedUrl, images: [foreign] };
  const html = fixture(`<div id="product"><div id="product-details" data-product='${JSON.stringify(foreignProduct)}'></div>
    <script>prestashop.product = ${JSON.stringify(same)};</script></div>`);
  assert.deepEqual(parseProductPage(html, base).images, [own]);
  const onlyData = fixture(`<div id="product"><div id="product-details" data-product='${JSON.stringify(foreignProduct)}'></div></div>`);
  assert.deepEqual(parseProductPage(onlyData, base).images, []);
});

test("GAM: prioriza la ficha identificada por referencia aunque JSON-LD utilice otra ruta de idioma", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/60500-product_main_2x/otra-plataforma-jlg.jpg";
  const translated = "https://online.gamrentals.com/en/electric-articulated-booms/6934-2007-jlg-e300ajp";
  const html = fixture(`<script type="application/ld+json">${JSON.stringify({
    "@graph": [
      { "@type": "Product", url: translated, image: own },
      { "@type": "Product", image: foreign }
    ]
  })}</script>`);
  assert.deepEqual(parseProductPage(html, base).images, [own]);
});

test("GAM: lee imágenes declaradas directamente en el producto principal", () => {
  const own = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
  const second = "https://online.gamrentals.com/60452-product_main_2x/2007-jlg-e300ajp.jpg";
  const foreign = "https://online.gamrentals.com/60500-product_main_2x/otra-plataforma-jlg.jpg";
  const data = JSON.stringify({ url: base, images: [own] });
  const additional = JSON.stringify([second]);
  const html = fixture(`<div id="product" data-product='${data}' data-images='${additional}'>
    <div class="related-products"><div data-product='${JSON.stringify({ images: [foreign] })}'></div></div>
  </div>`);
  assert.deepEqual(parseProductPage(html, base).images, [own, second]);
});
