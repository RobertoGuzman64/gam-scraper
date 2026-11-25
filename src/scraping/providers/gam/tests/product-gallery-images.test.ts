import assert from "node:assert/strict";
import test from "node:test";
import { parseProductPage } from "../parsers.js";
import { base, fixture } from "./product-details-fixture.js";

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
