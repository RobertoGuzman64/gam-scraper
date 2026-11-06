import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { buildProductIdentity } from "../../identity.js";
import { prepareImportBatch } from "../../../preparation/batch-identity.js";
import type { OfflinePreparation } from "../../../preparation/offline-document.js";
import { measurePreparationWork } from "../preparation-work.js";

const record = (reference: string): ProductRecord => ({
  providerId: "gam", categoryKey: "plataforma", categoryName: "Plataformas",
  url: `https://example.test/maquina/${reference}`, reference, title: "Máquina original",
  shortDescription: "Descripción corta", longDescription: null, price: null,
  brand: null, model: null, year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: null,
  specs: { "País": "España", "Capacidad de arrastre (kg)": "500", "Carga Máxima (kg)": "500" }
});

const preparedFrom = (product: ProductRecord): OfflinePreparation["products"][number] => {
  const prepared = prepareImportBatch([product]).products[0]!;
  return {
    ...prepared,
    product: {
      ...prepared.product,
      title: product.title,
      description: product.shortDescription,
      description_general: product.longDescription,
      spec: product.specs ?? {}
    }
  };
};

const measure = (sources: readonly ProductRecord[], products: OfflinePreparation["products"]): ReturnType<typeof measurePreparationWork> =>
  measurePreparationWork(sources, {
    identities: products.map((product) => `${product.product.providerId}:ref:${product.product.reference?.toLowerCase()}`), products
  });

test("sin deltas, hay máquinas procesadas pero ninguna transformada", () => {
  const source = record("A1");
  assert.deepEqual(measure([source], [preparedFrom(source)]), {
    processedProducts: 1, transformedProducts: 0,
    specificationsAdded: 0, specificationsRenamed: 0,
    specificationValuesFormatted: 0, specificationValuesChanged: 0,
    descriptionsGenerated: 0, descriptionsTransformed: 0, titlesTransformed: 0
  });
});

test("una máquina con varios cambios cuenta una vez y separa las clases de delta", () => {
  const source = record("A1");
  const before = preparedFrom(source);
  const after = {
    ...before,
    product: {
      ...before.product, title: "Título nuevo", description: "Otra descripción",
      description_general: "Descripción general nueva",
      spec: {
        "pais": "España", "Capacidad de arrastre (kg)": 500,
        "Carga Máxima (kg)": "600", "Velocidad máxima sin carga (km/h)": "5"
      }
    }
  };
  const summary = measure([source], [after]);
  assert.deepEqual(summary, {
    processedProducts: 1, transformedProducts: 1,
    specificationsAdded: 1, specificationsRenamed: 1,
    specificationValuesFormatted: 1, specificationValuesChanged: 1,
    descriptionsGenerated: 1, descriptionsTransformed: 1, titlesTransformed: 1
  });
});

test("el cambio equivalente de una clave no es una especificación nueva", () => {
  const source = { ...record("A1"), specs: { "pais": "España" } };
  const before = preparedFrom(source);
  const summary = measure([source], [{ ...before, product: { ...before.product, spec: { "País": "España" } } }]);
  assert.equal(summary.specificationsRenamed, 1);
  assert.equal(summary.specificationsAdded, 0);
  assert.equal(summary.transformedProducts, 1);
});

test("especificaciones vacías, desconocidas y aliases ambiguos no se clasifican como recuperaciones", () => {
  const source = { ...record("A1"), specs: { "País": "España", "pais": "España", "Otra": "texto" } };
  const before = preparedFrom(source);
  const summary = measure([source], [{
    ...before, product: { ...before.product, spec: { "País": "España", "Otra": "otro texto", "Carga Máxima (kg)": "" } }
  }]);
  assert.equal(summary.specificationsAdded, 0);
  assert.equal(summary.specificationsRenamed, 0);
  assert.equal(summary.specificationValuesChanged, 0);
  assert.equal(summary.transformedProducts, 0);
});

test("identidades se comparan por clave y no por el orden del lote", () => {
  const first = record("A1");
  const second = record("B2");
  const a = preparedFrom(first);
  const b = preparedFrom(second);
  const summary = measurePreparationWork([second, first], {
    identities: [buildProductIdentity(first).key, buildProductIdentity(second).key],
    products: [a, { ...b, product: { ...b.product, title: "Nuevo título" } }]
  });
  assert.equal(summary.processedProducts, 2);
  assert.equal(summary.transformedProducts, 1);
  assert.equal(summary.titlesTransformed, 1);
});

test("rechaza duplicados, identidades desconocidas y lotes desiguales", () => {
  const source = record("A1");
  const item = preparedFrom(source);
  assert.throws(() => measure([source, source], [item, item]), /duplicada/);
  assert.throws(() => measurePreparationWork([source], {
    identities: [buildProductIdentity(record("X9")).key], products: [item]
  }), /no resuelto/);
  assert.throws(() => measurePreparationWork([source], { identities: [], products: [item] }), /cantidades/);
});

test("no confunde el ajuste de espacios editoriales con cambio de contenido", () => {
  const source = record("A1");
  const original = preparedFrom(source);
  const summary = measure([source], [{
    ...original, product: { ...original.product, description: " Descripción corta ", title: " Máquina original " }
  }]);
  assert.equal(summary.transformedProducts, 0);
});
