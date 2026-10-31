import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamYaleDieselDimensions } from "../mapping/providers/gam/yale-diesel-dimensions.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const expected = new Set([
  "2316", "2317", "2318", "2319", "2320", "2321", "2322", "2327", "2329", "2331",
  "2208", "2209", "2210", "3140", "3141", "3142", "3143", "3145", "3146"
]);

const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM: incorpora dimensiones originales que faltaban en la descripción de 19 carretillas Yale diésel", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const original = structuredClone(record);
    const result = resolveGamYaleDieselDimensions(record, record.longDescription?.trim() ?? null);
    const prepared = prepareSourceProduct(record);
    if (result !== null) {
      assert.ok(record.reference && record.model && record.longDescription);
      const originalGeneral = record.longDescription.trim();
      assert.equal(prepared.product.description_general, result, record.reference);
      assert.ok(result.endsWith(`\n\n${originalGeneral}`), record.reference);
      assert.ok(result.includes(`YALE ${record.model}`), record.reference);
      for (const [key, unit] of [["Longitud", "mm"], ["Anchura", "mm"], ["Altura", "mm"], ["Peso", "kg"]] as const) {
        const value = record.specs?.[key];
        assert.ok(typeof value === "string", record.reference);
        assert.ok(result.includes(`${value.split(" ")[0]} ${unit}`), record.reference);
      }
      assert.deepEqual(prepared.product.spec, record.specs, record.reference);
      changed.add(record.reference);
    }
    assert.deepEqual(record, original);
  }
  assert.deepEqual(changed, expected);
});

test("GAM: rechaza cambios de identidad, procedencia, tipo de motor y valores incompatibles", () => {
  const record = find("2316");
  const source = record.longDescription;
  assert.ok(source);
  const rejected: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" },
    { ...record, reference: "2317" },
    { ...record, model: "GP2.5N" },
    { ...record, brand: "HYSTER" },
    { ...record, title: "Carretilla Yale GP2.5N" },
    { ...record, externalReference: "GP2.5N" },
    { ...record, shortDescription: "Carretilla diésel Yale GP2.5N" },
    { ...record, specs: { ...record.specs, Modelo: "GP2.5N" } },
    { ...record, specs: { ...record.specs, Motorización: "Eléctrico" } },
    { ...record, specs: { ...record.specs, Longitud: "3349 pulgadas" } },
    { ...record, specs: { ...record.specs, Anchura: "9999 mm" } },
    { ...record, specs: { ...record.specs, Peso: "NA" } },
    { ...record, url: record.url.replace("online.gamrentals.com", "example.com") },
    { ...record, url: `${record.url}?variation=1` },
    { ...record, longDescription: `${source} Longitud: 3349 mm.` }
  ];
  for (const [index, invalid] of rejected.entries()) {
    assert.equal(resolveGamYaleDieselDimensions(invalid, invalid.longDescription?.trim() ?? null), null, String(index));
  }
  assert.equal(resolveGamYaleDieselDimensions(record, `Otro texto.\n\n${source}`), null);
  assert.equal(resolveGamYaleDieselDimensions(find("2312"), find("2312").longDescription), null);
});

test("La mejora no se extiende a Gomariz ni a carretillas de otro fabricante", () => {
  for (const record of gomariz.products) {
    assert.equal(resolveGamYaleDieselDimensions(record, record.longDescription), null);
  }
  assert.equal(resolveGamYaleDieselDimensions(find("2079"), find("2079").longDescription), null);
});
