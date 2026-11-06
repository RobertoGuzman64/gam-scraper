import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { prepareImportBatch } from "../../../preparation/batch-identity.js";
import { isValidCommercialCategory, projectCommercialCategory } from "../category-projection.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { excludeGamRelatedProductImages } from "../../../catalog/normalization/gam/gallery.js";
import { loadCommercialPublicationInputs } from "../../export/commercial-inputs.js";
import { resolveCommercialCondition } from "../../../preparation/condition.js";
import { productAttributes } from "../../../preparation/product-attributes.js";
import { reconcileGamVerifiedHysterSGlp } from "../../../preparation/gam/technical/models/hyster-s-glp-evidence.js";

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
    ["gam", "6749", 91], ["gam", "12", 10], ["gam", "2072", 16],
    ["gam", "2073", 16], ["gam", "2163", 10], ["gam", "2164", 10],
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
      ? { ...entry.published.spec, Motorización: "GLP" }
      : providerId === "gam" && ["2134", "2135"].includes(reference)
        ? { ...Object.fromEntries(Object.entries(entry.published.spec).filter(([key]) =>
          key !== "Capacidad de carga (kg)")), "Capacidad de arrastre": reference === "2134" ? "5000 KG" : "7000 KG" }
        : providerId === "gam" && ["2573", "2737"].includes(reference)
          ? Object.fromEntries(Object.entries(entry.published.spec).filter(([key]) =>
            key !== (reference === "2573" ? "Potencia Motor (CV)" : "Potencia Motor (KW)")))
          : entry.published.spec;
    assert.deepEqual(entry.mapped.product.spec, expectedSpec);
    assert.deepEqual(entry.mapped.product.images, providerId === "gam"
      ? excludeGamRelatedProductImages(entry.published.images, entry.source) : entry.published.images);
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

test("la proyección elimina asignaciones obsoletas al elegir una categoría sin relaciones", () => {
  const input = product("gam", "3427");
  const unknown = { ...input.mapped, product: {
    ...input.mapped.product, categorySellID: null, category: null,
    attributes: [{ attributeID: 13, value: 1000 }]
  } };
  const projected = projectCommercialCategory(input.source, unknown, catalog);
  assert.equal(projected.product.categorySellID, 85);
  assert.deepEqual(projected.product.attributes, []);
  assert.deepEqual(unknown.product.attributes, [{ attributeID: 13, value: 1000 }]);
});

test("solo las dos Hyster S con GLP acreditado se reclasifican a la hoja existente", () => {
  const glp = catalog.categories.find((entry) => entry.id === 16);
  assert.ok(glp);
  assert.equal(glp.slug, "carretilla-elevadora-glp");
  for (const reference of ["2072", "2073"]) {
    const entry = product("gam", reference);
    assert.equal(entry.mapped.product.condition, "Nuevo");
    assert.equal(entry.mapped.product.categorySellID, 16);
    assert.equal(entry.mapped.product.category, glp.name);
    assert.equal(isValidCommercialCategory(entry.source, 16, "Nuevo", catalog), true);
    assert.equal(isValidCommercialCategory(entry.source, 10, "Nuevo", catalog), false);
    assert.equal(entry.mapped.product.attributes.some((item) => item.attributeID === 16), false);
    const resolution = productAttributes(reconcileGamVerifiedHysterSGlp(entry.source), glp, catalog);
    assert.deepEqual(resolution.missingRequiredDetails, [
      { attributeID: 16, name: "Tipo de mástil", status: "not_observed" }
    ]);
    const empty = { ...entry.mapped, product: {
      ...entry.mapped.product, categorySellID: null, category: null, attributes: []
    } };
    assert.equal(projectCommercialCategory(entry.source, empty, catalog).product.categorySellID, 16);
    for (const alternative of [
      { ...entry.source, providerId: "gomariz" },
      { ...entry.source, reference: "9999" },
      { ...entry.source, brand: "OTRA" },
      { ...entry.source, model: "S5.0FT" },
      { ...entry.source, categoryKey: "otros-nuevos" },
      { ...entry.source, specs: { ...entry.source.specs, "Tipo motor": "Kubota 3.8L Diesel" } },
      { ...entry.source, specs: { ...entry.source.specs, "Capacidad de carga (kg)": "5000 KG" } },
      { ...entry.source, url: "https://online.gamrentals.com/es/otras/2072" }
    ]) {
      assert.notEqual(projectCommercialCategory(alternative, empty, catalog).product.categorySellID, 16);
    }
  }
  for (const reference of ["12", "2163", "2164", "2165", "2169", "5", "6", "8"]) {
    const entry = product("gam", reference);
    assert.equal(entry.mapped.product.categorySellID, 10, reference);
    assert.equal(isValidCommercialCategory(entry.source, 16, "Nuevo", catalog), false, reference);
  }
  for (const reference of ["3121", "3130"]) {
    const existingGlp = product("gam", reference);
    assert.equal(existingGlp.mapped.product.categorySellID, 16);
    assert.equal(isValidCommercialCategory(existingGlp.source, 16, "Nuevo", catalog), true);
  }
  const bravi = product("gam", "2159");
  assert.equal(bravi.mapped.product.categorySellID, 4);
  assert.equal(isValidCommercialCategory(bravi.source, 102, "Nuevo", catalog), false);
  for (const reference of ["2134", "2135"]) {
    assert.equal(product("gam", reference).mapped.product.categorySellID, 85);
  }
});

test("resuelve únicamente las categorías respaldadas de la campaña GAM y Mercaeleva", () => {
  const cases: readonly [string, string, number][] = [
    ["gam", "6653", 67], ["gam", "6358", 80], ["gam", "6367", 80],
    ["gam", "6814", 115], ["gam", "6815", 115],
    ["mercaeleva", "M958-0132", 47], ["mercaeleva", "M294-4678", 115]
  ];
  for (const [providerId, reference, categoryId] of cases) {
    const entry = product(providerId, reference);
    assert.equal(entry.mapped.product.condition, "Segunda_Mano", `${providerId}:${reference}`);
    assert.equal(entry.mapped.product.categorySellID, categoryId, `${providerId}:${reference}`);
    assert.equal(isValidCommercialCategory(entry.source, categoryId, "Segunda_Mano", catalog), true);
    assert.equal(isValidCommercialCategory(entry.source, categoryId, "Nuevo", catalog), false);
    const empty = { ...entry.mapped, product: {
      ...entry.mapped.product, categorySellID: null, category: null, attributes: []
    } };
    assert.equal(projectCommercialCategory({ ...entry.source, categoryKey: "maquinaria" }, empty, catalog).product.categorySellID, null);
    assert.equal(projectCommercialCategory({ ...entry.source, title: "OTRO EQUIPO" }, empty, catalog).product.categorySellID, null);
    assert.equal(projectCommercialCategory({ ...entry.source, url: "https://example.com/equipo" }, empty, catalog).product.categorySellID, null);
  }
});

test("la barredora EUREKA usada usa la categoría general existente y no contamina otros equipos", () => {
  const sweeper = product("gam", "6653");
  assert.equal(sweeper.mapped.product.condition, "Segunda_Mano");
  assert.equal(sweeper.mapped.product.categorySellID, 67);
  assert.equal(isValidCommercialCategory(sweeper.source, 67, "Segunda_Mano", catalog), true);
  assert.equal(isValidCommercialCategory(sweeper.source, 67, "Nuevo", catalog), false);
  const empty = { ...sweeper.mapped, product: {
    ...sweeper.mapped.product, categorySellID: null, category: null, attributes: []
  } };
  for (const source of [
    { ...sweeper.source, reference: "6654" },
    { ...sweeper.source, externalReference: "EG-00033" },
    { ...sweeper.source, providerId: "gomariz" },
    { ...sweeper.source, brand: "OTRA" },
    { ...sweeper.source, model: "MAGNUM ECO" },
    { ...sweeper.source, title: "Fregadora EUREKA MAGNUM" },
    { ...sweeper.source, shortDescription: "Barredora nueva" },
    { ...sweeper.source, specs: { ...sweeper.source.specs, "Nº de serie": "OTRA" } },
    { ...sweeper.source, url: "https://online.gamrentals.com/es/fregadoras/6653-eureka-magnum" }
  ]) {
    assert.equal(projectCommercialCategory(source, empty, catalog).product.categorySellID, null);
  }
  assert.equal(projectCommercialCategory(sweeper.source, empty, catalog).product.categorySellID, 67);
});

test("la caseta de ocasión solo se proyecta para la unidad CBOX identificada", () => {
  const cabin = product("mercaeleva", "M294-4678");
  assert.equal(cabin.source.condition, null);
  assert.equal(cabin.published.condition, "Segunda_Mano");
  assert.equal(cabin.mapped.product.condition, "Segunda_Mano");
  assert.equal(cabin.mapped.product.categorySellID, 115);
  assert.equal(isValidCommercialCategory(cabin.source, 115, "Segunda_Mano", catalog), true);
  assert.equal(isValidCommercialCategory(cabin.source, 118, "Segunda_Mano", catalog), false);
  const empty = { ...cabin.mapped, product: {
    ...cabin.mapped.product, categorySellID: null, category: null, attributes: []
  } };
  for (const source of [
    { ...cabin.source, reference: "M294-4679" },
    { ...cabin.source, providerId: "gam" },
    { ...cabin.source, url: "https://example.com/es/for-sale/machine/M294-4678" },
    { ...cabin.source, title: "MODULO CASETA NUEVA" },
    { ...cabin.source, longDescription: "MODULO CASETA DIAFANA NUEVA" },
    { ...cabin.source, specs: { ...cabin.source.specs, "Título adicional": "OTRA CASETA" } },
    { ...cabin.source, image: "https://example.com/otra-caseta.jpg" }
  ]) {
    assert.equal(resolveCommercialCondition(source).condition, null);
    assert.equal(projectCommercialCategory(source, empty, catalog).product.categorySellID, null);
  }
  const contradictory = resolveCommercialCondition({ ...cabin.source, condition: "Nuevo" });
  assert.equal(contradictory.condition, null);
  assert.equal(contradictory.contradictory, true);
  assert.equal(projectCommercialCategory(cabin.source, empty, catalog).product.categorySellID, 115);
});

test("la condición acreditada del BT no se traslada a otra unidad ni a otra fuente", () => {
  const source = product("mercaeleva", "M958-0132").source;
  assert.equal(resolveCommercialCondition(source).condition, "Segunda_Mano");
  for (const alternative of [
    { ...source, reference: "M958-0133" },
    { ...source, url: "https://example.com/BT-SWE-160-M958-0132" },
    { ...source, brand: "OTRA" },
    { ...source, model: "SWE 180" },
    { ...source, title: "OTRO APILADOR ELECTRICO" },
    { ...source, specs: { ...source.specs, "Artículo No.": "MER0604" } }
  ]) {
    assert.equal(resolveCommercialCondition(alternative).condition, null);
  }
  const contradictory = resolveCommercialCondition({ ...source, condition: "Nuevo" });
  assert.equal(contradictory.condition, null);
  assert.equal(contradictory.contradictory, true);
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

test("clasifica los tractores Hyster por familia sin forzar una hoja de vehículos", () => {
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
    assert.deepEqual(tractor.mapped.product.spec, {
      ...Object.fromEntries(Object.entries(tractor.published.spec).filter(([key]) =>
        key !== "Capacidad de carga (kg)")),
      "Capacidad de arrastre": reference === "2134" ? "5000 KG" : "7000 KG"
    });
    assert.deepEqual(tractor.mapped.product.images, excludeGamRelatedProductImages(tractor.published.images, tractor.source));
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

test("las 1334 fichas elegibles quedan categorizadas con IDs válidos", () => {
  const proposed = entries.filter((entry) => entry.mapped.product.categorySellID !== null);
  assert.equal(proposed.length, 1334);
  for (const entry of proposed) {
    const categoryId = entry.mapped.product.categorySellID;
    assert.notEqual(categoryId, null);
    if (categoryId === null) continue;
    assert.equal(isValidCommercialCategory(entry.source, categoryId, entry.mapped.product.condition, catalog), true,
      `${entry.source.providerId}:${entry.source.reference}`);
  }
  assert.equal(entries.length, 1344);
  assert.equal(entries.length - proposed.length, 10);
});

test("rechaza categorías hoja sin evidencia aunque existan y respeten la condición", () => {
  for (const reference of ["12", "2163", "2164", "2165", "2169", "5", "6", "8"]) {
    const input = product("gam", reference);
    assert.equal(input.mapped.product.categorySellID, 10);
    for (const id of [11, 16]) {
      assert.equal(isValidCommercialCategory(input.source, id, "Nuevo", catalog), false, `${reference}:${id}`);
    }
  }
  const general = product("gam", "3427");
  assert.equal(general.mapped.product.categorySellID, 85);
  for (const id of [11, 16, 19, 22, 91]) {
    assert.equal(isValidCommercialCategory(general.source, id, "Nuevo", catalog), false, `${id}`);
  }
  for (const [reference, id] of [
    ["2071", 11], ["2312", 16], ["2311", 16], ["2313", 16],
    ["2314", 11], ["3131", 11], ["3130", 16], ["171", 19]
  ] as const) {
    const input = product("gam", reference);
    assert.equal(input.mapped.product.categorySellID, id);
    assert.equal(isValidCommercialCategory(input.source, id, "Nuevo", catalog), true, reference);
    for (const otherId of [11, 16, 19].filter((categoryId) => categoryId !== id)) {
      assert.equal(isValidCommercialCategory(input.source, otherId, "Nuevo", catalog), false,
        `${reference}:${otherId}`);
    }
  }
});
