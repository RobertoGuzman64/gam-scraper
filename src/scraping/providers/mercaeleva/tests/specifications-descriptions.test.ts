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

test("Mercaeleva: excluye ofertas, contacto, direcciones y títulos de producto de las especificaciones", () => {
  const html = `<html><body><h1>BT LPE200/8 TRANSPALET ELECTRICO</h1>
    <h2>Información general</h2>
    ${row("Marca", "BT")}${row("Modelo", "LPE200/8")}${row("Año de fabricación", "2012")}
    ${row("¡Haz una oferta!", "Contáctenos y haga su oferta. Un vendedor procesará su oferta.")}
    ${row("Dpt Gestión Flota", "Teléfono: +34633666089")}
    ${row("Avinguda de Tarragona, 106, 08720, Barcelona, Vilafranca del Penedès, ES", "sales@mercaeleva.com")}
    ${row("BT LPE200/8", "Precio a consultar")}
    <h2>Contacto</h2>${row("Horas laborales", "1000 h")}
  </body></html>`;
  const parsed = parseMercaelevaProduct(html, "https://sales.mercaeleva.com/es/for-sale/machine/BT-LPE200-8-M239-6301");
  assert.equal(parsed.specs?.["Marca"], "BT");
  assert.equal(parsed.specs?.["Modelo"], "LPE200/8");
  assert.equal(parsed.specs?.["Año de fabricación"], "2012");
  assert.equal(parsed.specs?.["¡Haz una oferta!"], undefined);
  assert.equal(parsed.specs?.["Dpt Gestión Flota"], undefined);
  assert.equal(parsed.specs?.["Avinguda de Tarragona, 106, 08720, Barcelona, Vilafranca del Penedès, ES"], undefined);
  assert.equal(parsed.specs?.["BT LPE200/8"], undefined);
});

test("Mercaeleva: mantiene etiquetas técnicas adicionales en filas semánticas", () => {
  const html = `<html><body><h1>Equipo de prueba</h1>
    <h2>Potencia y rendimiento</h2>
    <dl><dt>Capacidad máxima de elevación</dt><dd>2500 kg</dd><dt>Distancia del centro de gravedad</dt><dd>500 mm</dd><dt>Radio de giro</dt><dd>1,6 m</dd></dl>
    <h2>Información de venta</h2><dl><dt>Departamento</dt><dd>Ventas</dd></dl>
  </body></html>`;
  const parsed = parseMercaelevaProduct(html, url);
  assert.equal(parsed.specs?.["Capacidad máxima de elevación"], "2500 kg");
  assert.equal(parsed.specs?.["Distancia del centro de gravedad"], "500 mm");
  assert.equal(parsed.specs?.["Radio de giro"], "1,6 m");
  assert.equal(parsed.specs?.["Departamento"], undefined);
});

test("Mercaeleva: no rescata características de la sección de contacto mediante el fallback", () => {
  const html = `<html><body><h1>JLG 450 AJ</h1>
    <h2>Información general</h2>${row("Marca", "JLG")}${row("Modelo", "450 AJ")}
    <h2>Contacto</h2>${row("Horas laborales", "1000 h")}${row("Capacidad de carga", "2000 kg")}
  </body></html>`;
  const parsed = parseMercaelevaProduct(html, url);
  assert.equal(parsed.specs?.["Marca"], "JLG");
  assert.equal(parsed.specs?.["Horas laborales"], undefined);
  assert.equal(parsed.specs?.["Capacidad de carga"], undefined);
});

test("Mercaeleva: conserva cabina y ruedas cuando las características comparten contenedor", () => {
  const html = `<html><body><h1>Nissan Q02L20CU CARRETILLA ELEVADORA ELECTRICA 2000 KG</h1>
    <h2>Información general</h2>
    <section><span>Marca</span><span>Nissan</span><span>Modelo</span><span>Q02L20CU</span>
    <span>Tipo de cabina</span><span>Guardia superior</span><span>Número de ruedas</span><span>4.0</span></section>
    <h2>Información de venta</h2><section><span>Dpt Gestión Flota</span><span>Teléfono: +34633666089</span></section>
  </body></html>`;
  const parsed = parseMercaelevaProduct(html, "https://sales.mercaeleva.com/es/for-sale/machine/Nissan-Q02L20CU-M121-6486");
  assert.equal(parsed.specs?.["Tipo de cabina"], "Guardia superior");
  assert.equal(parsed.specs?.["Número de ruedas"], "4.0");
  assert.equal(parsed.specs?.["Dpt Gestión Flota"], undefined);
});

test("Mercaeleva: recupera capacidad y altura máxima desde detalles técnicos adicionales", () => {
  const html = `<html><body><h1>JLG 4014PS MANIPULADOR TELESCOPICO 14 MT</h1>
    <h2>Información general</h2>${row("Marca", "JLG")}${row("Modelo", "4014PS")}
    <h2>Detalles adicionales</h2>${row("Capacidad máxima de elevación", "4000 kg")}${row("Altura máxima de elevación", "14 m")}
    <h2>Información de venta</h2>${row("¡Haz una oferta!", "Contáctenos")}
  </body></html>`;
  const parsed = parseMercaelevaProduct(html, "https://sales.mercaeleva.com/es/for-sale/machine/JLG-4014PS-M200-9533");
  assert.equal(parsed.specs?.["Capacidad máxima de elevación"], "4000 kg");
  assert.equal(parsed.specs?.["Altura máxima de elevación"], "14 m");
  assert.equal(parsed.specs?.["¡Haz una oferta!"], undefined);
});

test("Mercaeleva: no recupera especificaciones desde información comercial o contacto", () => {
  const html = `<html><body><h1>Equipo de prueba</h1>
    <h2>Información general</h2>${row("Marca", "JLG")}
    <h2>Información de venta</h2><h3>Detalles</h3>${row("Tipo de cabina", "Texto comercial")}
    <h2>Contacto</h2><h3>Detalles</h3>${row("Número de ruedas", "4.0")}
    ${row("Capacidad máxima de elevación", "4000 kg")}${row("Altura máxima de elevación", "14 m")}
  </body></html>`;
  const parsed = parseMercaelevaProduct(html, url);
  assert.equal(parsed.specs?.["Marca"], "JLG");
  for (const label of ["Tipo de cabina", "Número de ruedas", "Capacidad máxima de elevación", "Altura máxima de elevación"]) {
    assert.equal(parsed.specs?.[label], undefined);
  }
});


test("Mercaeleva: usa únicamente el Estado explícito de la ficha para distinguir nueva y usada", () => {
  const machine = (state: string): string => `<html><body><h1>MB ESL122 Apilador Eléctrico</h1>
    <h2>Información general</h2>${row("Estado", state)}${row("Condición general", "Bueno")}
    </body></html>`;
  for (const state of ["Usado", "Usada", "Segunda mano"]) {
    const parsed = parseMercaelevaProduct(machine(state), contaminatedUrl);
    assert.equal(parsed.condition, "Segunda mano", state);
    assert.equal(parsed.specs?.["Estado"], state);
  }
  for (const state of ["Nuevo", "Nueva"]) {
    const parsed = parseMercaelevaProduct(machine(state), contaminatedUrl);
    assert.equal(parsed.condition, "Nuevo", state);
    assert.equal(parsed.specs?.["Estado"], state);
  }
});

test("Mercaeleva: no inventa condición si el Estado falta o no es inequívoco", () => {
  const unknown = parseMercaelevaProduct(`<html><body><h1>MB ESL122 Apilador Eléctrico</h1>
    <h2>Información general</h2>${row("Condición general", "Como nuevo")}
    </body></html>`, contaminatedUrl);
  assert.equal(unknown.condition, null);
  assert.equal(unknown.specs?.["Estado"], undefined);

  for (const state of ["Como nuevo", "Bueno", "Consultar"]) {
    const parsed = parseMercaelevaProduct(`<html><body><h1>MB ESL122 Apilador Eléctrico</h1>
      <h2>Información general</h2>${row("Estado", state)}
      </body></html>`, contaminatedUrl);
    assert.equal(parsed.condition, null, state);
  }
});

test("Mercaeleva: conserva especificaciones técnicas repetidas y deja sin resolver metadatos incompatibles", () => {
  const html = `<html><body><h1>Linde E48P CARRETILLA ELEVADORA ELECTRICA 4800 KG</h1>
    <h2>Información general</h2>
    ${row("Marca", "Linde")}${row("Modelo", "E48P")}${row("Estado", "Usado")}
    ${row("Capacidad máxima de elevación", "4800 kg")}${row("Tipo de mástil", "Dúplex")}
    ${row("Horas laborales", "2649 h")}${row("Año de fabricación", "2007")}
    <h2>Potencia y rendimiento</h2>
    ${row("Capacidad máxima de elevación", "3000 kg")}${row("Tipo de mástil", "Triple")}
    ${row("Horas laborales", "3000 h")}${row("Año de fabricación", "2008")}
    ${row("Modelo", "E45P")}${row("Estado", "Nuevo")}
  </body></html>`;
  const parsed = parseMercaelevaProduct(html, "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E48P-M827-8304");
  assert.deepEqual(parsed.specs?.["Capacidad máxima de elevación"], ["4800 kg", "3000 kg"]);
  assert.deepEqual(parsed.specs?.["Tipo de mástil"], ["Dúplex", "Triple"]);
  assert.deepEqual(parsed.specs?.["Modelo"], ["E48P", "E45P"]);
  assert.deepEqual(parsed.specs?.["Horas laborales"], ["2649 h", "3000 h"]);
  assert.deepEqual(parsed.specs?.["Año de fabricación"], ["2007", "2008"]);
  assert.deepEqual(parsed.specs?.["Estado"], ["Usado", "Nuevo"]);
  assert.equal(parsed.brand, "Linde");
  assert.equal(parsed.model, null);
  assert.equal(parsed.condition, null);
  assert.equal(parsed.horometer, null);
  assert.equal(parsed.year, null);
});

test("Mercaeleva: especificaciones repetidas concordantes no se convierten en conflictos", () => {
  const html = `<html><body><h1>Linde E48P CARRETILLA ELEVADORA ELECTRICA 4800 KG</h1>
    <h2>General information</h2>
    ${row("Estado", "Usado")}${row("Tipo de mástil", "Triple")}${row("Capacidad máxima de elevación", "4800 kg")}
    <h2>Chasis</h2>
    ${row("Estado", "Usado")}${row("Tipo de mástil", "Triple")}${row("Capacidad máxima de elevación", "4800 kg")}
  </body></html>`;
  const parsed = parseMercaelevaProduct(html, "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E48P-M827-8304");
  assert.equal(parsed.specs?.["Tipo de mástil"], "Triple");
  assert.equal(parsed.specs?.["Capacidad máxima de elevación"], "4800 kg");
  assert.equal(parsed.condition, "Segunda mano");
});


test("Mercaeleva: una lectura de horas negativa no se convierte en positiva", () => {
  const source = (hours: string) => `<html><body><h1>MB EPL185 Transpaleta Eléctrica</h1>
    <h2>Información general</h2>${row("Horas laborales", hours)}
  </body></html>`;
  const url = "https://sales.mercaeleva.com/es/for-sale/machine/MB-EPL185-M119-9334";
  const negative = parseMercaelevaProduct(source("−1 h"), url);
  assert.equal(negative.specs?.["Horas laborales"], "−1 h");
  assert.equal(negative.horometer, null);
  assert.equal(parseMercaelevaProduct(source("-1 h"), url).horometer, null);
  assert.equal(parseMercaelevaProduct(source("1 h"), url).horometer, "1");
  assert.equal(parseMercaelevaProduct(source("16 532 h"), url).horometer, "16 532");
});
