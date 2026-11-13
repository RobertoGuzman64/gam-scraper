import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadImportCatalog } from "../../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveAttributeValue } from "../../../../../../preparation/shared/classification/mapping/attribute-mapping.js";
import { prepareCached } from "../../../../../../preparation/testing/prepare-cached.js";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";

const catalog = await loadImportCatalog();
const originalCatalogFile = new URL("../../../../../../../src/testing/fixtures/gomariz/scrape-gomariz-catalog.json", import.meta.url);
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

