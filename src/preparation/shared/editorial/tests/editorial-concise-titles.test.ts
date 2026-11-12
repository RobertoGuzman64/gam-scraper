import assert from "node:assert/strict";
import test from "node:test";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolvePreparedEditorialTitle } from "../mapping/prepared-editorial-title.js";
import { controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaForklift } from "./editorial-contract-records.js";

test("el título procede de la familia, la fuente y las magnitudes, no de una referencia histórica", () => {
  for (const source of [controlledGamForklift(), controlledGomarizPlatform(), controlledMercaelevaForklift()]) {
    const initial = JSON.stringify(source);
    const title = resolvePreparedEditorialTitle(source, source);
    assert.ok(title?.includes(`${source.brand} ${source.model}`));
    const prepared = prepareSourceProduct(source).product;
    assert.equal(prepared.title, title);
    assert.equal(prepared.description_title, title);
    assert.equal(prepared.reference, source.reference);
    assert.equal(prepared.sourceUrl, source.url);
    assert.equal(JSON.stringify(source), initial);
  }
});

test("el mismo modelo de otra unidad reutiliza la regla de título", () => {
  const source = controlledGomarizPlatform();
  const other = { ...source, reference: "OTRA-UNIDAD", url: "https://www.gomarizrent.com/producto/otra-marca-modelo10/" };
  assert.equal(resolvePreparedEditorialTitle(other, other), resolvePreparedEditorialTitle(source, source));
});

test("un modelo o magnitud discordante no recibe título técnico inventado", () => {
  const source = controlledGomarizPlatform();
  for (const changed of [
    { ...source, brand: "OTRA MARCA" },
    { ...source, model: "OTRO MODELO" },
    { ...source, url: "https://example.invalid/producto/marca-modelo10/" },
    { ...source, specs: { ...source.specs, "Altura de trabajo": "10 kg" } }
  ]) {
    assert.equal(resolvePreparedEditorialTitle(changed, changed), changed.title);
  }
});
