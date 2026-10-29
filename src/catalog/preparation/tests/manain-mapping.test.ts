import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { resolveCommercialCondition } from "../condition.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

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
  assert.equal(motor.status, "ready");

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
  assert.equal(contaminated.status, "ready");
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

test("Manain: familias acreditadas por ruta y datos técnicos resuelven destinos de ocasión", () => {
  const cases: readonly { readonly url: string; readonly motor: string; readonly slug: string; readonly specs?: SpecsMap }[] = [
    { url: "venda-elevacio-bracos-articulats-jlg-e400ajpn", motor: "Eléctrico", slug: "plataformas-articuladas-electricas-segunda-mano" },
    { url: "venta-manipulacion-carretilla-toyota-8fbe18t", motor: "Eléctrico", slug: "carretillas-elevadoras-electricas-segunda-mano" },
    { url: "venda-manipulacio-de-carregues-carretilles-kalmar-dcg160", motor: "Diésel", slug: "carretillas-elevadoras-diesel-segunda-mano" },
    { url: "venta-manipulacion-carretilla-4x4-agria-tw25-4", motor: "Diésel", slug: "carretillas-todoterreno-segunda-mano" },
    { url: "venta-movimiento-tierra-dumper-ausa-d-601", motor: "Diésel", slug: "dumpers-segunda-mano" },
    { url: "venda-moviment-de-terres-minicargadora-bobcat-s450", motor: "Diésel", slug: "minicargadoras-segunda-mano" },
    { url: "venta-manipulacion-manipulador-manitou-mt-625", motor: "Diésel", slug: "manipulador-teñescopico-segunda-mano",
      specs: { "Altura de elevacion max": "5,85 m", "Alcance maximo": "3,4 m" } }
  ];
  for (const entry of cases) {
    const source = machine(`https://manain.com/producto/${entry.url}/`,
      { "Nueva o usada": "usada", Motor: entry.motor, ...entry.specs }, "");
    const result = prepareProduct(source, catalog);
    assert.equal(category(result.product.categorySellID), entry.slug, entry.url);
    assert.ok(!result.issues.includes("Tipo de máquina de origen sin confirmar"), entry.url);
  }
});

test("Manain: no se fuerza categoría con motorización o evidencia insuficiente", () => {
  const forklift = machine("https://manain.com/producto/venta-manipulacion-carretilla-toyota-8fbe18t/",
    { "Nueva o usada": "usada", Motor: "Híbrido" }, "");
  assert.equal(prepareProduct(forklift, catalog).product.categorySellID, null);
  const manipulator = machine("https://manain.com/producto/venta-manipulacion-manipulador-manitou-mt-625/",
    { "Nueva o usada": "usada", Motor: "Diésel", "Altura de elevacion max": "5,85 m" }, "");
  assert.equal(prepareProduct(manipulator, catalog).product.categorySellID, null);
  const newOffroad = machine("https://manain.com/producto/venta-manipulacion-carretilla-4x4-agria-tw25-4/",
    { "Nueva o usada": "nueva", Motor: "Diésel" }, "");
  assert.equal(prepareProduct(newOffroad, catalog).product.categorySellID, null);
  const generic = machine("https://manain.com/producto/venta-pequena-maquinaria-compactacion-atlas-copco-lf75/",
    { "Nueva o usada": "usada", Motor: "Gasolina" }, "");
  assert.equal(prepareProduct(generic, catalog).product.categorySellID, null);
});

test("Manain: implementos, unipersonales y equipos de manipulación con familia explícita conservan su destino", () => {
  const cases: readonly { readonly url: string; readonly motor: string; readonly slug: string }[] = [
    { url: "venta-movimiento-tierra-martillo-miniex-kubota-km-155", motor: "Diésel", slug: "cazos-implementos-segunda-mano" },
    { url: "venda-elevacio-camions-plataforma-socage-18t", motor: "Diésel", slug: "plataformas-elevadoras-sobre-camion-segunda-mano" },
    { url: "venta-elevacion-unipersonal-power-towers-nano-sp", motor: "Eléctrico", slug: "plataformas-unipersonales-segunda-mano" },
    { url: "venda-elevacio-unipersonals-youngman-boss-x3", motor: "Eléctrico", slug: "plataformas-unipersonales-segunda-mano" },
    { url: "venta-manipulacion-transpaletas-mb-forklift-f4", motor: "Eléctrico", slug: "transpaletas-electricas-segunda-mano" },
    { url: "venta-manipulacion-retractil-bt-rr-b-3", motor: "Eléctrico", slug: "carretillas-elevadoras-retractiles-segunda-mano" }
  ];
  for (const entry of cases) {
    const source = machine(`https://manain.com/producto/${entry.url}/`,
      { "Nueva o usada": "usada", Motor: entry.motor }, "");
    const result = prepareProduct(source, catalog);
    assert.equal(category(result.product.categorySellID), entry.slug, entry.url);
    assert.ok(!result.issues.includes("Tipo de máquina de origen sin confirmar"), entry.url);
  }
});

test("Manain: las categorías de mástil, pequeña maquinaria y motor no acreditado no se suponen", () => {
  const base = { "Nueva o usada": "usada", Motor: "Eléctrico" };
  for (const url of [
    "venta-elevacion-mastil-genie-gr-15",
    "venta-pequena-maquinaria-martillos-electricos-bosch-gsh-5"
  ]) {
    const source = machine(`https://manain.com/producto/${url}/`, base, "");
    assert.equal(prepareProduct(source, catalog).product.categorySellID, null, url);
  }
  const transpaleta = machine("https://manain.com/producto/venta-manipulacion-transpaletas-mb-forklift-f4/",
    { ...base, Motor: "Híbrido" }, "");
  assert.equal(prepareProduct(transpaleta, catalog).product.categorySellID, null);
  const implementoNuevo = machine("https://manain.com/producto/venta-movimiento-tierra-martillo-miniex-kubota-km-155/",
    { ...base, "Nueva o usada": "nueva" }, "");
  assert.equal(prepareProduct(implementoNuevo, catalog).product.categorySellID, null);
});

test("Manain: horas enteras serializadas con cuatro decimales se validan contra la ficha", () => {
  const hours = { ...usedScissor, horometer: "3916.0000", specs: { ...usedScissor.specs, Horas: "3916.0000" } };
  const resolved = resolveAttribute(hours, attribute("Horas de uso"));
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.value, 3916);
  assert.equal(prepareProduct(hours, catalog).status, "ready");
  assert.equal(resolveAttribute({ ...hours, horometer: "3915.0000" }, attribute("Horas de uso")).status, "contradiction");
  const fractional = { ...hours, horometer: "3916.0001", specs: { ...hours.specs, Horas: "3916.0001" } };
  assert.equal(resolveAttribute(fractional, attribute("Horas de uso")).status, "invalid");
});

test("Manain: generadores de ruta catalana y unidad kVA repetida conservan potencia acreditada", () => {
  const source = machine("https://manain.com/producto/venda-energia-grups-electrogens-inmesol-ak-500/", {
    "Nueva o usada": "usada", Motor: "Gasolina", Potencia: "5 kva"
  }, "");
  const prepared = prepareProduct(source, catalog);
  assert.equal(category(prepared.product.categorySellID), "grupos-electrogenos-segunda-mano");
  assert.equal(prepared.status, "ready");
  const doubled = { ...source, url: "https://manain.com/producto/venta-energia-grupo-electrogeno-inmesol-iir-165/",
    specs: { ...source.specs, Potencia: "150kva kva" } };
  assert.equal(resolveAttribute(doubled, attribute("Potencia")).value, 150);
  assert.equal(prepareProduct(doubled, catalog).status, "ready");
  const contradictoryUnit = { ...doubled, specs: { ...doubled.specs, Potencia: "150kva kw" } };
  assert.equal(resolveAttribute(contradictoryUnit, attribute("Potencia")).status, "invalid");
});


test("Manain: pesos con cuatro decimales acreditados no se confunden con miles", () => {
  const tool = machine("https://manain.com/producto/venta-pequena-maquinaria-martillos-electricos-bosch-gsh-5/", {
    "Nueva o usada": "usada", Motor: "Eléctrico", Peso: "5.5000 kg"
  }, "");
  assert.equal(resolveAttribute(tool, attribute("Peso operativo")).value, 5.5);
  assert.equal(resolveAttribute(tool, attribute("Peso")).value, 5.5);
  assert.ok(!prepareProduct(tool, catalog).issues.some((issue) => issue.includes("Peso")));
  assert.equal(prepareProduct(tool, catalog).status, "ready");
  assert.equal(prepareProduct(tool, catalog).product.categorySellID, null);
  for (const peso of ["kg", "5.2340 kg", "5.2000 mm", "5.2000-6 kg"]) {
    assert.equal(resolveAttribute({ ...tool, specs: { ...tool.specs, Peso: peso } }, attribute("Peso")).status,
      "invalid", peso);
  }
  assert.equal(resolveAttribute({ ...tool, providerId: "gam" }, attribute("Peso")).status, "invalid");
});
