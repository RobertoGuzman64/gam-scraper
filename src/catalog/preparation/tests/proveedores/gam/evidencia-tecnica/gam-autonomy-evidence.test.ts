import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../normalization/normalize-specs.js";
import { recoverGamAutonomySpec } from "../../../../evidence/providers/gam/energia-motorizacion/autonomy-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const recordOf = (reference: string) => {
  const record = catalog.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera solo la autonomía explícita y atribuible al modelo, manteniendo cada especificación original", () => {
  const expected = [
    ["6218", 100, "km"], ["6477", 100, "km"], ["6635", 100, "km"], ["6636", 100, "km"],
    ["6262", 100, "km"], ["6478", 90, "km"], ["6479", 90, "km"], ["6813", 90, "km"],
    ["6811", 133, "km"], ["6803", 50, "km"], ["6802", 50, "km"],
    ["5950", 50, "km"], ["5952", 50, "km"], ["5953", 50, "km"],
    ["6950", 8, "h"], ["4023", 3, "h"], ["6149", 3, "h"], ["5771", 5, "h"],
    ["4008", 3.5, "h"], ["5773", 3.5, "h"]
  ] as const;
  for (const [reference, value, unit] of expected) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const key = `Autonomía máxima (${unit})`;
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[key], `${String(value).replace(".", ",")} ${unit}`, reference);
    assert.equal(normalizeSpecsObject({ [key]: `${String(value).replace(".", ",")} ${unit}` }).normalized[key], value, reference);
    for (const [name, sourceValue] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[name], sourceValue, `${reference}: ${name}`);
    }
    assert.deepEqual(record, original);
  }
  const changed = catalog.products.filter((record) => {
    const before = record.specs ?? {};
    const after = recoverGamAutonomySpec(record);
    return Object.keys(after).some((key) => !Object.hasOwn(before, key));
  });
  assert.deepEqual(changed.map((record) => record.reference).sort(),
    [...expected.map(([reference]) => reference), "1884", "1885", "1886", "5079", "1887", "1888"].sort());
});

test("ignora modelos contradictorios, proveedores ajenos y valores alternativos o preexistentes", () => {
  const record = recordOf("6218");
  const source = record.specs ?? {};
  for (const variant of [
    { ...record, providerId: "gomariz" },
    { ...record, brand: "ZERO" },
    { ...record, model: "LX08" },
    { ...record, specs: { ...source, Modelo: "LX08" } },
    { ...record, specs: { ...source, "Autonomía": "100 km" } },
    { ...record, specs: { ...source, "Autonomía máxima (km)": "100 km" } },
    { ...record, url: record.url.replace("6218-", "6219-") },
    { ...record, condition: "Nuevo" as const },
    { ...record, longDescription: `${record.longDescription} Autonomía de hasta 120 km.` },
    { ...record, longDescription: `${record.longDescription} Autonomía de hasta 150 horas.` },
    { ...record, longDescription: `${record.longDescription} Autonomía de hasta 900 km.` },
    { ...record, longDescription: `${record.longDescription} O 80 km según configuración.` }
  ]) assert.deepEqual(recoverGamAutonomySpec(variant), variant.specs);
  for (const reference of ["5949", "6805", "6807", "6148", "4012"]) {
    const sourceRecord = recordOf(reference);
    assert.deepEqual(recoverGamAutonomySpec(sourceRecord), sourceRecord.specs, reference);
  }
});

test("recupera únicamente la autonomía aproximada explícita de las grúas ORMIG identificadas", () => {
  const references = ["1884", "1885", "1886", "5079", "1887", "1888"];
  for (const reference of references) {
    const record = recordOf(reference);
    const snapshot = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Autonomía aproximada (h)"], "8 h", reference);
    assert.equal(normalizeSpecsObject({ "Autonomía aproximada (h)": "8 h" }).normalized["Autonomía aproximada (h)"], 8);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, snapshot);
  }
});

test("no asigna autonomía aproximada a variantes contradictorias o datos ya presentes", () => {
  const record = recordOf("1884");
  for (const variant of [
    { ...record, providerId: "gomariz" },
    { ...record, brand: "OTRA" },
    { ...record, model: "35iE" },
    { ...record, specs: { ...record.specs, Modelo: "35iE" } },
    { ...record, specs: { ...record.specs, "Autonomía": "10 h" } },
    { ...record, url: record.url.replace("1884-", "1885-") },
    { ...record, longDescription: `${record.longDescription} Autonomía entorno a 12 horas.` },
    { ...record, longDescription: `${record.longDescription} Autonomía de 8 a 12 horas.` }
  ]) assert.deepEqual(recoverGamAutonomySpec(variant), variant.specs ?? {});
});
