import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamOperationalSpecs } from "../evidence/providers/gam/operational-measures-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const recordOf = (reference: string) => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM recupera velocidades medidas de la máquina sin alterar las especificaciones previas", () => {
  for (const [reference, key, sourceValue, expected] of [
    ["6218", "Velocidad de desplazamiento (km/h)", "45 km/h", [45]],
    ["6811", "Velocidad de desplazamiento (km/h)", "90 km/h", [90]],
    ["6420", "Velocidad de desplazamiento con/sin carga (km/h)", "14,8 / 15,7 km/h", [14.8, 15.7]],
    ["5995", "Velocidad de desplazamiento con/sin carga (km/h)", "19 / 20 km/h", [19, 20]],
    ["6480", "Velocidad de desplazamiento con/sin carga (km/h)", "4 / 4,5 km/h", [4, 4.5]],
    ["6364", "Velocidad de desplazamiento con/sin carga (km/h)", "8,4 / 13 km/h", [8.4, 13]]
  ] as const) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[key], sourceValue, reference);
    assert.deepEqual(normalizeSpecsObject({ [key]: sourceValue }).normalized[key], expected, reference);
    for (const [sourceKey, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[sourceKey], value, `${reference}: ${sourceKey}`);
    }
    assert.deepEqual(record, original);
  }
});

test("GAM descarta identidades discordantes, velocidades contradictorias y variantes no compatibles", () => {
  const industrial = recordOf("6420");
  const industrialSpec = industrial.specs ?? {};
  for (const variant of [
    { ...industrial, providerId: "gomariz" },
    { ...industrial, categoryKey: "maquinaria" },
    { ...industrial, condition: "Segunda mano" as const },
    { ...industrial, model: "J2.0UTL" },
    { ...industrial, brand: "YALE" },
    { ...industrial, specs: { ...industrialSpec, "Marca": "YALE" } },
    { ...industrial, specs: { ...industrialSpec, "Velocidad de desplazamiento": "14,8 km/h" } },
    { ...industrial, longDescription: "Hyster J1.8UTL: velocidad de desplazamiento de 14,8 km/h con carga y 12 km/h sin carga." },
    { ...industrial, longDescription: "Hyster J1.8UTL: velocidad de desplazamiento de 14,8 km/h con carga y 15,7 km/h sin carga, velocidad de desplazamiento de 14,8 km/h con carga y 17 km/h sin carga." },
    { ...industrial, longDescription: "Hyster J1.8UTL: velocidad de desplazamiento de 140 km/h con carga y 150 km/h sin carga." }
  ]) assert.deepEqual(recoverGamOperationalSpecs(variant), variant.specs);

  const road = recordOf("6218");
  for (const variant of [
    { ...road, condition: "Nuevo" as const },
    { ...road, model: "LX08" },
    { ...road, title: "LVNENG LX08" },
    { ...road, specs: { ...road.specs, "Velocidad (km/h)": "45 km/h" } },
    { ...road, longDescription: "LVNENG LX05 es un ciclomotor eléctrico con velocidad máxima de 25 km/h." },
    { ...road, longDescription: "LVNENG LX05 es un ciclomotor eléctrico con velocidad máxima de 45 km/h y velocidad máxima de 90 km/h." },
    { ...road, longDescription: "LVNENG LX05 es un ciclomotor eléctrico con velocidad máxima de 999 km/h." }
  ]) assert.deepEqual(recoverGamOperationalSpecs(variant), variant.specs);
  for (const reference of ["5949", "6807", "6805", "6806"]) {
    const record = recordOf(reference);
    assert.deepEqual(recoverGamOperationalSpecs(record), record.specs ?? {});
  }
});

test("solo 19 referencias GAM reciben un campo nuevo, sin herencias a Gomariz", () => {
  const changes = gam.products.flatMap((record) => {
    const current = recoverGamOperationalSpecs(record);
    const added = Object.keys(current).filter((key) => !Object.hasOwn(record.specs ?? {}, key));
    return added.length ? [{ reference: record.reference, added }] : [];
  });
  assert.equal(changes.length, 19);
  assert.equal(new Set(changes.map(({ reference }) => reference)).size, 19);
  assert.equal(changes.filter(({ added }) => added[0] === "Velocidad de desplazamiento (km/h)").length, 10);
  assert.equal(changes.filter(({ added }) => added[0] === "Velocidad de desplazamiento con/sin carga (km/h)").length, 9);
  assert.ok(changes.every(({ added }) => added.length === 1));
  assert.ok(gomariz.products.every((record) =>
    JSON.stringify(recoverGamOperationalSpecs(record)) === JSON.stringify(record.specs ?? {})));
});
