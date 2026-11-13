import { accreditedSourceSamples } from "../../../../../testing/domain-cases/accredited-source-samples.js";
import { recoverMercaelevaDocumentedEquipmentTechnicalSpecs } from "../../evidence/documented-equipment-technical-specs.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { recoverMercaelevaSourceFuel } from "../../evidence/source-fuel-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = { products: accreditedSourceSamples("mercaeleva-original") };
const source = (reference: string): ProductRecord => {
  const record = catalog.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera motorización explícita coincidente del anuncio sin cambiar el original", () => {
  for (const [reference, fuel] of [
    ["M940-4770", "Eléctrico"],
    ["M239-6301", "Eléctrico"],
    ["M722-8895", "Diesel"]
  ] as const) {
    const record = source(reference);
    const original = structuredClone(record);
    const output = prepareSourceProduct(record);
    assert.equal(output.status, "ready", reference);
    assert.deepEqual(output.product.spec, recoverMercaelevaDocumentedEquipmentTechnicalSpecs(record, { ...record.specs, "Tipo de motor": fuel }), reference);
    assert.deepEqual(record, original, reference);
  }
});

test("no deriva motorización de referencias o variantes cruzadas ni de anuncios contradictorios", () => {
  const record = source("M940-4770");
  const specs = record.specs ?? {};
  const long = record.longDescription ?? "";
  const invalid: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, reference: "M940-4771" },
    { ...record, url: `${record.url}?variant=diesel` },
    { ...record, url: record.url.replace("E20PL", "E20P") },
    { ...record, brand: "Toyota" },
    { ...record, model: "E20P" },
    { ...record, title: (record.title ?? "").replace("ELECTRICA", "DIESEL") },
    { ...record, condition: "Nuevo" },
    { ...record, specs: { ...specs, Marca: "Toyota" } },
    { ...record, specs: { ...specs, Modelo: "E20P" } },
    { ...record, specs: { ...specs, "Artículo No.": "MER0677" } },
    { ...record, specs: { ...specs, "Tipo de motor": "Diesel" } },
    { ...record, longDescription: long.replace("ELECTRICA", "DIESEL") },
    { ...record, longDescription: `${long} SIN MOTORIZACIÓN ELÉCTRICA` },
    { ...record, longDescription: `${long} Motor diésel opcional.` },
    { ...record, longDescription: long.replace("ELECTRICA", "ELECTRICA OPCIONAL") }
  ];
  for (const variant of invalid) {
    assert.deepEqual(recoverMercaelevaSourceFuel(variant, variant.specs ?? {}), variant.specs ?? {}, variant.url);
  }
  assert.deepEqual(recoverMercaelevaSourceFuel(source("M011-3720"), source("M011-3720").specs ?? {}), source("M011-3720").specs);
  assert.deepEqual(recoverMercaelevaSourceFuel(source("M827-8304"), source("M827-8304").specs ?? {}), source("M827-8304").specs);
  assert.deepEqual(recoverMercaelevaSourceFuel(source("M582-1882"), source("M582-1882").specs ?? {}), source("M582-1882").specs);
});
