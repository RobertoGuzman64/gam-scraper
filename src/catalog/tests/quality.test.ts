import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogItems } from "../quality.js";
import type { ProductRecord } from "../../contracts/catalog.js";

const productUrl = "https://online.gamrentals.com/es/34-carretillas-elevadoras-nuevas/8000-carretilla-hyster.html";

test("scrapedAt no cambia la huella del producto entre ejecuciones", () => {
  const base: ProductRecord = {
    providerId: "gam", categoryKey: "elevacion", categoryName: "Elevación", url: productUrl,
    title: "Máquina", reference: "8000", price: null, shortDescription: null, longDescription: null,
    brand: null, model: null, year: null, location: null, country: null,
    horometer: null, serialNumber: null, image: null, scrapedAt: "2026-10-19T11:00:00Z"
  };
  assert.deepEqual(buildCatalogItems([base]), buildCatalogItems([{ ...base, scrapedAt: "2026-10-20T11:00:00Z" }]));
});
