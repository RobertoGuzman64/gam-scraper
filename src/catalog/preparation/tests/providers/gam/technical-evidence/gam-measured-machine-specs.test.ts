import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../normalization/normalize-specs.js";
import { recoverGamExplicitMachineSpecs } from "../../../../evidence/providers/gam/measurements-and-capacities/measured-machine-specs.js";
import { recoverGamWheelbaseSpec } from "../../../../evidence/providers/gam/mobility/wheelbase-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const recordOf = (reference: string) => {
  const record = catalog.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("incorpora medidas técnicas por modelo identificado sin modificar el origen", () => {
  for (const [reference, key, value, normalized] of [
    ["2085", "Potencia (kW)", "55 kW", [55]],
    ["2066", "Potencia (kW)", "129 kW", [129]],
    ["6574", "Radio de giro (mm)", "1803 mm", 1803],
    ["2103", "Radio de giro (mm)", "1411 mm", 1411],
    ["5773", "Radio de giro (mm)", "1960 mm", 1960]
  ] as const) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[key], value, reference);
    assert.deepEqual(normalizeSpecsObject({ [key]: value }).normalized[key], normalized, reference);
    for (const [originalKey, originalValue] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[originalKey], originalValue, `${reference}: ${originalKey}`);
    }
    assert.deepEqual(record, original);
  }
});

test("descarta identidad discordante, motores incompatibles, medidas contradictorias y otras fuentes", () => {
  const radius = recordOf("6574");
  const source = radius.specs ?? {};
  for (const variant of [
    { ...radius, providerId: "gomariz" },
    { ...radius, model: "RO1.6" },
    { ...radius, specs: { ...source, Modelo: "RO1.6" } },
    { ...radius, specs: { ...source, "Radio de giro": "1803mm" } },
    { ...radius, longDescription: "Carretilla retráctil Hyster RO2.0 con radio de giro de 1.803 mm y radio de giro de 1.850 mm." },
    { ...radius, longDescription: "Carretilla retráctil Hyster RO2.0 con radio de giro de 18.03 mm." },
    { ...radius, categoryKey: "energia" }
  ]) assert.deepEqual(recoverGamExplicitMachineSpecs(variant), variant.specs);

  const power = recordOf("2085");
  for (const variant of [
    { ...power, categoryKey: "maquinaria" },
    { ...power, specs: { ...power.specs, "Potencia Motor (KW)": "55 kW" } },
    { ...power, longDescription: "H4.0FT5 tiene una potencia de 55 kW y otra potencia de 65 kW." },
    { ...power, condition: "Segunda mano" as const }
  ]) assert.deepEqual(recoverGamExplicitMachineSpecs(variant), variant.specs);
  assert.deepEqual(recoverGamExplicitMachineSpecs(recordOf("2046")), recordOf("2046").specs);
});

test("solo recupera las referencias GAM con medidas verificadas en el catálogo actual", () => {
  const changed = catalog.products.flatMap((record) => {
    const original = record.specs ?? {};
    const recovered = recoverGamExplicitMachineSpecs(record);
    const added = Object.keys(recovered).filter((key) => !Object.hasOwn(original, key));
    return added.length ? [{ reference: record.reference, added }] : [];
  });
  assert.equal(changed.length, 38);
  assert.equal(new Set(changed.map(({ reference }) => reference)).size, 38);
  assert.equal(changed.filter(({ added }) => added.includes("Radio de giro (mm)")).length, 24);
  assert.equal(changed.filter(({ added }) => added.includes("Potencia (kW)")).length, 6);
  assert.equal(changed.filter(({ added }) => added.includes("Centro de carga (mm)")).length, 12);
});


test("recupera distancias entre ejes explícitas de modelos identificados y conserva las especificaciones originales", () => {
  const verified = [
    ["6767", 3750], ["2072", 1570], ["2064", 3300], ["2068", 3500], ["2069", 3500],
    ["2067", 3500], ["2041", 3500], ["2042", 3750], ["2043", 3500], ["2049", 4825],
    ["2045", 3655], ["2044", 4315], ["2046", 4315], ["2048", 3935], ["2047", 4315]
  ] as const;
  for (const [reference, distance] of verified) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    const key = "Distancia entre ejes (mm)";
    assert.equal(prepared.product.spec[key], `${distance} mm`, reference);
    assert.equal(normalizeSpecsObject({ [key]: prepared.product.spec[key] }).normalized[key], distance, reference);
    for (const [name, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[name], value, `${reference}: ${name}`);
    }
    assert.deepEqual(record, original);
  }
  const changed = catalog.products.filter((record) =>
    !Object.hasOwn(record.specs ?? {}, "Distancia entre ejes (mm)") &&
    Object.hasOwn(recoverGamWheelbaseSpec(record), "Distancia entre ejes (mm)"));
  assert.deepEqual(changed.map((record) => record.reference).sort(),
    verified.map(([reference]) => reference).sort());
});

test("no crea distancia entre ejes con identidad no acreditada, contradicciones o un valor preexistente", () => {
  const record = recordOf("2067");
  const source = record.specs ?? {};
  for (const variant of [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" as const },
    { ...record, categoryKey: "otros" },
    { ...record, model: "H16XDS12" },
    { ...record, brand: "YALE" },
    { ...record, url: record.url.replace("2067-", "2068-") },
    { ...record, specs: { ...source, "Batalla": "3.500 mm" } },
    { ...record, specs: { ...source, "Distancia entre ejes (mm)": "3500 mm" } },
    { ...record, longDescription: `${record.longDescription} Batalla de 3.750 mm.` },
    { ...record, longDescription: `${record.longDescription} Batalla de 35000 mm.` }
  ]) assert.deepEqual(recoverGamWheelbaseSpec(variant), variant.specs);
});
