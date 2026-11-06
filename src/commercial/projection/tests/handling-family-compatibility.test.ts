import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialPublicationInputs } from "../../export/commercial-inputs.js";
import { isValidCommercialCategory, projectCommercialCategory } from "../category-projection.js";

const catalog = await loadImportCatalog();
const publications = await loadCommercialPublicationInputs(process.cwd(), catalog);
const gam = publications.find((publication) => publication.providerId === "gam");
assert.ok(gam);
const entry = (reference: string) => {
  const found = gam.entries.find((item) => item.source.reference === reference);
  assert.ok(found, reference);
  return found;
};
const groups = {
  ormig: ["1884", "1885", "1886", "1887", "1888", "3309", "5079"],
  tractor: ["2134", "2135"],
  trailercaddy: ["2572", "2573", "2737", "2738"],
  tecnacar: ["297", "298", "299"],
  modula: ["3425", "3426", "3427", "3428", "3429", "3430", "3431", "3432", "3433", "3434", "3435", "3436"],
  hyster: ["12", "2163", "2164", "2165", "2169", "5", "6", "8"]
} as const;

const references = Object.values(groups).flat();

test("contrasta sin solapamientos las 28 máquinas nuevas y las ocho Hyster de motorización ambigua", () => {
  assert.equal(references.length, 36);
  assert.equal(new Set(references).size, 36);
  for (const reference of references) {
    const item = entry(reference);
    const expected = groups.hyster.some((id) => id === reference) ? 10 : 85;
    assert.equal(item.mapped.product.categorySellID, expected, reference);
    assert.equal(item.mapped.product.condition, "Nuevo", reference);
    assert.equal(item.mapped.product.providerId, "gam", reference);
    assert.equal(item.mapped.product.reference, reference, reference);
    assert.equal(item.mapped.product.sourceUrl, item.source.url, reference);
    assert.equal(item.mapped.product.spec.Modelo, item.source.specs?.Modelo, reference);
    assert.deepEqual(item.mapped.product.attributes, [], reference);
    assert.equal(isValidCommercialCategory(item.source, expected, "Nuevo", catalog), true, reference);
    assert.equal(isValidCommercialCategory(item.source, expected, "Segunda_Mano", catalog), false, reference);
  }
});

test("las grúas y almacenes mantienen capacidades técnicas distintas sin crear atributos genéricos", () => {
  for (const reference of groups.ormig) {
    const item = entry(reference);
    assert.equal(item.mapped.product.spec["Capacidad de carga (kg)"], item.source.specs?.["Capacidad de carga (kg)"], reference);
    assert.equal(item.mapped.product.spec.Peso, item.source.specs?.Peso, reference);
    assert.equal(isValidCommercialCategory(item.source, 16, "Nuevo", catalog), false, reference);
  }
  for (const reference of groups.modula) {
    const item = entry(reference);
    assert.equal(typeof item.mapped.product.spec["Carga neta por bandeja"], "string", reference);
    assert.equal(item.mapped.product.spec["Capacidad de carga (kg)"], undefined, reference);
    assert.equal(item.mapped.product.attributes.length, 0, reference);
  }
});

test("tractores, arrastradores y trenes logísticos conservan el significado de sus cargas", () => {
  for (const reference of groups.tractor) {
    const item = entry(reference);
    assert.equal(item.mapped.product.spec["Capacidad de carga (kg)"], undefined, reference);
    assert.equal(item.mapped.product.spec["Capacidad de arrastre"], `${reference === "2134" ? "5000" : "7000"} KG`);
    assert.match(item.mapped.product.description ?? "", /capacidad de arrastre/i, reference);
    assert.equal(isValidCommercialCategory(item.source, 103, "Nuevo", catalog), false, reference);
  }
  for (const reference of groups.trailercaddy) {
    const item = entry(reference);
    assert.equal(item.mapped.product.spec["Capacidad de arrastre"], item.source.specs?.["Capacidad de arrastre"], reference);
    assert.equal(item.mapped.product.spec["Capacidad de carga (kg)"], item.source.specs?.["Capacidad de carga (kg)"], reference);
    assert.match(item.mapped.product.description ?? "", /capacidad de arrastre/i, reference);
  }
  for (const reference of groups.tecnacar) {
    const item = entry(reference);
    assert.equal(item.mapped.product.spec["Capacidad de carga (kg)"], item.source.specs?.["Capacidad de carga (kg)"], reference);
    assert.equal(item.mapped.product.attributes.length, 0, reference);
  }
});

test("las ocho Hyster de gama mixta no reciben una motorización de unidad no acreditada", () => {
  for (const reference of groups.hyster) {
    const item = entry(reference);
    assert.equal(isValidCommercialCategory(item.source, 11, "Nuevo", catalog), false, reference);
    assert.equal(isValidCommercialCategory(item.source, 16, "Nuevo", catalog), false, reference);
    const blank = { ...item.mapped, product: {
      ...item.mapped.product, categorySellID: null, category: null, attributes: []
    } };
    assert.equal(projectCommercialCategory(item.source, blank, catalog).product.categorySellID, 10, reference);
    assert.equal(item.mapped.product.spec["Capacidad de carga (kg)"], item.source.specs?.["Capacidad de carga (kg)"], reference);
  }
  for (const reference of ["2072", "2073"]) {
    const item = entry(reference);
    assert.equal(item.mapped.product.categorySellID, 16, reference);
    assert.equal(item.mapped.product.attributes.length, 6, reference);
  }
});
