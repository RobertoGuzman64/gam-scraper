import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { includeGamSourceGradeabilityInGeneral } from "../mapping/source-gradeability-general.js";
import { includeGamSourceDeclaredWeightInGeneral } from "../mapping/source-declared-weight-general.js";
import { includeGamSourceMachineDimensionsInGeneral } from "../mapping/source-machine-dimensions-general.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("incorpora la pendiente declarada sin cambiar otros campos ni repetirla", () => {
  for (const reference of ["6901", "6063", "6854"]) {
    const record = find(reference);
    const previous = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    const value = record.specs?.["Pendiente superable"];
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.spec["Pendiente superable"], value, reference);
    assert.match(prepared.product.description_general ?? "", /pendiente superable del \d{1,3} % para este modelo\./u, reference);
    const fullGeneral = prepared.product.description_general;
    assert.ok(fullGeneral, reference);
    const generalBeforeDimensions = fullGeneral.replace(/ Dimensiones declaradas de la máquina \(largo × ancho × alto\): [\d,]+ × [\d,]+ × [\d,]+ m\.$/u, "");
    const previousGeneral = generalBeforeDimensions.replace(/ El peso indicado en la ficha técnica del proveedor es de [\d.]+ kg\.$/u, "");
    assert.equal(generalBeforeDimensions, includeGamSourceDeclaredWeightInGeneral(record, previousGeneral, prepared.product.spec));
    assert.equal(fullGeneral, includeGamSourceMachineDimensionsInGeneral(record, generalBeforeDimensions, prepared.product.spec));
    assert.equal((prepared.product.description_general ?? "").match(/pendiente superable del/gu)?.length, 1, reference);
    assert.equal(includeGamSourceGradeabilityInGeneral(record, prepared.product.description_general, prepared.product.spec),
      prepared.product.description_general, reference);
    assert.deepEqual(record, previous, reference);
  }
});

test("rechaza pendiente no acreditada, otra identidad, dominio ajeno y duplicados", () => {
  const source = find("6901");
  const baseline = source.longDescription;
  assert.ok(baseline);
  assert.ok(source.specs);
  const specs = source.specs;
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, categoryKey: "manutencion" },
    { ...source, condition: "Nuevo" },
    { ...source, reference: "9999" },
    { ...source, model: "A46J" },
    { ...source, brand: "GENIE" },
    { ...source, specs: { ...specs, Modelo: "A46J" } },
    { ...source, shortDescription: "Máquina diferente" },
    { ...source, url: source.url.replace("online.gamrentals.com", "example.com") },
    { ...source, url: `${source.url}?variante=otra` },
    { ...source, specs: { ...specs, "Pendiente superable": "40% opcional" } },
    { ...source, specs: { ...specs, "Pendiente superable": "25%" } },
    { ...source, longDescription: `${baseline} La pendiente superable es del 25%.` }
  ];
  for (const [index, record] of variants.entries()) {
    assert.equal(includeGamSourceGradeabilityInGeneral(record, baseline, specs), baseline, String(index));
  }
  assert.equal(includeGamSourceGradeabilityInGeneral(source, baseline, { ...specs, "Pendiente superable": "20%" }), baseline);
  assert.equal(includeGamSourceGradeabilityInGeneral(source, `${baseline} Pendiente superable: 40%.`, specs),
    `${baseline} Pendiente superable: 40%.`);
  assert.equal(includeGamSourceGradeabilityInGeneral(source, null, specs), null);
});
