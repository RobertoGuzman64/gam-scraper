import assert from "node:assert/strict";
import test from "node:test";
import { parseGomarizProduct } from "../parsers.js";

const url = "https://www.gomarizrent.com/venta/energia/grupo-electrogeno/pramac-gpw200p-fn/";

test("Gomariz: extrae metadatos etiquetados y potencia sin confundirlos con el título", () => {
  const html = `<html><main><h1>PRAMAC GPW200P-FN</h1>
    <p>Referencia: GR1356 Año: 2022 Marca: PRAMAC Modelo: GPW200P-FN Horómetro: 1250 h Nº de serie: ABC123 Ubicación: Murcia Ver precio</p>
    <h2>Descripción</h2><p>Generador revisado GR1356.</p>
    <h2>Dimensiones</h2><p>Longitud: 3 m Peso: 3000 kg</p>
    <h2>Especificaciones técnicas</h2><p>Motor: Diesel Potencia: 200 kW Combustible: Diésel</p>
    <p>Ver ficha técnica</p></main></html>`;
  const result = parseGomarizProduct(html, url);
  assert.equal(result.brand, "PRAMAC");
  assert.equal(result.model, "GPW200P-FN");
  assert.equal(result.location, "Murcia");
  assert.equal(result.horometer, "1250 h");
  assert.equal(result.serialNumber, "ABC123");
  assert.equal(result.specs?.Potencia, "200 kW");
  assert.equal(result.specs?.Combustible, "Diésel");
  assert.equal(result.price, null);
});

test("Gomariz: no inventa ubicación, serie ni precio cuando solo ofrece consultar", () => {
  const html = `<html><main><h1>LGMG SS0507E</h1>
    <p>Referencia: TE1858 Año: 2022 Marca: LGMG Ver precio</p>
    <h2>Descripción</h2><p>Las Tijeras Eléctricas están diseñadas para interior.</p>
    <h2>Dimensiones</h2><p>Altura plataforma: 14.30 m Altura de trabajo: 6.3 m</p>
    <p>Ver ficha técnica</p></main></html>`;
  const result = parseGomarizProduct(html,
    "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-ss0507etijera-electrica-electric-scissor/");
  assert.equal(result.price, null);
  assert.equal(result.location, null);
  assert.equal(result.serialNumber, null);
  assert.equal(result.specs?.["Altura plataforma"], undefined);
  assert.equal(result.specs?.["Altura de trabajo"], "6.3 m");
});

test("Gomariz: recupera motor y potencia cuando no hay sección de dimensiones", () => {
  const html = `<html><main><h1>PRAMAC GPW200P-FN</h1>
    <p>Referencia: GR1356 Año: 2022 Marca: PRAMAC Ver precio</p>
    <h2>Descripción</h2><p>Grupo electrógeno.</p>
    <h2>Especificaciones técnicas</h2><p>Motor: Diésel Potencia: 200 kW Combustible: Diésel</p>
    <p>Ver ficha técnica</p></main></html>`;
  const parsed = parseGomarizProduct(html, url);
  assert.equal(parsed.specs?.Motor, "Diésel");
  assert.equal(parsed.specs?.Potencia, "200 kW");
});
