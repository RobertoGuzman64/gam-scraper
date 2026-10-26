import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { inspectGamBasketDom, pendingGamBasketRecords } from "../basket-dom-evidence.js";

test("GAM: diagnostica las 15 cestas pendientes tras recuperar fragmentos repetidos sin alterar los valores originales", async () => {
  const catalog = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
  const pending = pendingGamBasketRecords(catalog.products);
  assert.equal(pending.length, 15);
  assert.deepEqual(pending.map((record) => record.reference).sort(), [
    "6169", "6171", "6607", "6614",
    "6615", "6616", "6617", "6622", "6625", "6626", "6630", "6631", "6632", "6642", "6669"
  ].sort());
  assert.equal(pending.find((record) => record.reference === "6607")?.specs?.["Dimensiones Cesta"], "1 76 83X0 metros");
});

test("GAM: conserva el HTML original y los nodos del mismo campo para estudiar una cadena fragmentada", () => {
  const evidence = inspectGamBasketDom(`<main><dl><dt>Dimensiones Cesta</dt><dd><span>1</span> <span>1,83 x 0,76</span> <span>76</span> <span>83 x 0 metros</span></dd></dl></main>`);
  assert.equal(evidence.extractedValue, "1 1,83 x 0,76 76 83 x 0 metros");
  assert.equal(evidence.fields.length, 1);
  assert.equal(evidence.fields[0]?.location, "definition");
  assert.deepEqual(evidence.fields[0]?.parts.map((part) => part.text), ["1", "1,83 x 0,76", "76", "83 x 0 metros"]);
  assert.match(evidence.fields[0]?.rawHtml ?? "", /<span>1,83 x 0,76<\/span>/);
});

test("GAM: no confunde medidas de productos relacionados ni elige entre fuentes divergentes", () => {
  const evidence = inspectGamBasketDom(`<main>
    <dl><dt>Dimensiones Cesta</dt><dd>1 1,83 x 0,76 76 83 x 0 metros</dd></dl>
    <table><tr><th>Dimensiones Cesta</th><td>2,4 x 1,17 metros</td></tr></table>
    <section class="related-products"><dl><dt>Dimensiones Cesta</dt><dd>3 x 1 metros</dd></dl></section>
  </main>`);
  assert.equal(evidence.fields.length, 2);
  assert.equal(evidence.fields[0]?.rawText, "1 1,83 x 0,76 76 83 x 0 metros");
  assert.equal(evidence.fields[1]?.rawText, "2,4 x 1,17 metros");
  assert.deepEqual(evidence.extractedValue, ["1 1,83 x 0,76 76 83 x 0 metros", "2,4 x 1,17 metros"]);
});
