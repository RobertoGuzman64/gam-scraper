import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGamModulaStorageSummary } from "../../../../evidence/providers/gam/editorial/modula-storage-editorial.js";

const source = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const records = ["3434", "3435", "3436"].map((reference) => {
  const found = source.products.find((product) => product.reference === reference);
  assert.ok(found, reference);
  return found;
});

test("completa el resumen de los almacenes Slim solo con la carga acreditada por bandeja", () => {
  for (const record of records) {
    const snapshot = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.match(prepared.product.description ?? "", /Carga neta por bandeja: 350 kg/);
    assert.doesNotMatch(prepared.product.description ?? "", /Capacidad del almacén ➨/);
    assert.equal(prepared.product.spec["Carga neta por bandeja"], "350 kg");
    assert.equal(prepared.product.spec["Capacidad de carga (kg)"], undefined);
    assert.deepEqual(record, snapshot);
  }
});

test("no incorpora cargas de bandeja sin concordancia de modelo, fuente, altura y especificaciones", () => {
  for (const record of records) {
    const prepared = prepareSourceProduct(record);
    const oldShort = record.shortDescription;
    assert.ok(oldShort);
    const cases = [
      { ...record, model: "MSL99" },
      { ...record, providerId: "gomariz" },
      { ...record, condition: "Segunda mano" as const },
      { ...record, url: record.url.replace("/modula/", "/otros/") },
      { ...record, specs: { ...record.specs, Modelo: "OTRO" } }
    ];
    for (const modified of cases) {
      assert.equal(reconcileGamModulaStorageSummary(modified, oldShort, prepared.product.spec), oldShort);
    }
    assert.equal(reconcileGamModulaStorageSummary(record, oldShort, {
      ...prepared.product.spec, "Carga neta por bandeja": "500 kg"
    }), oldShort);
  }
});
