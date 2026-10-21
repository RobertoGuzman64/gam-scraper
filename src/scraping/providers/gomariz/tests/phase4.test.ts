import assert from "node:assert/strict";
import test from "node:test";
import { parseGomarizProduct } from "../parsers.js";

const url = "https://www.gomarizrent.com/venta/energia/grupo-electrogeno/pramac-gpw200p-fn/";

test("Gomariz: la única descripción publicada queda solo como descripción larga", () => {
  const result = parseGomarizProduct(`<html><main><h1>PRAMAC GPW200P-FN</h1>
    <p>Referencia: GR1356 Año: 2022 Marca: PRAMAC Ver precio</p>
    <h2>Descripción</h2><p>Generador con motor diésel.</p>
    <h2>Dimensiones</h2><p>Longitud: 3 m</p></main></html>`, url);
  assert.equal(result.shortDescription, null);
  assert.equal(result.longDescription, "Generador con motor diésel.");
});
