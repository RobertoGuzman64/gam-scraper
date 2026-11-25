import assert from "node:assert/strict";
import test from "node:test";
import { parseProductPage } from "../parsers.js";
import { base, fixture } from "./product-details-fixture.js";

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

test("GAM: prioriza imágenes de la referencia propia frente a productos externos sin identidad comparable", () => {
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
  assert.deepEqual(parseProductPage(html, base).images, [own]);
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
