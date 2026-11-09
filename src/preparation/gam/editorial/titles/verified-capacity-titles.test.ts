import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reconcileGamVerifiedCapacityTitle } from "./editorial-titles.js";

const source = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");

const record = (reference: string): ProductRecord => {
  const product = source.products.find((item) => item.reference === reference);
  assert.ok(product, reference);
  return product;
};

for (const [reference, title, capacity] of [
  ["1145", "Transpaleta YALE MPC14 1400Kg", "1400 KG"],
  ["6514", "Carretilla elevadora GLP 1800 Kg HYSTER H1.8FT", "1800 KG"]
] as const) {
  test(`GAM ${reference}: reconcilia el título solo con evidencia concordante del registro`, () => {
    const original = record(reference);
    const snapshot = JSON.stringify(original);
    const prepared = prepareSourceProduct(original);
    assert.equal(reconcileGamVerifiedCapacityTitle(original, original.title), title);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.title, title);
    assert.equal(prepared.product.description_title, title);
    assert.equal(prepared.product.spec["Capacidad de carga (kg)"], capacity);
    assert.equal(JSON.stringify(original), snapshot);
  });

  test(`GAM ${reference}: no generaliza una capacidad a otra unidad ni a evidencia alterada`, () => {
    const original = record(reference);
    for (const changed of [
      { ...original, providerId: "otro" },
      { ...original, reference: "otra" },
      { ...original, url: `${original.url}?variante=2` },
      { ...original, categoryKey: "otros" },
      { ...original, condition: null },
      { ...original, brand: "OTRO" },
      { ...original, model: "OTRO" },
      { ...original, title: `${original.title} edición alternativa` },
      { ...original, shortDescription: "Otra capacidad" },
      { ...original, specs: { ...original.specs, Modelo: "OTRO" } },
      { ...original, specs: { ...original.specs, "Capacidad de carga (kg)": "9999 KG" } },
      ...(reference === "6514" ? [
        { ...original, longDescription: "Descripción alternativa" },
        { ...original, specs: { ...original.specs, "Nº de serie": "OTRA" } }
      ] : [])
    ] satisfies readonly ProductRecord[]) {
      assert.equal(reconcileGamVerifiedCapacityTitle(changed, changed.title), changed.title);
    }
    assert.equal(reconcileGamVerifiedCapacityTitle(original, "Título derivado alternativo"), "Título derivado alternativo");
  });
}

test("GAM: las capacidades y variantes sin evidencia suficiente mantienen sus revisiones", () => {
  for (const reference of ["6837", "5902", "4650", "6934"]) {
    const original = record(reference);
    const prepared = prepareSourceProduct(original);
    assert.equal(reconcileGamVerifiedCapacityTitle(original, original.title), original.title, reference);
    assert.equal(prepared.product.title, original.title, reference);
  }
});

test("GAM: las demás fichas conservan el título anterior al saneamiento", () => {
  for (const original of source.products) {
    if (original.reference === "1145" || original.reference === "6514") continue;
    assert.equal(reconcileGamVerifiedCapacityTitle(original, original.title), original.title, original.reference ?? "");
  }
});
