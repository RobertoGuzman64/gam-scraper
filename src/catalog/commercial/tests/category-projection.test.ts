import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { prepareImportBatch } from "../../preparation/batch-identity.js";
import { isValidCommercialCategory, projectCommercialCategory } from "../category-projection.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialPublicationInputs } from "../../../pipeline/legacy-export/commercial-inputs.js";

const catalog = await loadImportCatalog();
const providers = await loadCommercialPublicationInputs(process.cwd(), catalog);
const entries = providers.flatMap((provider) => provider.entries);
const product = (providerId: string, reference: string) => {
  const entry = entries.find((item) => item.source.providerId === providerId && item.source.reference === reference);
  assert.ok(entry, `No existe la ficha ${providerId}:${reference}`);
  return entry;
};

test("recupera familias comerciales reales respetando las categorías existentes", () => {
  const cases: readonly [string, string, number][] = [
    ["gam", "220", 22],
    ["gam", "4021", 19],
    ["gam", "6873", 114],
    ["gam", "4778", 6],
    ["gam", "3427", 85],
    ["gam", "1884", 85],
    ["gam", "6688", 74],
    ["gam", "6689", 74],
    ["gam", "5710", 74],
    ["gam", "6623", 74],
    ["gomariz", "1011JFB", 74],
    ["gomariz", "RE454", 67],
    ["mercaeleva", "M928-9933", 74]
  ];
  for (const [providerId, reference, categoryId] of cases) {
    const input = product(providerId, reference);
    assert.equal(input.mapped.product.categorySellID, categoryId, `${providerId}:${reference}`);
    assert.equal(isValidCommercialCategory(input.source, categoryId, input.mapped.product.condition, catalog), true);
    const category = catalog.categories.find((item) => item.id === categoryId);
    assert.equal(input.mapped.product.category, category?.name);
  }
});

test("mantiene sin asignación productos con contradicciones o sin equivalencia acreditada", () => {
  for (const [providerId, reference] of [
    ["gam", "12"], ["gam", "2134"], ["gam", "2159"],
    ["gam", "2572"], ["gam", "3311"], ["gam", "227"],
    ["mercaeleva", "M958-0132"]
  ] as readonly (readonly [string, string])[]) {
    const entry = product(providerId, reference);
    assert.equal(entry.mapped.product.categorySellID, null, `${providerId}:${reference}`);
  }
});

test("rechaza categoría padre sin evidencia y condiciones o familias equivocadas", () => {
  const modula = product("gam", "3427");
  assert.equal(isValidCommercialCategory(modula.source, 85, "Nuevo", catalog), true);
  assert.equal(isValidCommercialCategory(modula.source, 85, "Segunda_Mano", catalog), false);
  assert.equal(isValidCommercialCategory(modula.source, 24, "Nuevo", catalog), false);
  assert.equal(isValidCommercialCategory(modula.source, 74, "Nuevo", catalog), false);
  assert.equal(isValidCommercialCategory(modula.source, 85, null, catalog), false);

  const unassigned = { ...modula.mapped, product: {
    ...modula.mapped.product, categorySellID: null, category: null, attributes: []
  } };
  const wrongManufacturer: ProductRecord = { ...modula.source, brand: "OTRA MARCA" };
  assert.equal(projectCommercialCategory(wrongManufacturer, unassigned, catalog).product.categorySellID, null);
  const wrongContext: ProductRecord = { ...modula.source, categoryKey: "carretillas-nuevas" };
  assert.equal(projectCommercialCategory(wrongContext, unassigned, catalog).product.categorySellID, null);
  const missingEvidence: ProductRecord = { ...modula.source, longDescription: "" };
  assert.equal(projectCommercialCategory(missingEvidence, unassigned, catalog).product.categorySellID, null);

  const same = projectCommercialCategory(modula.source, modula.mapped, catalog);
  assert.equal(same, modula.mapped);
});

test("la proyección comercial no cambia las categorías previamente asignadas por el mapeador", () => {
  const base = prepareImportBatch(entries.map((item) => item.source), catalog).products;
  assert.equal(base.length, entries.length);
  let mapped = 0;
  let recovered = 0;
  for (const [index, entry] of entries.entries()) {
    const original = base[index];
    assert.ok(original);
    if (original.product.categorySellID !== null) {
      mapped += 1;
      assert.equal(entry.mapped.product.categorySellID, original.product.categorySellID, entry.source.url);
      assert.deepEqual(entry.mapped.product.attributes, original.product.attributes);
    } else if (entry.mapped.product.categorySellID !== null) {
      recovered += 1;
    }
  }
  assert.ok(mapped > 1000);
  assert.ok(recovered > 0);
});
