import assert from "node:assert/strict";
import test from "node:test";
import { parseProductPage } from "../parsers.js";

const ficha = (details: string): string => `<html><body><main>
  <h1>Máquina de ocasión</h1>
  <dl><dt>Marca</dt><dd>JLG</dd><dt>Modelo</dt><dd>E300AJP</dd></dl>
  <section id="description"><p>${details}</p></section>
  <img src="https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg">
</main></body></html>`;

test("GAM: reconoce ocasión desde la URL de furgonetas", () => {
  const parsed = parseProductPage(ficha("Vehículo de ocasión"),
    "https://online.gamrentals.com/es/furgonetas-electricas-de-ocasion/5918-paxster-gen-22");
  assert.equal(parsed.condition, "Segunda mano");
});

test("GAM: no inventa condición para un lote sin indicación explícita", () => {
  const parsed = parseProductPage(ficha("Varios artículos"),
    "https://online.gamrentals.com/es/lotes/6969-lote-9");
  assert.equal(parsed.condition, null);
});

test("GAM: recupera el año de fabricación explícito de la descripción", () => {
  const parsed = parseProductPage(ficha("Año de fabricación: 2017. Revisada."),
    "https://online.gamrentals.com/es/equipos-segunda-mano/7000-maquina");
  assert.equal(parsed.year, "2017");
  assert.equal(parsed.yearSource, "descripcion");
});

test("GAM: recupera el año visible en la URL cuando no consta en la ficha", () => {
  const parsed = parseProductPage(ficha("Plataforma en buen estado."),
    "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6934-2007-jlg-e300ajp");
  assert.equal(parsed.year, "2007");
  assert.equal(parsed.yearSource, "url");
});

test("GAM: nunca interpreta la capacidad en kg del título como año de fabricación", () => {
  for (const [reference, url] of [
    ["6588", "https://online.gamrentals.com/es/preparapedidos-segunda-mano/6588-2019-yale-mo20p"],
    ["6590", "https://online.gamrentals.com/es/preparapedidos-segunda-mano/6590-2019-yale-mo20p"]
  ] as const) {
    const html = ficha("Preparapedidos eléctrico con capacidad de carga de 2000 kg.")
      .replace("Máquina de ocasión", "Preparapedidos 2000 Kg YALE MO20P");
    const parsed = parseProductPage(html, url);
    assert.equal(parsed.year, "2019", reference);
    assert.equal(parsed.yearSource, "url", reference);
  }
  const noYear = parseProductPage(ficha("Carga de 2000 kg.")
    .replace("Máquina de ocasión", "Preparapedidos 2000 Kg YALE MO20P"),
    "https://online.gamrentals.com/es/yale/2239-preparapedidos-2000-k-yale-mo20p");
  assert.equal(noYear.year, null);
  assert.equal(noYear.yearSource, null);
});

test("GAM: distingue el año explícito del título, la descripción y los slugs no representativos", () => {
  const withTitle = parseProductPage(ficha("Sin fecha de fabricación.")
    .replace("Máquina de ocasión", "Máquina de ocasión · Año 2016 · Capacidad 2000 kg"),
    "https://online.gamrentals.com/es/ocasion/7001-maquina");
  assert.equal(withTitle.year, "2016");
  assert.equal(withTitle.yearSource, "titulo");
  const withDescription = parseProductPage(ficha("Año de fabricación: 2018.")
    .replace("Máquina de ocasión", "Preparapedidos 2000 kg"),
    "https://online.gamrentals.com/es/ocasion/7001-2016-otra-maquina");
  assert.equal(withDescription.year, "2018");
  assert.equal(withDescription.yearSource, "descripcion");
  const unrelatedSlug = parseProductPage(ficha("No se indica año.")
    .replace("Máquina de ocasión", "Plataforma tijera 2000 kg"),
    "https://online.gamrentals.com/es/ocasion/7001-maquina-modelo-2019");
  assert.equal(unrelatedSlug.year, null);
  assert.equal(unrelatedSlug.yearSource, null);
});
