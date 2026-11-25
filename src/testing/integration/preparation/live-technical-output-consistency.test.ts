import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/originals/canonical-catalog.js";
import { createPreparedSourceFixture } from "../../builders/prepared-source-fixture.js";

const prepareOriginal = createPreparedSourceFixture();

test("la salida técnica de los tres proveedores no reintroduce unidades duplicadas", async () => {
  for (const path of [
    "catalogs/providers/gam/original/scrape-gam-catalog.json",
    "catalogs/providers/gomariz/original/scrape-gomariz-catalog.json",
    "catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json"
  ]) {
    const catalog = await readCanonicalCatalog(path);
    for (const original of catalog.products) {
      const prepared = prepareOriginal(original).product;
      for (const [key, value] of Object.entries(prepared.spec)) {
        if (typeof value !== "string") continue;
        assert.doesNotMatch(value, /\bmm\s+metros?\b|\bm\s+metros?\b|\(V\/Ah\)\s*\(V\/Ah\)/iu,
          `${original.providerId}:${original.reference}:${key}`);
      }
    }
  }
});
