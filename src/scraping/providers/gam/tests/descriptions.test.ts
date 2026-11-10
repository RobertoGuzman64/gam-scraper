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

test("GAM: conserva metadatos SEO publicados aunque coincidan con la descripción general", () => {
  const result = parseProductPage(`<html><head><meta property="og:description" content="Máquina revisada."></head><body>
    <h1>JLG E300AJP</h1><div id="description"><p>Máquina revisada.</p></div></body></html>`, url);
  assert.equal(result.shortDescription, "Máquina revisada.");
  assert.equal(result.longDescription, "Máquina revisada.");
});

test("GAM: conserva listas y párrafos de la descripción técnica en la pestaña", () => {
  const html = `<html><body><h1>Grupo electrógeno PRAMAC GSW3365M</h1>
    <a href="#description">Descripción</a>
    <section id="description">
      <p>La bancada incorpora apoyos antivibratorios.</p>
      <p>Las características principales son:</p>
      <ul>
        <li>Estructura monolítica y resistente.</li>
        <li>Alta resistencia a los agentes atmosféricos.</li>
      </ul>
      <p>Sistema de combustible:</p>
      <ul><li><p>Inyección directa de combustible.</p></li></ul>
    </section></body></html>`;
  const result = parseProductPage(html, url);
  assert.equal(result.longDescription,
    "La bancada incorpora apoyos antivibratorios. Las características principales son: " +
    "Estructura monolítica y resistente. Alta resistencia a los agentes atmosféricos. " +
    "Sistema de combustible: Inyección directa de combustible.");
});

test("GAM: extrae listas sin párrafos de la descripción técnica", () => {
  const result = parseProductPage(`<html><body><h1>Grupo electrógeno</h1>
    <div id="description"><ul><li>Carrocería insonorizada.</li><li>Ventilación reforzada.</li></ul></div>
    </body></html>`, url);
  assert.equal(result.longDescription, "Carrocería insonorizada. Ventilación reforzada.");
});

test("GAM: conserva listas al extraer la descripción del área de detalles", () => {
  const result = parseProductPage(`<html><body><h1>Grupo electrógeno</h1>
    <div class="product-information"><dl><dt>Marca</dt><dd>PRAMAC</dd></dl>
      <p>Contenedor insonorizado.</p><ul><li>Paneles anticorrosión.</li><li>Acceso lateral.</li></ul>
    </div></body></html>`, url);
  assert.equal(result.longDescription, "Contenedor insonorizado. Paneles anticorrosión. Acceso lateral.");
});
