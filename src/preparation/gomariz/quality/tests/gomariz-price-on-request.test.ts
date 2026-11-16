import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareProduct } from "../../../../commercial/legacy-export/prepare-product.js";
import { loadImportCatalog } from "../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { hasDocumentedGomarizPriceOnRequest } from "../price-on-request.js";

const catalog = await loadImportCatalog();
const original = (): ProductRecord => accreditedSourceRecord("gomariz-documented-weight", "TE1152");

test("el precio cero acreditado como consulta se exporta nulo sin precio ficticio", () => {
  const source = original();
  const snapshot = JSON.stringify(source);
  assert.equal(source.price, "0,00€");
  assert.equal(hasDocumentedGomarizPriceOnRequest(source), true);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.price, null);
  assert.equal(prepared.product.reference, "TE1152");
  assert.equal(prepared.product.sourceUrl, source.url);
  const imported = prepareProduct(source, catalog);
  assert.equal(imported.status, "ready");
  assert.deepEqual(imported.issues, []);
  assert.equal(imported.product.price, null);
  assert.equal(JSON.stringify(source), snapshot);
});

test("el precio por consulta no se traslada a otra unidad, fuente ni variante", () => {
  const source = original();
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "gam" },
    { ...source, reference: "TE1152-OTRA" },
    { ...source, url: `${source.url}?version=2` },
    { ...source, categoryKey: "alquiler" },
    { ...source, condition: "Nuevo" },
    { ...source, brand: "OTRA" },
    { ...source, model: "OTRO" },
    { ...source, price: "0€" },
    { ...source, price: "10,00€" },
    { ...source, title: `${source.title} variante` },
    { ...source, shortDescription: `${source.shortDescription} variante` },
    { ...source, longDescription: `${source.longDescription} variante` },
    { ...source, specs: { ...source.specs, Peso: "OTRO" } }
  ];
  for (const variant of variants) {
    assert.equal(hasDocumentedGomarizPriceOnRequest(variant), false, variant.reference ?? variant.url);
  }
  for (const variant of variants.filter((item) => item.price === "0,00€")) {
    assert.ok(prepareSourceProduct(variant).issues.includes("Precio publicado inválido"), variant.reference ?? variant.url);
  }
});
