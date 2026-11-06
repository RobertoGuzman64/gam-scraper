import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { includeGamSourceMachineDimensionsInGeneral } from "./source-machine-dimensions-general.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("incorpora únicamente las tres dimensiones acreditadas sin alterar especificaciones ni origen", () => {
  for (const [reference, values] of [
    ["6901", "5,7 × 2,1 × 2,16"],
    ["6077", "3,5 × 1,19 × 2"],
    ["6158", "1,78 × 0,81 × 1,75"]
  ] as const) {
    const record = find(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.product.spec.Longitud, record.specs?.Longitud);
    assert.deepEqual(prepared.product.spec.Anchura, record.specs?.Anchura);
    assert.deepEqual(prepared.product.spec.Altura, record.specs?.Altura);
    assert.ok(prepared.product.description_general?.endsWith(
      `Dimensiones declaradas de la máquina (largo × ancho × alto): ${values} m.`), reference);
    assert.equal(includeGamSourceMachineDimensionsInGeneral(record, prepared.product.description_general, prepared.product.spec),
      prepared.product.description_general, reference);
    assert.deepEqual(record, original, reference);
  }
});

test("rechaza variantes cruzadas, medidas inconsistentes y descripciones que ya indican dimensiones", () => {
  const source = find("6901");
  const general = source.longDescription;
  const specs = source.specs;
  assert.ok(general);
  assert.ok(specs);
  const mutations: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, categoryKey: "manutencion" },
    { ...source, condition: "Nuevo" },
    { ...source, reference: "9999" },
    { ...source, brand: "JLG" },
    { ...source, model: "200 AT" },
    { ...source, specs: { ...specs, Modelo: "200 AT" } },
    { ...source, shortDescription: "Otra plataforma" },
    { ...source, title: "Otra plataforma" },
    { ...source, longDescription: "Otra máquina" },
    { ...source, url: `${source.url}?opcion=otra` },
    { ...source, url: source.url.replace("online.gamrentals.com", "example.org") },
    { ...source, specs: { ...specs, Longitud: "Opcional 6300 mm" } },
    { ...source, specs: { ...specs, Anchura: "2,4 m" } },
    { ...source, specs: { ...specs, Altura: "30000 mm" } },
    { ...source, specs: { ...specs, Longitud: "1000 mm" } },
    { ...source, longDescription: `${general} Dimensiones de la máquina: 6,3 × 2,4 × 2,7 m.` }
  ];
  for (const [index, record] of mutations.entries()) {
    assert.equal(includeGamSourceMachineDimensionsInGeneral(record, general, specs), general, String(index));
  }
  assert.equal(includeGamSourceMachineDimensionsInGeneral(source, general, { ...specs, Longitud: "9999 mm" }), general);
  assert.equal(includeGamSourceMachineDimensionsInGeneral(source, `${general} Anchura: 2,4 m.`, specs),
    `${general} Anchura: 2,4 m.`);
  assert.equal(includeGamSourceMachineDimensionsInGeneral(source, null, specs), null);
  for (const reference of ["6311", "6776"]) {
    const alreadyDescribed = find(reference);
    const general = prepareSourceProduct(alreadyDescribed).product.description_general;
    assert.ok(general, reference);
    assert.doesNotMatch(general, /Dimensiones declaradas de la máquina/u, reference);
    assert.equal(includeGamSourceMachineDimensionsInGeneral(alreadyDescribed, general, alreadyDescribed.specs ?? {}),
      general, reference);
  }
  const crossed = find("6934");
  const prepared = prepareSourceProduct(crossed).product.description_general;
  assert.ok(prepared);
  assert.equal(includeGamSourceMachineDimensionsInGeneral(crossed, prepared, crossed.specs ?? {}), prepared);
});
