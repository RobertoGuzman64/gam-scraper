import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { includeGamSourceDeclaredWeightInGeneral } from "../mapping/source-declared-weight-general.js";
import { includeGamSourceMachineDimensionsInGeneral } from "../mapping/source-machine-dimensions-general.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera el peso declarado sin modificar el origen ni duplicar información existente", () => {
  const examples: readonly (readonly [string, string])[] = [["6901", "7.550"], ["6077", "6.600"], ["6063", "2.470"]];
  for (const [reference, weight] of examples) {
    const source = find(reference);
    const previous = structuredClone(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.spec.Peso, source.specs?.Peso, reference);
    const generalBeforeDimensions = (prepared.product.description_general ?? "").replace(/ Dimensiones declaradas de la máquina \(largo × ancho × alto\): [\d,]+ × [\d,]+ × [\d,]+ m\.$/u, "");
    assert.match(generalBeforeDimensions, new RegExp(`El peso indicado en la ficha técnica del proveedor es de ${weight.replaceAll(".", "\\.")} kg\\.$`, "u"), reference);
    assert.equal(includeGamSourceDeclaredWeightInGeneral(source, generalBeforeDimensions, prepared.product.spec),
      generalBeforeDimensions, reference);
    assert.equal(includeGamSourceMachineDimensionsInGeneral(source, generalBeforeDimensions, prepared.product.spec),
      prepared.product.description_general, reference);
    assert.deepEqual(source, previous, reference);
  }
  const existing = find("6311");
  const original = prepareSourceProduct(existing).product.description_general;
  assert.ok(original);
  assert.equal(includeGamSourceDeclaredWeightInGeneral(existing, original, existing.specs ?? {}), original);
});

test("rechaza identidad cruzada, modelo de variante ajena y pesos no acreditados", () => {
  const source = find("6901");
  const general = source.longDescription;
  assert.ok(general);
  const specs = source.specs ?? {};
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "mercaeleva" },
    { ...source, categoryKey: "manutencion" },
    { ...source, condition: "Nuevo" },
    { ...source, reference: "9999" },
    { ...source, brand: "JLG" },
    { ...source, model: "A46JR" },
    { ...source, specs: { ...specs, Modelo: "A46JR" } },
    { ...source, shortDescription: "Equipo de otro modelo" },
    { ...source, url: source.url.replace("online.gamrentals.com", "example.org") },
    { ...source, url: `${source.url}?variante=otra` },
    { ...source, specs: { ...specs, Peso: "Opcional: 7550 KG" } },
    { ...source, specs: { ...specs, Peso: "9999 KG" } },
    { ...source, longDescription: `${general} Peso declarado: 9000 kg.` }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(includeGamSourceDeclaredWeightInGeneral(variant, general, specs), general, String(index));
  }
  assert.equal(includeGamSourceDeclaredWeightInGeneral(source, general, { ...specs, Peso: "9999 KG" }), general);
  assert.equal(includeGamSourceDeclaredWeightInGeneral(source, `${general} Peso declarado: 7550 kg.`, specs),
    `${general} Peso declarado: 7550 kg.`);
  assert.equal(includeGamSourceDeclaredWeightInGeneral(source, null, specs), null);
  const crossed = find("6934");
  const previous = prepareSourceProduct(crossed).product.description_general;
  assert.ok(previous);
  assert.equal(includeGamSourceDeclaredWeightInGeneral(crossed, previous, crossed.specs ?? {}), previous);
});
