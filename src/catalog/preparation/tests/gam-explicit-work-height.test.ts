import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { recoverGamExplicitWorkHeightSpec } from "../evidence/providers/gam/work-height-evidence.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const find = (reference: string) => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera altura de trabajo explícita sin sustituir la altura de elevación original", () => {
  for (const [reference, expected] of [["4751", "18,1 m"], ["4778", "16,3 m"], ["6186", "23,60 m"], ["6963", "7,8 m"]] as const) {
    const record = find(reference);
    const result = prepareSourceProduct(record);
    assert.equal(result.product.spec["Altura de trabajo (m)"], expected, reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(result.product.spec[key], value, `${reference}:${key}`);
    }
    assert.equal(record.specs?.["Altura de trabajo (m)"], undefined);
  }
});

test("la recuperación no modifica originales, otras familias ni evidencias ambiguas", () => {
  const record = find("4751");
  const original = structuredClone(record);
  const specs = recoverGamExplicitWorkHeightSpec(record);
  assert.equal(specs["Altura de trabajo (m)"], "18,1 m");
  assert.deepEqual(record, original);
  assert.deepEqual(recoverGamExplicitWorkHeightSpec({ ...record, providerId: "gomariz" }), record.specs);
  assert.deepEqual(recoverGamExplicitWorkHeightSpec({ ...record, categoryKey: "manipulacion" }), record.specs);
  assert.deepEqual(recoverGamExplicitWorkHeightSpec({ ...record, specs: { ...record.specs, "Altura de trabajo": "18,1 m" } }),
    { ...record.specs, "Altura de trabajo": "18,1 m" });
  assert.deepEqual(recoverGamExplicitWorkHeightSpec({ ...record, longDescription: "Altura de trabajo de 18,1 m y altura de trabajo de 19 m." }), record.specs);
  assert.deepEqual(recoverGamExplicitWorkHeightSpec({ ...record, specs: { ...record.specs, "Altura de elevación (m)": "22 metros" } }),
    { ...record.specs, "Altura de elevación (m)": "22 metros" });
});

test("una altura de trabajo ya equivalente no duplica especificaciones", () => {
  const record = find("6020");
  assert.equal(record.specs?.["Altura de elevación (mm)"], "6300 mm");
  assert.deepEqual(recoverGamExplicitWorkHeightSpec(record), record.specs);
});

test("la recuperación se limita a las veintitrés fichas respaldadas por su propia descripción", () => {
  const expected = [
    "4731", "4734", "4735", "4751", "4778", "4779", "4783", "4790", "4794", "4798", "4807",
    "6162", "6185", "6186", "6187", "6189", "6190", "6191", "6192", "6193", "6767", "6768", "6963"
  ];
  const recovered = gam.products.filter((record) =>
    Object.hasOwn(recoverGamExplicitWorkHeightSpec(record), "Altura de trabajo (m)") &&
    !Object.hasOwn(record.specs ?? {}, "Altura de trabajo (m)"));
  assert.deepEqual(recovered.map((record) => record.reference).sort(), expected.sort());
});
