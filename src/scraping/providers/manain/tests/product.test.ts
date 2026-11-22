import assert from "node:assert/strict";
import test from "node:test";
import { parseManainProduct } from "../product.js";

const base = "https://manain.com/producto/venta-movimiento-tierra-miniexcavadora-kubota-kx080-4a2-2/";

const page = (sku: string, details: string): string => `<html><body><main><article class="product">
  <div class="summary"><h1>KUBOTA KX080-4A2</h1><div class="product_meta"><span class="sku_wrapper">SKU: <span class="sku">${sku}</span></span></div>
    <p class="price">Consultar precio</p><div class="woocommerce-product-details__short-description">Miniexcavadora de 8,3 toneladas.</div>
  </div>${details}</article></main></body></html>`;

test("Manain: preserva referencias de unidades diferentes y no las deriva del modelo o slug", () => {
  const details = `<dl><dt>Marca</dt><dd>KUBOTA</dd><dt>Modelo</dt><dd>KX080-4A2</dd>
    <dt>Año</dt><dd>2023</dd><dt>Horas</dt><dd>3280</dd><dt>Motor</dt><dd>Diésel</dd>
    <dt>Peso operativo</dt><dd>8350 kg</dd><dt>Estado</dt><dd>Usada</dd></dl>`;
  const one = parseManainProduct(page("MAN1802", details), base);
  const another = parseManainProduct(page("MAN1268", details), base.replace("-2/", "/"));
  assert.equal(one.reference, "MAN1802");
  assert.equal(another.reference, "MAN1268");
  assert.equal(one.model, another.model);
  assert.equal(one.brand, "KUBOTA");
  assert.equal(one.year, "2023");
  assert.equal(one.horometer, "3280");
  assert.equal(one.condition, "Segunda mano");
  assert.equal(one.price, null);
  assert.equal(one.priceText, "Consultar precio");
  assert.equal(one.specs?.["Peso operativo"], "8350 kg");
  assert.equal(one.yearSource, "ficha");
});

test("Manain: aisla la galería, las especificaciones y los PDF del equipo principal", () => {
  const parsed = parseManainProduct(page("BES 220489", `<section class="woocommerce-product-gallery">
    <a href="/wp-content/uploads/2026/09/equipo.jpg"><img src="/wp-content/uploads/2026/09/equipo-320x240.jpg"></a>
    <a href="/wp-content/uploads/2026/09/detalle-1024x768.jpg"><img src="/wp-content/uploads/2026/09/detalle-200x150.jpg"></a>
  </section><table><tr><th>Capacidad de carga</th><td>1500 kg</td></tr></table>
  <a href="/wp-content/uploads/2026/09/ficha.pdf">Ficha técnica</a>
  <div class="related-products"><span class="sku">MAN9999</span>
    <table><tr><th>Año</th><td>2020</td></tr></table>
    <img src="/wp-content/uploads/2026/09/otra.jpg">
    <a href="/wp-content/uploads/2026/09/otra-ficha.pdf">Ficha técnica</a></div>`), base);
  assert.equal(parsed.reference, "BES 220489");
  assert.equal(parsed.specs?.["Capacidad de carga"], "1500 kg");
  assert.equal(parsed.year, null);
  assert.deepEqual(parsed.images, [
    "https://manain.com/wp-content/uploads/2026/09/equipo.jpg",
    "https://manain.com/wp-content/uploads/2026/09/detalle-1024x768.jpg"
  ]);
  assert.equal(parsed.image, parsed.images[0]);
  assert.equal(parsed.technicalSheetUrl, "https://manain.com/wp-content/uploads/2026/09/ficha.pdf");
});

test("Manain: no resuelve referencias contradictorias ni inventa valores ausentes", () => {
  assert.throws(() => parseManainProduct(page("MAN1802", `<dl><dt>Referencia</dt><dd>MAN1268</dd></dl>`), base), /referencias contradictorias/);
  const parsed = parseManainProduct(page("0 N3243", `<dl><dt>Horas</dt><dd></dd><dt>Año</dt><dd>2022</dd>
    <dt>Año</dt><dd>2023</dd><dt>Estado</dt><dd>Nueva</dd><dt>Estado</dt><dd>Usada</dd></dl>`), base);
  assert.equal(parsed.reference, "0 N3243");
  assert.equal(parsed.year, null);
  assert.equal(parsed.horometer, null);
  assert.equal(parsed.condition, null);
  assert.deepEqual(parsed.specs?.["Año"], ["2022", "2023"]);
  assert.deepEqual(parsed.images, []);
  const withoutSku = parseManainProduct(page("", ""), base);
  assert.equal(withoutSku.reference, null);
  assert.equal(withoutSku.brand, null);
  const newItem = parseManainProduct(page("MAN3178", "<ul><li><span>Estado</span><span>Nueva</span></li></ul>"), base);
  assert.equal(newItem.condition, "Nuevo");
  assert.throws(() => parseManainProduct("<main><h1>Catálogo</h1></main>", base), /contenido principal/);
  assert.throws(() => parseManainProduct(page("MAN1802", ""), "https://manain.com/producto/alquiler-demo/"), /URL de ficha/);
});

test("Manain: reconoce las etiquetas de condición y medidas que publica el catálogo de venta", () => {
  const parsed = parseManainProduct(page("MAN1802", `<table><tr><th>Nueva o usada</th><td>usada</td></tr>
    <tr><th>Altura trabajo</th><td>10,10 m</td></tr><tr><th>Capacidad carga</th><td>230 kg</td></tr>
    <tr><th>Capacidad depósito</th><td>51 l</td></tr></table>`), base);
  assert.equal(parsed.condition, "Segunda mano");
  assert.equal(parsed.specs?.["Nueva o usada"], "usada");
  assert.equal(parsed.specs?.["Altura trabajo"], "10,10 m");
  assert.equal(parsed.specs?.["Capacidad carga"], "230 kg");
  assert.equal(parsed.specs?.["Capacidad depósito"], "51 l");
});

test("Manain: reconoce la ficha Elementor y las imágenes originales sin contaminarse con relacionadas", () => {
  const url = "https://manain.com/producto/venda-elevacio-tisores-jlg-530lrt/";
  const html = `<main><div class="product type-product" id="product-781069">
    <div class="elementor"><div class="detalles-producto">
      <h2 class="raven-product-title">530LRT</h2>
      <div class="product_meta"><span class="sku_wrapper"><span class="detail-label">SKU</span>
        <span class="sku detail-content">MA3904</span></span></div>
      <a class="showlogin">Consultar precio</a>
      <a class="info-ficha-description" href="/ficha-tecnica/venda-elevacio-tisores-jlg-530lrt/">Descargar Ficha técnica</a>
      <a class="info-ficha-description" href="https://manain.com/?download_images=MA3904">Descargar fotos</a>
    </div>
    <figure class="woocommerce-product-gallery__wrapper">
      <div class="woocommerce-product-gallery__image"><a href="/wp-content/uploads/2024/12/MA3904-01-scaled.jpg">
        <img src="/wp-content/uploads/2024/06/Aspect_ratio_-_16x9.svg.png"
          data-large_image="https://manain.com/wp-content/uploads/2024/12/MA3904-01-scaled.jpg"/></a></div>
      <div class="woocommerce-product-gallery__image"><a href="/wp-content/uploads/2024/12/MA3904-1-scaled.jpg">
        <img data-large_image="https://manain.com/wp-content/uploads/2024/12/MA3904-1-scaled.jpg"/></a></div>
    </figure>
    <table class="woocommerce-product-attributes shop_attributes">
      <tr><th>Marca</th><td>JLG</td></tr><tr><th>Modelo</th><td>530LRT</td></tr>
      <tr><th>Año</th><td>2018</td></tr><tr><th>Horas</th><td>1277</td></tr>
      <tr><th>Nueva o usada</th><td>usada</td></tr><tr><th>Motor</th><td>Diésel</td></tr>
      <tr><th>Tracción</th><td>4×4</td></tr><tr><th>Estabilizadores</th><td>si</td></tr>
      <tr><th>Altura trabajo</th><td>18,15 m</td></tr><tr><th>Capacidad carga</th><td>680 kg</td></tr>
    </table>
    <div class="pkk-related-product"><ul class="products"><li class="product">
      <span class="sku">MAN9999</span><div class="pkk-card-spec-title">Altura trabajo</div>
      <div class="pkk-card-spec-content">10 m</div><img src="/wp-content/uploads/relacionada.jpg"/>
      <a href="/ficha-tecnica/relacionada/">Descargar Ficha técnica</a></li></ul></div>
    </div>
  </div></main>`;
  const parsed = parseManainProduct(html, url);
  assert.equal(parsed.title, "530LRT");
  assert.equal(parsed.reference, "MA3904");
  assert.equal(parsed.brand, "JLG");
  assert.equal(parsed.model, "530LRT");
  assert.equal(parsed.year, "2018");
  assert.equal(parsed.horometer, "1277");
  assert.equal(parsed.condition, "Segunda mano");
  assert.equal(parsed.price, null);
  assert.equal(parsed.priceText, "Consultar precio");
  assert.equal(parsed.specs?.["Tracción"], "4×4");
  assert.equal(parsed.specs?.Estabilizadores, "si");
  assert.equal(parsed.specs?.["Altura trabajo"], "18,15 m");
  assert.deepEqual(parsed.images, [
    "https://manain.com/wp-content/uploads/2024/12/MA3904-01-scaled.jpg",
    "https://manain.com/wp-content/uploads/2024/12/MA3904-1-scaled.jpg"
  ]);
  assert.equal(parsed.technicalSheetUrl, "https://manain.com/ficha-tecnica/venda-elevacio-tisores-jlg-530lrt/");
  assert.equal(parsed.shortDescription, null);
  assert.equal(parsed.longDescription, null);
});

test("Manain: descarta una medida dimensional inválida sin corregirla por inferencia y elimina seguimiento en el enlace técnico", () => {
  const html = page("MAN2327", `<table class="woocommerce-product-attributes">
    <tr><th>Radio giro exterior</th><td>si m</td></tr>
    <tr><th>Altura trabajo</th><td>10 m</td></tr>
    <tr><th>Año</th><td>2024</td></tr>
  </table><a href="/ficha-tecnica/venta-movimiento-tierra-miniexcavadora-kubota-kx080-4a2-2/?utm_source=chatgpt.com">Ficha técnica</a>`);
  const parsed = parseManainProduct(html, `${base}?utm_source=chatgpt.com`);
  assert.equal(parsed.reference, "MAN2327");
  assert.equal(parsed.specs?.["Radio giro exterior"], undefined);
  assert.equal(parsed.specs?.["Altura trabajo"], "10 m");
  assert.equal(parsed.technicalSheetUrl, "https://manain.com/ficha-tecnica/venta-movimiento-tierra-miniexcavadora-kubota-kx080-4a2-2/");
  assert.equal(parsed.priceText, "Consultar precio");
});
