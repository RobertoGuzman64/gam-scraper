import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { resolveCommercialCondition } from "../preparation/condition.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();

const machine = (url: string, specs: SpecsMap, description: string): ProductRecord => ({
  providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta", url,
  title: "Máquina en venta", reference: "MAN1802", brand: null, model: null, year: null,
  shortDescription: description, longDescription: null, condition: null, price: null,
  location: null, country: null, horometer: null, serialNumber: null, image: null, specs
});

const attribute = (name: string) => {
  const definition = catalog.attributes.find((item) => item.name === name);
  assert.ok(definition);
  return definition;
};

const category = (id: number | null): string | null => catalog.categories.find((item) => item.id === id)?.slug ?? null;

const usedScissor = machine("https://manain.com/producto/venta-elevacion-tijera-haulotte-h18-sx/", {
  "Nueva o usada": "usada", Motor: "Diésel", "Altura trabajo": "18 m", "Capacidad carga": "500 kg"
}, "Plataforma tijera diésel de 18m de altura de trabajo.");

test("Manain: el origen y el motor acreditan la categoría; las unidades y la condición se mantienen", () => {
  const used = prepareProduct(usedScissor, catalog);
  assert.equal(used.product.condition, "Segunda_Mano");
  assert.equal(category(used.product.categorySellID), "plataformas-tijera-diesel-segunda-mano");
  assert.ok(used.product.attributes.some((entry) =>
    entry.attributeID === attribute("Altura de trabajo").id && entry.value === 18));
  assert.ok(used.product.attributes.some((entry) =>
    entry.attributeID === attribute("Capacidad de la cesta").id && entry.value === 500));
  assert.ok(!used.issues.some((issue) => issue.includes("Condición comercial")));

  const newScissor = prepareProduct({ ...usedScissor, specs: { ...usedScissor.specs,
    "Nueva o usada": "nueva", Motor: "Eléctrico" },
    shortDescription: "Plataforma tijera eléctrica de 10m de altura de trabajo." }, catalog);
  assert.equal(newScissor.product.condition, "Nuevo");
  assert.equal(category(newScissor.product.categorySellID), "plataforma-tijera-electrica");
  assert.ok(newScissor.product.attributes.some((entry) =>
    entry.attributeID === attribute("Motorización / Energía").id && entry.value === "Eléctrico"));
});

test("Manain: condición y motorización contradictorias se retienen sin elegir un destino", () => {
  const commercial = prepareProduct({ ...usedScissor, condition: "Nuevo" }, catalog);
  assert.equal(commercial.product.condition, null);
  assert.equal(commercial.product.categorySellID, null);
  assert.equal(commercial.status, "review");
  assert.ok(commercial.issues.some((issue) => issue.includes("Condición comercial contradictoria")));

  const motor = prepareProduct({ ...usedScissor, specs: { ...usedScissor.specs, Motor: "Eléctrico" } }, catalog);
  assert.equal(motor.product.categorySellID, null);
  assert.ok(!motor.product.attributes.some((entry) => entry.attributeID === attribute("Altura de trabajo").id));
  assert.equal(motor.status, "review");

  const absent = { ...usedScissor, specs: { "Nueva o usada": "usada" }, shortDescription: "" };
  assert.equal(prepareProduct(absent, catalog).product.categorySellID, null);
  assert.equal(resolveCommercialCondition(absent).condition, "Segunda_Mano");
});

test("Manain: el generador conserva la categoría documental y normaliza solo potencia y depósito publicados", () => {
  const source = machine("https://manain.com/producto/venta-energia-grupo-electrogeno-pramac-gbw30y/", {
    "Nueva o usada": "usada", Motor: "Diésel", Potencia: "19 kva", "Capacidad depósito": "51 l"
  }, "Grupo electrógeno diésel.");
  const result = prepareProduct(source, catalog);
  assert.equal(category(result.product.categorySellID), "grupos-electrogenos-segunda-mano");
  assert.ok(result.product.attributes.some((item) => item.attributeID === attribute("Potencia").id && item.value === 19));
  assert.ok(result.product.attributes.some((item) => item.attributeID === attribute("Capacidad del depósito").id && item.value === 51));
  assert.ok(result.product.attributes.some((item) => item.attributeID === attribute("Combustible").id && item.value === "Diésel"));
  const ambiguous = prepareProduct({ ...source, specs: { ...source.specs, Potencia: "19-22 kva" } }, catalog);
  assert.ok(ambiguous.issues.includes("Atributo no normalizable: Potencia"));
  assert.ok(!ambiguous.product.attributes.some((item) => item.attributeID === attribute("Potencia").id));

  const contaminated = prepareProduct({ ...source,
    shortDescription: "Plataforma de brazo articulado diésel de 18,19m de altura de trabajo." }, catalog);
  assert.equal(contaminated.product.categorySellID, null);
  assert.equal(contaminated.status, "review");
});

test("Manain: los atributos y los destinos no se extrapolan a proveedores ni rutas no acreditados", () => {
  const unrelated = { ...usedScissor, providerId: "gomariz" };
  assert.equal(resolveAttribute(unrelated, attribute("Capacidad de la cesta")).value, null);
  const unknown = prepareProduct({ ...usedScissor, url: "https://manain.com/producto/venta-maquina-inespecifica/" }, catalog);
  assert.equal(unknown.product.categorySellID, null);
  assert.equal(unknown.product.condition, "Segunda_Mano");
});


test("Manain: la ruta de venta catalana acreditada conserva el destino de tijera diésel", () => {
  const source = { ...usedScissor,
    url: "https://manain.com/producto/venda-elevacio-tisores-jlg-530lrt/",
    title: "530LRT", brand: "JLG", model: "530LRT", reference: "MA3904",
    specs: { "Nueva o usada": "usada", Motor: "Diésel", "Altura trabajo": "18,15 m", "Capacidad carga": "680 kg" },
    shortDescription: null
  };
  const prepared = prepareProduct(source, catalog);
  assert.equal(prepared.product.condition, "Segunda_Mano");
  assert.equal(category(prepared.product.categorySellID), "plataformas-tijera-diesel-segunda-mano");
  assert.ok(prepared.product.attributes.some((entry) =>
    entry.attributeID === attribute("Altura de trabajo").id && entry.value === 18.15));
});
