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

test("clasifica familias documentadas sin inventar motorización ni nuevas categorías", () => {
  const cases: readonly [string, string, number][] = [
    ["gam", "227", 22], ["gam", "2159", 4],
    ["gam", "3311", 91], ["gam", "3312", 91], ["gam", "3313", 91],
    ["gam", "3314", 91], ["gam", "3315", 91], ["gam", "6182", 91],
    ["gam", "6749", 91], ["gam", "12", 10], ["gam", "2072", 10],
    ["gam", "2073", 10], ["gam", "2163", 10], ["gam", "2164", 10],
    ["gam", "2165", 10], ["gam", "2169", 10], ["gam", "5", 10],
    ["gam", "6", 10], ["gam", "8", 10], ["gam", "2134", 85],
    ["gam", "2135", 85], ["gam", "2572", 85], ["gam", "2573", 85],
    ["gam", "2737", 85], ["gam", "2738", 85], ["gam", "297", 85],
    ["gam", "298", 85], ["gam", "299", 85], ["gomariz", "PV556", 80]
  ];
  for (const [providerId, reference, categoryId] of cases) {
    const entry = product(providerId, reference);
    assert.equal(entry.mapped.product.categorySellID, categoryId, `${providerId}:${reference}`);
    assert.equal(isValidCommercialCategory(entry.source, categoryId, entry.mapped.product.condition, catalog), true);
    const expectedSpec = providerId === "gam" && ["2072", "2073"].includes(reference)
      ? { ...entry.published.spec, Motorización: "GLP" } : entry.published.spec;
    assert.deepEqual(entry.mapped.product.spec, expectedSpec);
    assert.deepEqual(entry.mapped.product.images, entry.published.images);
    assert.ok(catalog.categories.some((item) => item.id === categoryId));
  }
});

test("no traslada reglas comerciales a familias, modelos, rutas ni condiciones distintas", () => {
  const packmat = product("gam", "3311");
  const unmapped = { ...packmat.mapped, product: {
    ...packmat.mapped.product, categorySellID: null, category: null, attributes: []
  } };
  assert.equal(projectCommercialCategory({ ...packmat.source, brand: "OTRA" }, unmapped, catalog).product.categorySellID, null);
  assert.equal(projectCommercialCategory({ ...packmat.source, categoryKey: "carretillas-nuevas" }, unmapped, catalog).product.categorySellID, null);
  assert.equal(projectCommercialCategory({ ...packmat.source, model: "PK999" }, unmapped, catalog).product.categorySellID, null);
  assert.equal(projectCommercialCategory({ ...packmat.source, condition: "Segunda mano" }, {
    ...unmapped, product: { ...unmapped.product, condition: "Segunda_Mano" }
  }, catalog).product.categorySellID, null);

  const hyster = product("gam", "2072");
  const noCategory = { ...hyster.mapped, product: {
    ...hyster.mapped.product, categorySellID: null, category: null, attributes: []
  } };
  assert.equal(projectCommercialCategory({ ...hyster.source, title: "Plataformas elevadoras de segunda mano" }, noCategory, catalog).product.categorySellID, null);
  assert.equal(projectCommercialCategory({ ...hyster.source, model: "OTRO" }, noCategory, catalog).product.categorySellID, null);
  assert.equal(isValidCommercialCategory(hyster.source, 10, "Segunda_Mano", catalog), false);
});

test("mantiene sin asignación productos con contradicciones o sin equivalencia acreditada", () => {
  for (const [providerId, reference] of [
    ["gam", "6653"], ["gam", "6358"], ["gam", "6367"],
    ["gam", "6814"], ["gam", "6815"],
    ["mercaeleva", "M958-0132"], ["mercaeleva", "M294-4678"]
  ] as readonly (readonly [string, string])[]) {
    const entry = product(providerId, reference);
    assert.equal(entry.mapped.product.categorySellID, null, `${providerId}:${reference}`);
  }
});

test("recupera identidad acreditada de Hyster sin deducir combustible de textos contradictorios", () => {
  const truck = product("gam", "8");
  assert.equal(truck.source.title, "Plataformas elevadoras de segunda mano");
  assert.equal(truck.published.title, "Carretilla elevadora HYSTER H3.5FT");
  assert.equal(truck.mapped.product.categorySellID, 10);
  assert.equal(isValidCommercialCategory(truck.source, 10, "Nuevo", catalog), true);
  const noTruckCategory = { ...truck.mapped, product: {
    ...truck.mapped.product, categorySellID: null, category: null, attributes: []
  } };
  for (const source of [
    { ...truck.source, brand: "OTRA" },
    { ...truck.source, model: "H2.5FT" },
    { ...truck.source, categoryKey: "elevacion-nueva" },
    { ...truck.source, specs: { ...truck.source.specs, "Tipo motor": "Eléctrico" } },
    { ...truck.source, specs: { ...truck.source.specs, "Tipo máquina": "Plataformas" } },
    { ...truck.source, url: "https://online.gamrentals.com/es/otras/8" }
  ]) {
    assert.equal(projectCommercialCategory(source, noTruckCategory, catalog).product.categorySellID, null);
  }
  assert.deepEqual(truck.mapped.product.spec, truck.published.spec);
});

test("clasifica los tractores Hyster por familia sin dar por acreditada la propulsión", () => {
  for (const reference of ["2134", "2135"]) {
    const tractor = product("gam", reference);
    assert.equal(tractor.mapped.product.categorySellID, 85);
    assert.equal(isValidCommercialCategory(tractor.source, 85, "Segunda_Mano", catalog), false);
    const noCategory = { ...tractor.mapped, product: {
      ...tractor.mapped.product, categorySellID: null, category: null, attributes: []
    } };
    for (const source of [
      { ...tractor.source, brand: "OTRA" },
      { ...tractor.source, model: "LO10.0T" },
      { ...tractor.source, categoryKey: "carretillas-nuevas" },
      { ...tractor.source, specs: { ...tractor.source.specs, "Capacidad de la batería": "" } },
      { ...tractor.source, url: "https://online.gamrentals.com/es/otras/2134" }
    ]) {
      assert.equal(projectCommercialCategory(source, noCategory, catalog).product.categorySellID, null);
    }
    assert.deepEqual(tractor.mapped.product.spec, tractor.published.spec);
    assert.deepEqual(tractor.mapped.product.images, tractor.published.images);
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

test("la acreditación comercial no acepta otra categoría hoja cuando la familia ya está identificada", () => {
  for (const [providerId, reference, expected, incompatible] of [
    ["gam", "6607", 29, 30],
    ["gam", "6901", 29, 30],
    ["gam", "6873", 114, 29]
  ] as readonly (readonly [string, string, number, number])[]) {
    const entry = product(providerId, reference);
    assert.equal(entry.mapped.product.categorySellID, expected, `${providerId}:${reference}`);
    assert.equal(isValidCommercialCategory(entry.source, expected, entry.mapped.product.condition, catalog), true);
    assert.equal(isValidCommercialCategory(entry.source, incompatible, entry.mapped.product.condition, catalog), false);
  }
});

test("las categorías acreditadas siguen siendo válidas y las pendientes no reciben una asignación ficticia", () => {
  const proposed = entries.filter((entry) => entry.mapped.product.categorySellID !== null);
  assert.equal(proposed.length, 1320);
  for (const entry of proposed) {
    const categoryId = entry.mapped.product.categorySellID;
    assert.notEqual(categoryId, null);
    if (categoryId === null) continue;
    assert.equal(isValidCommercialCategory(entry.source, categoryId, entry.mapped.product.condition, catalog), true,
      `${entry.source.providerId}:${entry.source.reference}`);
  }
  for (const [providerId, reference] of [
    ["gam", "6653"], ["gam", "6358"], ["gam", "6367"],
    ["gam", "6814"], ["gam", "6815"],
    ["mercaeleva", "M958-0132"], ["mercaeleva", "M294-4678"]
  ] as readonly (readonly [string, string])[]) {
    const entry = product(providerId, reference);
    assert.equal(entry.mapped.product.categorySellID, null, `${providerId}:${reference}`);
  }
});
