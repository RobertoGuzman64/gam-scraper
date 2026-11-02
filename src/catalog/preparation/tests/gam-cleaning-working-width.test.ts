import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamCleaningWorkingWidthSpec } from "../evidence/providers/gam/cleaning-productivity-evidence.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const expected = [["6150", 1380], ["4025", 1050], ["4026", 1200], ["5773", 700]] as const;
const field = "Anchura trabajo (mm)";

const source = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("extrae las cuatro anchuras de trabajo inequívocas sin convertir medidas de máquina o cepillo", () => {
  for (const [reference, width] of expected) {
    const record = source(reference);
    const snapshot = structuredClone(record);
    const prepared = prepareSourceProduct(record).product;
    assert.equal(recoverGamCleaningWorkingWidthSpec(record)[field], width, reference);
    assert.equal(prepared.spec[field], width, reference);
    const normalized = normalizeSpecsObject(prepared.spec);
    assert.equal(normalized.normalized[field], width, reference);
    assert.ok(!normalized.unknownKeys.includes(field), reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, snapshot, reference);
  }
});

test("rechaza alternativas de cepillo, modalidades de trabajo y fichas ya informadas", () => {
  for (const reference of ["4019", "4020", "4022", "4027", "4028", "4012", "4006", "4007", "6148", "4024", "3999"]) {
    const record = source(reference);
    assert.deepEqual(recoverGamCleaningWorkingWidthSpec(record), record.specs ?? {}, reference);
  }
});

test("no mezcla proveedor, referencia, modelo, origen, anchuras contradictorias ni claves existentes", () => {
  const record = source("4025");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" },
    { ...record, categoryKey: "manutencion" },
    { ...record, reference: "4026" },
    { ...record, model: "BCS S780" },
    { ...record, title: "Equipo de limpieza de otro modelo" },
    { ...record, brand: "Otra" },
    { ...record, url: `${record.url}?variante=otra` },
    { ...record, url: record.url.replace("4025-", "4026-") },
    { ...record, specs: { ...record.specs, "Anchura trabajo": "0,7 metros" } },
    { ...record, longDescription: `${record.longDescription} La trayectoria de limpieza total de 1.300 mm facilita el trabajo.` },
    { ...record, longDescription: (record.longDescription ?? "").replace("1.050 mm", "0 mm") }
  ];
  for (const variant of variants) {
    assert.deepEqual(recoverGamCleaningWorkingWidthSpec(variant), variant.specs ?? {});
  }
});

test("se limita a cuatro registros GAM y no interviene Gomariz", () => {
  const changed = gam.products.flatMap((record) =>
    Object.hasOwn(recoverGamCleaningWorkingWidthSpec(record), field) && !Object.hasOwn(record.specs ?? {}, field)
      ? [record.reference] : []);
  assert.deepEqual(new Set(changed), new Set(expected.map(([reference]) => reference)));
  assert.equal(changed.length, expected.length);
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamCleaningWorkingWidthSpec(record), record.specs ?? {});
  }
});
