import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGamElectricTowTractorEditorial } from "../../../editorial/evidence/hyster-tow-tractor-editorial.js";

const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const byReference = new Map(products.map((product) => [product.reference, product]));

for (const [reference, model, capacity] of [
  ["2134", "LO5.0T", "5000"],
  ["2135", "LO7.0T", "7000"]
] as const) {
  test(`Hyster ${model}: publica tracción eléctrica y capacidad de arrastre sin alterar el origen`, () => {
    const source = byReference.get(reference);
    assert.ok(source);
    const snapshot = JSON.stringify(source);
    const prepared = prepareSourceProduct(source).product;
    assert.equal(prepared.title, source.title);
    assert.equal(prepared.description, source.shortDescription?.replace("Capacidad de carga", "Capacidad de arrastre"));
    assert.ok(prepared.description_general?.includes("sistema de tracción eléctrico de 24 V"));
    assert.ok(prepared.description_general?.includes("accionamiento eléctrico"));
    assert.doesNotMatch(prepared.description_general ?? "", /\bdi[eé]sel\b|motor de alta potencia/i);
    assert.equal(prepared.spec["Capacidad de arrastre"], `${capacity} KG`);
    assert.equal(prepared.spec["Capacidad de carga (kg)"], undefined);
    assert.equal(prepared.spec["Capacidad de la batería"], source.specs?.["Capacidad de la batería"]);
    assert.equal(JSON.stringify(source), snapshot);
  });
  test(`Hyster ${model}: no modifica otras referencias, variantes ni baterías`, () => {
    const source = byReference.get(reference);
    assert.ok(source);
    const prepared = prepareSourceProduct(source).product;
    for (const changed of [
      { ...source, reference: "9999" },
      { ...source, providerId: "gomariz" },
      { ...source, brand: "OTRA" },
      { ...source, model: "LO4.0T" },
      { ...source, condition: "Segunda mano" as const },
      { ...source, specs: { ...source.specs, "Capacidad de la batería": "48V / 300Ah" } },
      { ...source, url: "https://online.gamrentals.com/es/otros/2134" }
    ]) {
      const unchanged = reconcileGamElectricTowTractorEditorial(changed, {
        short: source.shortDescription, general: source.longDescription
      }, source.specs ?? {});
      assert.equal(unchanged.short, source.shortDescription);
      assert.equal(unchanged.general, source.longDescription);
      assert.deepEqual(unchanged.spec, source.specs);
    }
    const conflictingSpecs = { ...source.specs, "Capacidad de arrastre": "dato contradictorio" };
    const conflicting = reconcileGamElectricTowTractorEditorial(source, {
      short: source.shortDescription, general: source.longDescription
    }, conflictingSpecs);
    assert.deepEqual(conflicting.spec, conflictingSpecs);
    assert.equal(conflicting.general, source.longDescription);
    assert.deepEqual(prepared.images, prepareSourceProduct(source).product.images);
  });
}
