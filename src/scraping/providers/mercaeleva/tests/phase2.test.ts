import assert from "node:assert/strict";
import test from "node:test";
import { parseMercaelevaProduct } from "../parsers.js";

const url = "https://sales.mercaeleva.com/es/for-sale/machine/Hollandlift-HL-220-E12-M140-0406";
const contaminatedUrl = "https://sales.mercaeleva.com/es/for-sale/machine/MB-ESL122-M288-9739";

const row = (name: string, value: string): string => `<div class="field"><span>${name}</span><span>${value}</span></div>`;

test("Mercaeleva: lee todas las características de las secciones, sin tope de diez", () => {
  const html = `<html><body><h1>Hollandlift HL-220 E12 PLATAFORMA TIJERA ELECTRICA 22 MT</h1>
    <h2>Machine description</h2><p>Ref. 1886 ELECTRIC SCISSOR LIFT</p>
    <h2>Información general</h2><h3>General</h3>
    ${row("Marca", "Hollandlift")}${row("Modelo", "HL-220 E12")}${row("Título adicional", "PLATAFORMA TIJERA ELECTRICA 22 MT")}
    ${row("Año de fabricación", "2017")}${row("Artículo No.", "1887")}${row("Horas laborales", "859 h")}
    ${row("Estado", "Usado")}${row("Condición general", "Bueno")}${row("Tipo de motor", "Eléctrico")}
    <h2>Chasis</h2>
    ${row("Altura de trabajo", "22 m")}${row("Capacidad de carga", "500 kg")}${row("Peso", "9000 kg")}${row("Anchura", "1,20 m")}
    <h2>Información de venta</h2>${row("Departamento", "Ventas")}
  </body></html>`;
  const parsed = parseMercaelevaProduct(html, url);
  assert.equal(Object.keys(parsed.specs ?? {}).length, 13);
  assert.equal(parsed.specs?.["Altura de trabajo"], "22 m");
  assert.equal(parsed.specs?.["Capacidad de carga"], "500 kg");
  assert.equal(parsed.specs?.["Peso"], "9000 kg");
  assert.equal(parsed.specs?.["Departamento"], undefined);
  assert.equal(parsed.year, "2017");
  assert.equal(parsed.brand, "Hollandlift");
  assert.equal(parsed.model, "HL-220 E12");
});

test("Mercaeleva: admite filas de definición y celdas con características adicionales", () => {
  const html = `<html><body><h1>Equipo de prueba</h1><h2>General information</h2>
    <dl><dt>Marca</dt><dd>JLG</dd><dt>Modelo</dt><dd>450 AJ</dd><dt>Altura de trabajo</dt><dd>16 m</dd></dl>
    <table><tr><th>Capacidad de carga</th><td>230 kg</td></tr></table>
    <h2>Sales information</h2></body></html>`;
  const parsed = parseMercaelevaProduct(html, url);
  assert.equal(parsed.specs?.["Marca"], "JLG");
  assert.equal(parsed.specs?.["Modelo"], "450 AJ");
  assert.equal(parsed.specs?.["Altura de trabajo"], "16 m");
  assert.equal(parsed.specs?.["Capacidad de carga"], "230 kg");
});

test("Mercaeleva: descarta scripts y fragmentos JSON sin borrar una descripción válida", () => {
  const html = `<html><body><h1>MB ESL122 Apilador Eléctrico</h1>
    <h2>Machine description</h2><p>Apilador eléctrico revisado. ","parameterType":"LABEL","parameterUnit":null</p>
    <script>window.__state = {"machineDescription":"Machine description \\",\\"parameterType\\":\\"LABEL\\""};</script>
    <h2>Información general</h2>${row("Marca", "MB")}${row("Modelo", "ESL122")}
  </body></html>`;
  const parsed = parseMercaelevaProduct(html, contaminatedUrl);
  assert.equal(parsed.longDescription, "Apilador eléctrico revisado.");
  assert.equal(parsed.shortDescription, null);
  assert.equal(parsed.specs?.["Marca"], "MB");
});

test("Mercaeleva: una descripción formada solo por JSON no se publica", () => {
  const html = `<html><body><h1>MB ESL122 Apilador Eléctrico</h1>
    <h2>Machine description</h2><p>","parameterType":"LABEL","parameterUnit":null</p>
    <h2>Información general</h2>${row("Marca", "MB")}</body></html>`;
  const parsed = parseMercaelevaProduct(html, contaminatedUrl);
  assert.equal(parsed.longDescription, null);
  assert.equal(parsed.shortDescription, null);
});
