import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../normalization/normalize-specs.js";
import { recoverGamExplicitMachineSpecs } from "../../../../evidence/providers/gam/measurements-and-capacities/measured-machine-specs.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const recordOf = (reference: string) => {
  const record = catalog.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

const expectedRadius = [
  ["5", 2149], ["6", 2216], ["2254", 2076], ["2255", 2076], ["2256", 2076],
  ["6743", 2374], ["6744", 2374], ["4388", 1344], ["4623", 1425],
  ["4010", 1854], ["4011", 1854]
] as const;
const expectedCentre = [
  ["2369", 600], ["2041", 900], ["3799", 600], ["3800", 900], ["3801", 600],
  ["3803", 600], ["6743", 600], ["6744", 600], ["6480", 600], ["6481", 600],
  ["6990", 600], ["6991", 600]
] as const;

test("recupera medidas geométricas explícitas sin alterar las especificaciones de origen", () => {
  for (const [key, items] of [
    ["Radio de giro (mm)", expectedRadius],
    ["Centro de carga (mm)", expectedCentre]
  ] as const) {
    for (const [reference, value] of items) {
      const record = recordOf(reference);
      const snapshot = structuredClone(record);
      const prepared = prepareSourceProduct(record);
      assert.equal(prepared.product.spec[key], `${value} mm`, reference);
      assert.equal(normalizeSpecsObject({ [key]: `${value} mm` }).normalized[key], value, reference);
      for (const [name, original] of Object.entries(record.specs ?? {})) {
        assert.deepEqual(prepared.product.spec[name], original, `${reference}: ${name}`);
      }
      assert.deepEqual(record, snapshot);
    }
  }
  assert.equal(new Set([...expectedRadius, ...expectedCentre].map(([reference]) => reference)).size, 21);
});

test("descarta identidades y procedencias contradictorias, aproximaciones y medidas previas", () => {
  for (const reference of ["3802", "6745", "6272", "2795", "5902", "5903"]) {
    const record = recordOf(reference);
    assert.deepEqual(recoverGamExplicitMachineSpecs(record), record.specs, reference);
  }
  for (const reference of ["2369", "6743"]) {
    const record = recordOf(reference);
    const original = record.specs ?? {};
    const variants = [
      { ...record, providerId: "gomariz" },
      { ...record, brand: "INCORRECTA" },
      { ...record, model: "INCORRECTO" },
      { ...record, title: "Producto sin identificación inequívoca" },
      { ...record, specs: { ...original, Marca: "INCORRECTA" } },
      { ...record, specs: { ...original, Modelo: "INCORRECTO" } },
      { ...record, condition: "Segunda mano" as const },
      { ...record, url: record.url.replace(`${record.reference}-`, "9999-") },
    ];
    for (const variant of variants) {
      const recovered = recoverGamExplicitMachineSpecs(variant);
      assert.equal(recovered["Centro de carga (mm)"], undefined);
      assert.equal(recovered["Radio de giro (mm)"], undefined);
    }
  }
  const disputedCentre = recordOf("2369");
  assert.equal(recoverGamExplicitMachineSpecs({ ...disputedCentre,
    longDescription: `${disputedCentre.longDescription} Centro de carga de 1200 mm.`
  })["Centro de carga (mm)"], undefined);
  const disputedRadius = recordOf("6743");
  assert.equal(recoverGamExplicitMachineSpecs({ ...disputedRadius,
    longDescription: `${disputedRadius.longDescription} Radio de giro de solo 4500 mm.`
  })["Radio de giro (mm)"], undefined);
  const centre = recordOf("2369");
  assert.equal(recoverGamExplicitMachineSpecs({ ...centre, specs: {
    ...centre.specs, "Centro de carga (mm)": "800 mm"
  } })["Centro de carga (mm)"], "800 mm");
  const radius = recordOf("5");
  assert.equal(recoverGamExplicitMachineSpecs({ ...radius, specs: {
    ...radius.specs, "Radio de giro": "2200 mm"
  } })["Radio de giro"], "2200 mm");
  assert.equal(recoverGamExplicitMachineSpecs({ ...radius, longDescription: `${radius.longDescription} Radio de giro de solo 3000 mm.` })["Radio de giro (mm)"], undefined);
});
