import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamTecnacarGeneral } from "../mapping/providers/gam/tecnacar-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const expected = new Set([
  "278", "279", "280", "281", "282", "283", "284", "285", "286", "287", "288", "289",
  "290", "291", "292", "297", "298", "299"
]);

test("GAM: diferencia 18 fichas Tecnacar con hechos atribuibles sin alterar sus canónicos", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const before = JSON.stringify(record);
    const improvement = resolveGamTecnacarGeneral(record);
    if (improvement) {
      assert.ok(record.reference);
      changed.add(record.reference);
      assert.ok(record.longDescription);
      assert.ok(improvement.startsWith(`${record.longDescription.trim()}\n\n`));
      const preparation = prepareSourceProduct(record).product;
      assert.equal(preparation.description_general, improvement);
      assert.equal(preparation.sourceUrl, record.url);
      assert.equal(preparation.reference, record.reference);
      assert.equal(preparation.description_general?.includes(record.model ?? ""), true);
      assert.deepEqual(preparation.spec, record.specs);
      assert.ok(improvement.trim().split(/\s+/u).length >= 60);
    }
    assert.equal(JSON.stringify(record), before);
  }
  assert.equal(gam.products.length, 983);
  assert.deepEqual(changed, expected);
});

test("GAM: rechaza contradicciones de modelo, unidad, capacidad y procedencia", () => {
  const tractor = find("278");
  assert.ok(resolveGamTecnacarGeneral(tractor));
  const variants: readonly ProductRecord[] = [
    { ...tractor, providerId: "gomariz" },
    { ...tractor, reference: "279" },
    { ...tractor, categoryKey: "marcas-nuevas" },
    { ...tractor, brand: "TECNACAR" },
    { ...tractor, model: "VTA 104" },
    { ...tractor, externalReference: "VTA 104" },
    { ...tractor, title: "Tractor eléctrico de arrastre Tecnacar VTA 104 3000kg" },
    { ...tractor, shortDescription: tractor.shortDescription?.replace("3000kg", "4000kg") ?? null },
    { ...tractor, longDescription: tractor.longDescription?.replace("VTA 103", "VTA 104") ?? null },
    { ...tractor, url: tractor.url.replace("online.gamrentals.com", "example.com") },
    { ...tractor, url: `${tractor.url}?tracking=1` },
    { ...tractor, specs: { ...tractor.specs, Modelo: "VTA 104" } },
    { ...tractor, specs: { ...tractor.specs, "Capacidad de carga (kg)": "4000 KG" } },
    { ...tractor, specs: { ...tractor.specs, Longitud: "1436 cm" } },
    { ...tractor, specs: { ...tractor.specs, "Tiro a la barra nominal": "3000 N" } },
    { ...tractor, specs: { ...tractor.specs, "Máximo tiro a la barra": "300 N" } },
    { ...tractor, specs: { ...tractor.specs, "Velocidad de desplazamiento con/sin carga": "13/8 km/h" } },
    { ...tractor, specs: { ...tractor.specs, Motorización: "Diésel" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveGamTecnacarGeneral(variant), null, String(index));
  }
  for (const reference of ["1894", "1936", "293", "295", "296", "2305"]) {
    assert.equal(resolveGamTecnacarGeneral(find(reference)), null, reference);
  }
});

test("GAM: distingue los tres trenes logísticos sin trasladar capacidades entre variantes", () => {
  for (const [reference, capacity, detail] of [
    ["297", "1000 kg", "eléctrica o hidráulica"],
    ["298", "2000 kg", "doble de elevación hidráulica"],
    ["299", "600 kg", "por ambos lados"]
  ] as const) {
    const record = find(reference);
    const text = resolveGamTecnacarGeneral(record);
    assert.ok(text);
    assert.ok(text.includes(capacity));
    assert.ok(text.includes(detail));
    assert.equal(resolveGamTecnacarGeneral({ ...record, reference: "2999" }), null);
    assert.equal(resolveGamTecnacarGeneral({ ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "900 KG" } }), null);
    assert.equal(resolveGamTecnacarGeneral({ ...record, shortDescription: "Remolque genérico" }), null);
  }
});
