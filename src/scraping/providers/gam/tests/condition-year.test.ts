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
