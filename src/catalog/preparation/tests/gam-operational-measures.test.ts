import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamOperationalSpecs } from "../evidence/providers/gam/operational-measures-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
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

test("53 referencias GAM reciben velocidades acreditadas, sin herencias a Gomariz", () => {
  const changes = gam.products.flatMap((record) => {
    const current = recoverGamOperationalSpecs(record);
    const added = Object.keys(current).filter((key) => !Object.hasOwn(record.specs ?? {}, key));
    return added.length ? [{ reference: record.reference, added }] : [];
  });
  assert.equal(changes.length, 53);
  assert.equal(new Set(changes.map(({ reference }) => reference)).size, 53);
  assert.equal(changes.filter(({ added }) => added[0] === "Velocidad de desplazamiento (km/h)").length, 34);
  assert.equal(changes.filter(({ added }) => added[0] === "Velocidad de desplazamiento con/sin carga (km/h)").length, 14);
  assert.equal(changes.filter(({ added }) => added[0] === "Velocidad limitada (km/h)").length, 5);
  assert.ok(changes.every(({ added }) => added.length === 1));
  assert.ok(gomariz.products.every((record) =>
    JSON.stringify(recoverGamOperationalSpecs(record)) === JSON.stringify(record.specs ?? {})));
});

const isolatedCases = [
  ["4790", "5 km/h", 5], ["31", "21 km/h", 21],
  ["6322", "15 km/h", 15], ["6323", "15 km/h", 15], ["6325", "15 km/h", 15],
  ["5993", "18 km/h", 18], ["5994", "18 km/h", 18], ["3799", "24 km/h", 24],
  ["4019", "9 km/h", 9], ["4020", "9 km/h", 9], ["4022", "12,9 km/h", 12.9],
  ["4025", "6 km/h", 6], ["4026", "6,2 km/h", 6.2],
  ["4027", "6,2 km/h", 6.2], ["4034", "16 km/h", 16]
] as const;

test("recupera 15 velocidades nuevas propias y normalizables, conservando todas las especificaciones originales", () => {
  const key = "Velocidad de desplazamiento (km/h)";
  for (const [reference, expected, numeric] of isolatedCases) {
    const record = recordOf(reference);
    const snapshot = structuredClone(record);
    const actual = prepareSourceProduct(record);
    assert.equal(actual.product.spec[key], expected, reference);
    assert.deepEqual(normalizeSpecsObject({ [key]: expected }).normalized[key], [numeric], reference);
    for (const [name, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(actual.product.spec[name], value, `${reference}: ${name}`);
    }
    assert.deepEqual(record, snapshot, reference);
  }
});

test("rechaza velocidades alternativas, cargas específicas, modelos incompatibles y especificaciones previas", () => {
  const vehicle = recordOf("4019");
  for (const variant of [
    { ...vehicle, providerId: "gomariz" },
    { ...vehicle, categoryKey: "limpieza-fregadoras" },
    { ...vehicle, condition: "Segunda mano" as const },
    { ...vehicle, model: "BF M17 C" },
    { ...vehicle, brand: "XCMG" },
    { ...vehicle, title: "Barredora Tennant BF M20" },
    { ...vehicle, url: vehicle.url.replace("4019-", "4018-") },
    { ...vehicle, specs: { ...vehicle.specs, "Velocidad máxima": "9 km/h" } },
    { ...vehicle, longDescription: `${vehicle.longDescription} Velocidad de desplazamiento de hasta 11 km/h.` },
    { ...vehicle, longDescription: `${vehicle.longDescription} Velocidad de desplazamiento de hasta 9 km/h sin carga.` },
    { ...vehicle, longDescription: `${vehicle.longDescription} Velocidad de desplazamiento de hasta 900 km/h.` }
  ]) assert.deepEqual(recoverGamOperationalSpecs(variant), variant.specs ?? {});
  for (const reference of ["6324", "5992", "6326", "6327", "6420", "6573", "6574", "4021", "4029", "4017", "6807"]) {
    const record = recordOf(reference);
    const after = recoverGamOperationalSpecs(record);
    if (reference === "6420") assert.equal(after["Velocidad de desplazamiento con/sin carga (km/h)"], "14,8 / 15,7 km/h");
    else assert.deepEqual(after, record.specs ?? {}, reference);
  }
});

test("las 15 velocidades aisladas se atribuyen a su ficha y no se duplican con las 19 medidas previas", () => {
  const expected = new Set([...isolatedCases.map(([reference]) => reference),
    ...["50", "2117", "52", "53", "2239", "2151", "4032", "4033", "5771"]]);
  const newOnly = gam.products.flatMap((record) => {
    const after = recoverGamOperationalSpecs(record);
    if (!Object.hasOwn(after, "Velocidad de desplazamiento (km/h)")) return [];
    if (record.categoryKey === "maquinaria") return [];
    return [record.reference];
  });
  assert.deepEqual(new Set(newOnly), expected);
  assert.equal(newOnly.length, 24);
});

const additionalPaired = [
  ["6419", "15 / 15,7 km/h", [15, 15.7]], ["6114", "14 / 16 km/h", [14, 16]],
  ["6425", "15 / 16 km/h", [15, 16]], ["6743", "9,7 / 13 km/h", [9.7, 13]],
  ["6368", "8,4 / 13 km/h", [8.4, 13]]
] as const;
const additionalSpeeds = [
  ["50", "14 km/h", 14], ["2117", "14 km/h", 14], ["52", "14 km/h", 14],
  ["53", "14 km/h", 14], ["2239", "13 km/h", 13], ["2151", "6 km/h", 6],
  ["4032", "10 km/h", 10], ["4033", "13 km/h", 13], ["5771", "7,2 km/h", 7.2]
] as const;

 test("recupera velocidades con y sin carga, velocidades aisladas y límites explícitos de bicicleta", () => {
  for (const [reference, expected, numbers] of additionalPaired) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const key = "Velocidad de desplazamiento con/sin carga (km/h)";
    assert.equal(prepareSourceProduct(record).product.spec[key], expected, reference);
    assert.deepEqual(normalizeSpecsObject({ [key]: expected }).normalized[key], numbers, reference);
    assert.deepEqual(record, original);
  }
  for (const [reference, expected, number] of additionalSpeeds) {
    const record = recordOf(reference);
    const key = "Velocidad de desplazamiento (km/h)";
    assert.equal(prepareSourceProduct(record).product.spec[key], expected, reference);
    assert.deepEqual(normalizeSpecsObject({ [key]: expected }).normalized[key], [number], reference);
  }
  for (const reference of ["6803", "6802", "5950", "5952", "5953"]) {
    const record = recordOf(reference);
    assert.equal(prepareSourceProduct(record).product.spec["Velocidad limitada (km/h)"], "25 km/h", reference);
    assert.equal(normalizeSpecsObject({ "Velocidad limitada (km/h)": "25 km/h" }).normalized["Velocidad limitada (km/h)"], 25);
  }
});

test("protege las nuevas velocidades frente a variantes cruzadas, mediciones alternativas y datos preexistentes", () => {
  const paired = recordOf("6419");
  const source = paired.specs ?? {};
  for (const variant of [
    { ...paired, providerId: "gomariz" },
    { ...paired, brand: "YALE" },
    { ...paired, model: "J2.0UTL" },
    { ...paired, title: "Carretilla de otro modelo" },
    { ...paired, url: paired.url.replace("6419-", "6418-") },
    { ...paired, specs: { ...source, "Velocidad de desplazamiento": "15 km/h" } },
    { ...paired, longDescription: `${paired.longDescription} Velocidad de desplazamiento de 20 km/h.` },
    { ...paired, longDescription: `${paired.longDescription} La velocidad es de 14 km/h con carga y 15,7 km/h sin carga.` }
  ]) assert.deepEqual(recoverGamOperationalSpecs(variant), variant.specs ?? {});
  const bicycle = recordOf("6803");
  for (const variant of [
    { ...bicycle, model: "Ibiza Titanium" },
    { ...bicycle, url: bicycle.url.replace("6803-", "6804-") },
    { ...bicycle, specs: { ...bicycle.specs, "Velocidad limitada": "25 km/h" } },
    { ...bicycle, longDescription: `${bicycle.longDescription} Velocidad limitada a 35 km/h.` }
  ]) assert.deepEqual(recoverGamOperationalSpecs(variant), variant.specs ?? {});
});
