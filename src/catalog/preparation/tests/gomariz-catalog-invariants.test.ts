import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { prepareCached } from "./prepare-cached.js";
import { resolveGomarizShortDescription } from "../mapping/providers/gomariz/short-description.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

const catalog = await loadImportCatalog();
const originalCatalogFile = new URL("../../../../src/testing/fixtures/gomariz/scrape-gomariz-catalog.json", import.meta.url);
const originalProducts = (await readCanonicalCatalog(fileURLToPath(originalCatalogFile))).products;
const value = (record: ProductRecord, name: string): string | number | boolean | null => {
  const attribute = catalog.attributes.find((item) => item.name === name);
  assert.ok(attribute);
  return resolveAttributeValue(record, attribute);
};

test("Gomariz: preparación del catálogo real sin inventar valores ni perder referencias", async () => {
  const products = originalProducts;
  assert.ok(products.length > 0);
  const references = products.map((record) => record.reference);
  assert.equal(new Set(references).size, products.length);
  for (const record of products) {
    const prepared = prepareCached(record, catalog);
    assert.equal(prepared.product.reference, record.reference);
    if (record.price === null) assert.equal(prepared.product.price, null);
    if (record.reference === "GR1356" && record.specs?.Capacidad === "350 l") {
      assert.equal(value(record, "Capacidad del depósito"), 350);
    }
    if (["CC1535", "CC1666"].includes(record.reference ?? "") &&
      record.specs?.["Altura plataforma"] === record.specs?.["Altura almacenaje"] &&
      record.specs?.["Altura de trabajo"] === "20 m") {
      assert.equal(value(record, "Altura de plataforma"), 17.6);
      assert.equal(value(record, "Altura de trabajo"), 20);
    }
  }
});

test("Gomariz: la preparación editorial deriva textos sin modificar el catálogo original", async () => {
  const products = originalProducts;
  const byReference = new Map(products.map((record) => [record.reference, record]));
  for (const record of products) {
    assert.equal(record.shortDescription, null, record.reference ?? record.url);
    const prepared = prepareCached(record, catalog);
    assert.equal(prepared.product.description, resolveGomarizShortDescription(record), record.reference ?? record.url);
    assert.ok(prepared.importIssues);
    if (prepared.product.description === null) {
      assert.ok(prepared.importIssues.createMany.length > 0, record.reference ?? record.url);
    }
  }
  for (const reference of ["CC1535", "CC1666"]) {
    const record = byReference.get(reference);
    assert.ok(record);
    const prepared = prepareCached(record, catalog);
    assert.ok(!prepared.issues.includes("Atributo no normalizable: Altura de plataforma"), reference);
    assert.equal(value(record, "Altura de plataforma"), 17.6);
    assert.equal(prepared.status, "ready");
  }
  for (const reference of ["5051BDX", "1011JFB", "RE454", "PV556"]) {
    const record = byReference.get(reference);
    assert.ok(record);
    const prepared = prepareCached(record, catalog);
    assert.equal(prepared.status, "ready", reference);
    assert.ok(!prepared.issues.includes("Tipo de máquina de origen sin confirmar"), reference);
    assert.equal(prepared.product.categorySellID, null);
  }
});
