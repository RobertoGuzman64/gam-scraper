import assert from "node:assert/strict";
import test from "node:test";
import { parseProductPage } from "../parsers.js";

const url = "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6934-2007-jlg-e300ajp";

test("GAM: mantiene una descripción corta independiente cuando la web la publica", () => {
  const html = `<html><head><meta property="og:description" content="JLG E300AJP de ocasión."></head><body><main>
    <h1>JLG E300AJP</h1>
    <div id="description"><p>Plataforma articulada eléctrica con 300 horas.</p></div>
    <nav class="breadcrumb"><ol><li>Inicio</li><li>Maquinaria de ocasión</li><li>Elevación</li></ol></nav>
    <dl><dt>Referencia</dt><dd>PV-41592</dd></dl>
    <a href="/fichas/ficha-tecnica.pdf">Ficha técnica</a>
  </main></body></html>`;
  const result = parseProductPage(html, url);
  assert.equal(result.shortDescription, "JLG E300AJP de ocasión.");
  assert.equal(result.longDescription, "Plataforma articulada eléctrica con 300 horas.");
  assert.equal(result.externalReference, "PV-41592");
  assert.equal(result.technicalSheetUrl, "https://online.gamrentals.com/fichas/ficha-tecnica.pdf");
  assert.deepEqual(result.breadcrumbs, ["Maquinaria de ocasión", "Elevación"]);
});

test("GAM: prioriza la descripción corta propia de la ficha frente al metadato SEO", () => {
  const result = parseProductPage(`<html><head><meta property="og:description" content="Resumen SEO"></head><body>
    <h1>JLG E300AJP</h1><div class="product-description-short"><p>Resumen comercial real.</p></div>
    <div id="description"><p>Descripción técnica detallada.</p></div></body></html>`, url);
  assert.equal(result.shortDescription, "Resumen comercial real.");
  assert.equal(result.longDescription, "Descripción técnica detallada.");
});

test("GAM: no copia la descripción larga al campo corto por ausencia de texto SEO", () => {
  const result = parseProductPage(`<html><body><h1>JLG E300AJP</h1>
    <div id="description"><p>Solo hay una descripción real.</p></div></body></html>`, url);
  assert.equal(result.shortDescription, null);
  assert.equal(result.longDescription, "Solo hay una descripción real.");
});

test("GAM: no duplica metadatos cuando contienen el mismo texto que la descripción", () => {
  const result = parseProductPage(`<html><head><meta property="og:description" content="Máquina revisada."></head><body>
    <h1>JLG E300AJP</h1><div id="description"><p>Máquina revisada.</p></div></body></html>`, url);
  assert.equal(result.shortDescription, null);
  assert.equal(result.longDescription, "Máquina revisada.");
});
