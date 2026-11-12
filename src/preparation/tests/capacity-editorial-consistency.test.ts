import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../shared/classification/mapping/attribute-mapping.js";
import { gamConfirmedAbsentScalar } from "../gam/classification/mapping/unrepresentable.js";
import { prepareSourceProduct, prepareWithCatalog } from "../prepare-product.js";

const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");

const find = (reference: string): ProductRecord => {
  const record = products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("El filtro numérico de carga no anuncia capacidades condicionadas o contradictorias", async () => {
  const catalog = await loadImportCatalog();
  const capacity = catalog.attributes.find((entry) => entry.name === "Capacidad de la cesta");
  assert.ok(capacity);
  for (const reference of ["4792", "4807", "6934"]) {
    const record = find(reference);
    const technical = prepareSourceProduct(record);
    const commercial = prepareWithCatalog(record, catalog);
    assert.deepEqual(resolveAttribute(record, capacity), { status: "not_observed", value: null }, reference);
    assert.equal(commercial.status, "ready", reference);
    assert.equal(commercial.product.spec["Capacidad de carga (kg)"], technical.product.spec["Capacidad de carga (kg)"], reference);
    assert.ok(commercial.product.attributes.every((entry) => entry.attributeID !== capacity.id), reference);
  }
  const sample = find("4807");
  const modified = { ...sample, longDescription: "Ficha alternativa sin contradicción de carga" };
  assert.equal(gamConfirmedAbsentScalar(modified, capacity), false);
});
