import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";
import { loadImportCatalog } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../classification/attribute-mapping.js";
import { manainSourceFamily, type ManainFamily } from "./source.js";
import { resolveCommercialCondition } from "../product/condition.js";
import { prepareProduct } from "../../commercial/legacy-export/prepare-product.js";

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
  assert.ok(motor.issues.includes("Cobertura editorial insuficiente: descripción general"));

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
  assert.ok(contaminated.issues.includes("Cobertura editorial insuficiente: descripción general"));
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

test("Manain: las familias técnicas publicadas se reconocen sin inventar categorías comerciales", () => {
  const cases: readonly { readonly path: string; readonly family: ManainFamily }[] = [
    { path: "venta-elevacion-mastil-lgmg-m0810je-3", family: "elevacion-mastil" },
    { path: "venda-elevacio-mastils-verticals-genie-gr-15", family: "elevacion-mastil" },
    { path: "venta-pequena-maquinaria-compactacion-atlas-copco-lf75-3", family: "pequena-maquinaria-compactacion" },
    { path: "venta-pequena-maquinaria-demolicion-holzstar-tks-316-e", family: "pequena-maquinaria-demolicion" },
    { path: "venta-movimiento-tierra-rodillo-compactador-wacker-rd-28-120", family: "movimiento-tierra-rodillo-compactador" },
    { path: "venta-pequena-maquinaria-radiales-electricas-bosch-gws-22-230-h-3", family: "pequena-maquinaria-radiales-electricas" },
    { path: "venta-pequena-maquinaria-martillos-electricos-bosch-gsh-5", family: "pequena-maquinaria-martillos-electricos" },
    { path: "venta-pequena-maquinaria-hidrolimpiadora-bosch-ghp-5-75", family: "pequena-maquinaria-hidrolimpiadora" },
    { path: "venta-pequena-maquinaria-bomba-sumergible-atlas-copco-weda-04s", family: "pequena-maquinaria-bomba-sumergible" },
    { path: "venta-manipulacion-apiladors-atlet-160-sth-sn-380", family: "manipulacion-apilador" }
  ];
  for (const { path, family } of cases) {
    const record = machine(`https://manain.com/producto/${path}/`, { "Nueva o usada": "usada" }, "");
    assert.equal(manainSourceFamily(record), family, path);
    assert.equal(prepareProduct(record, catalog).product.categorySellID, null, path);
  }
  assert.equal(manainSourceFamily(machine("https://manain.com/producto/venta-elevacion-indeterminada/", {}, "")), null);
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
  assert.equal(prepareProduct(hours, catalog).status, "review");
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
  assert.equal(prepared.status, "review");
  const doubled = { ...source, url: "https://manain.com/producto/venta-energia-grupo-electrogeno-inmesol-iir-165/",
    specs: { ...source.specs, Potencia: "150kva kva" } };
  assert.equal(resolveAttribute(doubled, attribute("Potencia")).value, 150);
  assert.equal(prepareProduct(doubled, catalog).status, "review");
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
  assert.equal(prepareProduct(tool, catalog).status, "review");
  assert.equal(prepareProduct(tool, catalog).product.categorySellID, null);
  const unmeasured = { ...tool, specs: { ...tool.specs, Peso: "kg" } };
  assert.deepEqual(resolveAttribute(unmeasured, attribute("Peso")), { status: "not_observed", value: null });
  assert.deepEqual(resolveAttribute(unmeasured, attribute("Peso operativo")), { status: "not_observed", value: null });
  assert.equal(prepareProduct(unmeasured, catalog).status, "review");
  assert.equal(Object.hasOwn(prepareProduct(unmeasured, catalog).product.spec, "Peso"), false);
  assert.equal(resolveAttribute({ ...unmeasured, providerId: "gam" }, attribute("Peso")).status, "invalid");
  for (const peso of ["5.2340 kg", "5.2000 mm", "5.2000-6 kg"]) {
    assert.equal(resolveAttribute({ ...tool, specs: { ...tool.specs, Peso: peso } }, attribute("Peso")).status,
      "invalid", peso);
  }
  assert.equal(resolveAttribute({ ...tool, providerId: "gam" }, attribute("Peso")).status, "invalid");
});

test("Manain: disponibilidad de elevación libre sin medida no se interpreta como milímetros", () => {
  const source = machine("https://manain.com/producto/venta-manipulacion-carretilla-4x4-manitou-mc-25-4-d-k-st5-s1-23/", {
    "Nueva o usada": "usada", "Elevacion libre": "si"
  }, "");
  assert.deepEqual(resolveAttribute(source, attribute("Elevación libre")), { status: "not_observed", value: null });
  const prepared = prepareProduct(source, catalog);
  assert.equal(prepared.status, "review");
  assert.equal(prepared.product.spec["Elevacion libre"], "Sí");
  const measured = { ...source, specs: { ...source.specs, "Elevación libre (mm)": "1500 mm" } };
  assert.equal(resolveAttribute(measured, attribute("Elevación libre")).value, 1500);
  const malformed = { ...source, specs: { ...source.specs, "Elevacion libre": "inexacta" } };
  assert.equal(resolveAttribute(malformed, attribute("Elevación libre")).status, "invalid");
});


test("Manain: las etiquetas del manipulador resuelven magnitudes obligatorias sin aceptar valores incompatibles", () => {
  const source = machine("https://manain.com/producto/venta-manipulacion-manipulador-equiptest-tx1/", {
    "Nueva o usada": "usada", Motor: "Diésel", "Capacidad carga": "4000 kg",
    "Altura de elevacion max": "14 m", "Alcance maximo": "3,09/1,01 m"
  }, "");
  const result = prepareProduct(source, catalog);
  assert.equal(category(result.product.categorySellID), "manipulador-teñescopico-segunda-mano");
  const capacity = attribute("Capacidad máxima");
  const height = attribute("Altura máxima de elevación");
  assert.ok(result.product.attributes.some((entry) => entry.attributeID === capacity.id && entry.value === 4000));
  assert.ok(result.product.attributes.some((entry) => entry.attributeID === height.id && entry.value === 14));
  assert.equal(resolveAttribute({ ...source, specs: { ...source.specs, "Capacidad máxima": "3000 kg" } }, capacity).status,
    "contradiction");
  assert.equal(resolveAttribute({ ...source, specs: { ...source.specs, "Altura de elevacion max": "14/15 m" } }, height).status,
    "invalid");
  assert.equal(resolveAttribute(usedScissor, capacity).status, "not_observed");
});

test("Manain: la familia de apiladores eléctricos se clasifica sin depender del modelo ni de la capacidad", () => {
  const source: ProductRecord = {
    ...machine("https://manain.com/producto/venta-manipulacion-apilador-equiptest-s1/", {
      "Nueva o usada": "usada", Marca: "EQUIPTEST", Modelo: "S1", Motor: "Eléctrico", "Capacidad carga": "1200 kg"
    }, "Apilador eléctrico"),
    brand: "EQUIPTEST", model: "S1", title: "S1", condition: "Segunda mano"
  };
  const prepared = prepareProduct(source, catalog);
  assert.equal(category(prepared.product.categorySellID), "apiladores-electricos-segunda-mano");
  assert.ok(prepared.importIssues?.createMany.includes("Atributo obligatorio ausente: Altura de elevación"));
  assert.equal(category(prepareProduct({ ...source, shortDescription: "Apilador diésel" }, catalog).product.categorySellID), null);
  assert.equal(category(prepareProduct({ ...source, specs: { ...source.specs, Modelo: "S2" } }, catalog).product.categorySellID), null);
  assert.equal(category(prepareProduct({ ...source, url: "https://manain.com/producto/venta-elevacion-mastil-equiptest-s1/" }, catalog).product.categorySellID), null);
});

test("Manain: tracción por ruedas solo en familias y configuraciones acreditadas", () => {
  const target = { name: "Tipo de tracción", type: "SELECT", unit_option: "Ruedas / Orugas / Sobre camión / Empuje manual" } as const;
  const source = { ...machine("https://manain.com/producto/venta-elevacion-tijera-equiptest-x1/", { "Tracción": "4×4" }, "Plataforma de tijera"), reference: "SYNTHETIC" };
  assert.equal(resolveAttribute(source, target).value, "Ruedas");
  assert.equal(resolveAttribute({ ...source, specs: { "Tracción": "4x2" } }, target).value, "Ruedas");
  for (const traction of ["4x4 / 4x2", "4x4 opcional", "2x2", "Orugas", "4x4 hidrostatico"]) {
    assert.equal(resolveAttribute({ ...source, specs: { "Tracción": traction } }, target).value, null);
  }
  assert.equal(resolveAttribute({ ...source, shortDescription: "Plataforma de tijera sobre orugas" }, target).value, null);
  assert.equal(resolveAttribute({ ...source, url: "https://manain.com/producto/venta-elevacion-camion-cesta-equiptest-x1/", shortDescription: null }, target).value, null);
  assert.equal(resolveAttribute({ ...source, specs: { "Tracción": "4x4", "Tipo de tracción": "Orugas" } }, target).value, "Orugas");
});

test("Manain: longitud de horquillas explícita sin confundir rangos ni familias", () => {
  const target = { name: "Longitud de horquillas", type: "NUMBER", unit_option: "mm" } as const;
  const source = { ...machine("https://manain.com/producto/venta-manipulacion-carretilla-equiptest-x1/", { "Largo horquillas": "1200 mm" }, "Carretilla elevadora"), reference: "SYNTHETIC" };
  assert.equal(resolveAttribute(source, target).value, 1200);
  for (const length of ["920-2200 mm", "1200 kg", "1200", "0 mm"]) {
    assert.equal(resolveAttribute({ ...source, specs: { "Largo horquillas": length } }, target).value, null);
  }
  assert.equal(resolveAttribute({ ...source, url: "https://manain.com/producto/venta-elevacion-tijera-equiptest-x1/" }, target).value, null);
  assert.equal(resolveAttribute({ ...source, specs: { "Largo horquillas": "1200 mm", "Longitud de horquillas": "1400 mm" } }, target).value, 1400);
});

test("Manain: conserva las tres dimensiones explícitas de la cesta de camión", () => {
  const target = { name: "Dimensiones de la cesta", type: "TEXT", unit_option: "m" } as const;
  const source = machine("https://manain.com/producto/venta-elevacion-camion-cesta-equiptest-x1/", { "Longitud cesta": "1,2 m", "Ancho cesta": "0,8 m", "Alto cesta": "1,3 m" }, "Camión cesta");
  assert.equal(resolveAttribute(source, target).value, "1,2 x 0,8 x 1,3 m");
  assert.equal(resolveAttribute({ ...source, specs: { ...source.specs, "Alto cesta": "1-2 m" } }, target).value, null);
  assert.equal(resolveAttribute({ ...source, specs: { ...source.specs, "Longitud plataforma": "2 m" } }, target).value, null);
  assert.equal(resolveAttribute({ ...source, specs: { ...source.specs, "Dimensiones de la cesta": "1 x 1 m" } }, target).value, "1 x 1 m");
});

test("Manain: proyecta cotas explícitas de mástil y anchura en su familia", () => {
  const mast = { name: "Altura mástil replegado", type: "NUMBER", unit_option: "mm" } as const;
  const width = { name: "Ancho de la máquina", type: "NUMBER", unit_option: "mm" } as const;
  const source = machine("https://manain.com/producto/venta-manipulacion-retractil-equiptest-x1/", { "Mastil replegado": "2,45 m" }, "Carretilla retráctil");
  assert.equal(resolveAttribute(source, mast).value, 2450);
  assert.equal(resolveAttribute({ ...source, specs: { "Mastil replegado": "2-3 m" } }, mast).value, null);
  const loader = machine("https://manain.com/producto/venta-movimiento-tierra-minicargadora-equiptest-x1/", { Ancho: "1430 mm" }, "Minicargadora");
  assert.equal(resolveAttribute(loader, width).value, 1430);
  assert.equal(resolveAttribute({ ...loader, specs: { Ancho: "1430 kg" } }, width).value, null);
  assert.equal(resolveAttribute({ ...source, specs: { Ancho: "1430 mm" } }, width).value, null);
});

test("Manain: recupera un par de batería explícito sin elegir alternativas", () => {
  const target = { name: "Batería (V / Ah)", type: "TEXT", unit_option: "V / Ah" } as const;
  const source = machine("https://manain.com/producto/venta-manipulacion-transpaletas-equiptest-x1/", { Motor: "Eléctrico", Bateria: "litio 24v 40ah" }, "Transpaleta eléctrica");
  assert.equal(resolveAttribute(source, target).value, "24 V / 40 Ah");
  for (const raw of ["24v / 40-60ah", "24v", "4 x 12v 40ah", "24v 0ah"]) {
    assert.equal(resolveAttribute({ ...source, specs: { Motor: "Eléctrico", Bateria: raw } }, target).value, null);
  }
  assert.equal(resolveAttribute({ ...source, specs: { ...source.specs, Voltios: "48 v" } }, target).value, null);
  assert.equal(resolveAttribute({ ...source, specs: { ...source.specs, Motor: "Diésel" } }, target).value, null);
});
