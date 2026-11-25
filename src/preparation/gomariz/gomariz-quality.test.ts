import assert from "node:assert/strict";
import test from "node:test";
import { resolveCategory } from "../classification/category-mapping.js";
import { resolveAttributeValue } from "../classification/attribute-mapping.js";
import { loadImportCatalog } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { prepareProduct } from "../prepare.js";
import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";

const catalog = await loadImportCatalog();
const url = (family: string, reference: string): string =>
  `https://www.gomarizrent.com/venta/manipulacion-de-materiales/${family}/${reference}/`;
const product = (pageUrl: string, specs: SpecsMap = {}, longDescription: string | null = null): ProductRecord => ({
  providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria de ocasión", url: pageUrl,
  title: "Máquina", shortDescription: null, longDescription, price: null, reference: "TEST",
  brand: null, model: null, year: null, location: null, country: null, horometer: null,
  serialNumber: null, image: null, specs
});
const categorySlug = (record: ProductRecord): string | null =>
  resolveCategory(record, catalog.categories, "Segunda_Mano")?.slug ?? null;
const value = (record: ProductRecord, name: string): string | number | boolean | null => {
  const attribute = catalog.attributes.find((item) => item.name === name);
  if (!attribute) throw new Error(`Atributo no encontrado: ${name}`);
  return resolveAttributeValue(record, attribute);
};

test("Gomariz: mapea manipuladores inequívocos y rodillos descritos expresamente como tándem", () => {
  assert.equal(categorySlug(product(url("manipulador-telescopico", "jcb-540-140"))), "manipulador-teñescopico-segunda-mano");
  const rollerUrl = "https://www.gomarizrent.com/venta/movimiento-de-tierras-demolicion-y-compactacion/rodillo/dynapac-cc142-2/";
  assert.equal(categorySlug(product(rollerUrl, {}, "El rodillo compactador en tándem tiene doble tambor vibratorio.")), "rodillo-tandem-segunda-mano");
  assert.equal(categorySlug(product(rollerUrl)), null);
  const truckUrl = "https://www.gomarizrent.com/venta/camion/camion-porta-maquinaria/scania-p220/";
  assert.equal(categorySlug(product(truckUrl)), null);
});

test("Gomariz: solo vincula mástiles verticales eléctricos, no los manuales sin motor publicado", () => {
  const vertical = "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-mastil-vertical/jlg-1230es/";
  assert.equal(categorySlug(product(vertical, { Motor: "Eléctrico" })), "plataformas-unipersonales-segunda-mano");
  assert.equal(categorySlug(product(vertical)), null);
  assert.equal(categorySlug({ ...product(vertical, { Motor: "Eléctrico" }), title: "Mástil diésel" }), null);
});

test("Gomariz: recupera kVA literal de generadores sin convertir otras potencias", () => {
  const generator = "https://www.gomarizrent.com/venta/energia-electrica-e-iluminacion/generador/pramac-gpw45p/";
  const group = product(generator, { Motor: "Diésel", Potencia: "45 kva" });
  assert.equal(value(group, "Potencia"), 45);
  assert.equal(value(group, "Combustible"), "Diésel");
  assert.equal(value(product(generator, { Potencia: "4x120 W" }), "Potencia"), null);
  assert.equal(value(product(generator, { Motor: "Diésel Voltaje: 230 V" }), "Combustible"), null);
  assert.equal(value(product(generator, { Motor: "Diésel", Combustible: "Gasolina" }), "Combustible"), null);
  const tower = "https://www.gomarizrent.com/venta/energia-electrica-e-iluminacion/torre-de-luz/generac-vb9/";
  assert.equal(value(product(tower, { Potencia: "45 kva" }), "Potencia"), null);
  assert.equal(prepareProduct(group, catalog).product.price, null);
});

test("Gomariz: respeta las unidades del ancho de limpieza y no inventa la alimentación", () => {
  const scrubber = "https://www.gomarizrent.com/venta/limpieza/fregadora/nilfisk-br850-s/";
  const source = product(scrubber, { Motor: "Eléctrico", "Anchura limpieza": "0.81 m" });
  assert.equal(value(source, "Ancho de trabajo"), 810);
  assert.equal(value(source, "Alimentación"), null);
  assert.equal(value(product(scrubber, { "Anchura limpieza": "0.81 m", "Ancho de trabajo": "900 mm" }), "Ancho de trabajo"), null);
  assert.equal(value(product(url("carretilla-industrial", "nissan"), { "Anchura limpieza": "0.81 m" }), "Ancho de trabajo"), null);
});

test("Gomariz: capacidades explícitas de manipuladores, sin atribuirlas a familias ajenas", () => {
  const machines = [
    ["jcb-540-140", "4000 kg", 4000],
    ["genie-gth-2506", "2500 kg", 2500],
    ["jcb-535-140", "3500 kg", 3500]
  ] as const;
  for (const [slug, capacity, expected] of machines) {
    const source = product(url("manipulador-telescopico", slug), { Capacidad: capacity, "Altura de trabajo": "13.8 m" });
    assert.equal(value(source, "Capacidad máxima"), expected, slug);
    assert.equal(value(source, "Altura máxima de elevación"), null, slug);
  }
  const conflicting = product(url("manipulador-telescopico", "jcb-535-140"), {
    Capacidad: "3500 kg", "Capacidad máxima": "4000 kg"
  });
  assert.equal(value(conflicting, "Capacidad máxima"), null);
  assert.equal(value(product(url("manipulador-telescopico", "jcb-535-140"), { Capacidad: "350 l" }), "Capacidad máxima"), null);
  assert.equal(value(product(url("carretilla-industrial", "heli-cpd35"), { Capacidad: "3500 kg" }), "Capacidad máxima"), null);
});

test("Gomariz: combustible etiquetado como motor solo para generadores y torres de luz", () => {
  const towerUrl = "https://www.gomarizrent.com/venta/energia-electrica-e-iluminacion/torre-de-luz/generac-vb9/";
  assert.equal(value(product(towerUrl, { Motor: "Diésel", Potencia: "4x120 W" }), "Combustible"), "Diésel");
  assert.equal(value(product(towerUrl, { Motor: "Diésel", Combustible: "Gasolina" }), "Combustible"), null);
  assert.equal(value(product(towerUrl, { Motor: "Diésel / eléctrico" }), "Combustible"), null);
  assert.equal(value(product(towerUrl, { Motor: "Diésel", Potencia: "4x120 W" }), "Potencia"), 0.48);
  assert.equal(value(product(towerUrl, { Motor: "Diésel", "Altura de trabajo": "8.5 m" }), "Altura del mástil"), null);
  assert.equal(value(product(url("carretilla-industrial", "nissan"), { Motor: "Diésel" }), "Combustible"), null);
});

test("Gomariz: las capacidades conservan su significado en rutas públicas y de producto acreditadas", () => {
  const lift = product("https://www.gomarizrent.com/manipulacion-de-materiales/carretilla-industrial/equiptest-tx2/", { Capacidad: "1800 kg" });
  const platform = product("https://www.gomarizrent.com/elevacion-y-trabajos-en-altura/elevador-tijera/equiptest-tx2/", { Capacidad: "230 kg" });
  const handler = { ...product("https://www.gomarizrent.com/producto/equiptest-tx2/", { Capacidad: "3500 kg" },
    "Manipuladores. Unifica las características de una carretilla elevadora."),
    brand: "EQUIPTEST", model: "TX2", title: "EQUIPTEST TX2" };
  assert.equal(value(lift, "Capacidad de carga"), 1800);
  assert.equal(value(lift, "Capacidad de la cesta"), null);
  assert.equal(value({ ...lift, url: lift.url.replace("carretilla-industrial", "carretilla-todoterreno") }, "Capacidad de carga"), 1800);
  assert.equal(value(platform, "Capacidad de la cesta"), 230);
  assert.equal(value(platform, "Capacidad de carga"), null);
  assert.equal(value(handler, "Capacidad máxima"), 3500);
  assert.equal(value({ ...handler, model: "TX3" }, "Capacidad máxima"), null);
  assert.equal(value({ ...handler, longDescription: null }, "Capacidad máxima"), null);
  assert.equal(value({ ...handler, specs: { Capacidad: "3500 kg", "Capacidad máxima": "4000 kg" } }, "Capacidad máxima"), null);
  for (const raw of ["3500 l", "3500 / 4000 kg", "3500", "0 kg"]) {
    assert.equal(value({ ...lift, specs: { Capacidad: raw } }, "Capacidad de carga"), null);
  }
  for (const invalidUrl of [lift.url.replace("gomarizrent.com", "example.org"),
    lift.url.replace("manipulacion-de-materiales", "limpieza"), `${lift.url}?otra=unidad`]) {
    assert.equal(value({ ...lift, url: invalidUrl }, "Capacidad de carga"), null);
  }
});

test("Gomariz: depósitos y combustible se resuelven en rutas acreditadas sin confundir familias", () => {
  const group = product("https://www.gomarizrent.com/energia-electrica-e-iluminacion/generador/equiptest-tx2/",
    { Capacidad: "120 l", Motor: "Diésel" });
  assert.equal(value(group, "Capacidad del depósito"), 120);
  assert.equal(value(group, "Combustible"), "Diésel");
  assert.equal(value({ ...group, specs: { Capacidad: "120 kg" } }, "Capacidad del depósito"), null);
  assert.equal(value({ ...group, url: group.url.replace("generador", "torre-de-luz") }, "Capacidad del depósito"), null);
  const scrubber = product("https://www.gomarizrent.com/limpieza/fregadora/equiptest-tx2/", { "Anchura limpieza": "0,81 m" });
  assert.equal(value(scrubber, "Ancho de trabajo"), 810);
});
