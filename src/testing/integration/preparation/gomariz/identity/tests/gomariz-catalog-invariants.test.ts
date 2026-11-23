import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareCached } from "../../../../../../preparation/testing/prepare-cached.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");

test("Gomariz: prepara el inventario canónico vigente sin inventar precios ni perder identidades", () => {
  const products = source.products;
  assert.ok(products.length > 0);
  assert.equal(source.productCount, products.length);
  const references = products.map((record) => record.reference);
  assert.equal(new Set(references).size, products.length);
  for (const record of products) {
    const prepared = prepareCached(record, catalog);
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    if (record.price === null) assert.equal(prepared.product.price, null);
  }
});
