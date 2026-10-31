import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamExplicitLoadCapacitySpec } from "../evidence/providers/gam/load-capacity-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const recordOf = (reference: string) => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

const expectedCapacities = new Map([
  ["6559", 500], ["6560", 500], ["6207", 2000], ["6978", 10000], ["6358", 2000],
  ["6367", 2000], ["6963", 280], ["6186", 230], ["6187", 230], ["6189", 250],
  ["6190", 250], ["6191", 300], ["6192", 250], ["6423", 3000], ["6746", 1000], ["4622", 1600]
]);

test("GAM: incorpora solo capacidades explícitas y compatibles con cada ficha original", () => {
  for (const [reference, capacity] of expectedCapacities) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    const value = prepared.product.spec["Capacidad de carga (kg)"];
    assert.equal(value, `${capacity} KG`, reference);
    assert.deepEqual(normalizeSpecsObject({ "Capacidad de carga (kg)": value }).normalized["Capacidad de carga (kg)"], [capacity]);
    for (const [key, source] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], source, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original);
  }
});

test("GAM: omite capacidades contradictorias, ajenas, presentes o no medidas", () => {
  const conflict = recordOf("6193");
  assert.deepEqual(recoverGamExplicitLoadCapacitySpec(conflict), conflict.specs);
  for (const reference of ["6599", "6262"]) {
    const record = recordOf(reference);
    assert.deepEqual(recoverGamExplicitLoadCapacitySpec(record), record.specs);
  }

  const example = recordOf("6559");
  for (const variant of [
    { ...example, providerId: "gomariz" },
    { ...example, categoryKey: "manipulacion" },
    { ...example, specs: { ...example.specs, "Capacidad de carga (kg)": "600 KG" } },
    { ...example, specs: { ...example.specs, "Capacidad de la cesta": "500 kg" } },
    { ...example, shortDescription: "Capacidad de carga 500 kg", longDescription: "Capacidad de carga de 600 kg" },
    { ...example, shortDescription: "Capacidad de carga entre 500 y 600 kg", longDescription: null },
    { ...example, shortDescription: "Capacidad de carga 500 / 600 kg", longDescription: null },
    { ...example, shortDescription: "Capacidad de carga 0 kg", longDescription: null }
  ]) assert.deepEqual(recoverGamExplicitLoadCapacitySpec(variant), variant.specs);
});

test("GAM: cohorte neta y exclusiva de dieciséis referencias, sin cambios en otros proveedores", () => {
  const gained = gam.products.filter((record) => !Object.hasOwn(record.specs ?? {}, "Capacidad de carga (kg)") &&
    Object.hasOwn(recoverGamExplicitLoadCapacitySpec(record), "Capacidad de carga (kg)"));
  assert.deepEqual(new Set(gained.map((record) => record.reference)), new Set(expectedCapacities.keys()));
  assert.equal(gained.length, expectedCapacities.size);
});
