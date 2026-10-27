import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { prepareProduct } from "../preparation/prepare.js";

const catalog = await loadImportCatalog();
const attr = (name: string) => {
  const result = catalog.attributes.find((entry) => entry.name === name);
  assert.ok(result, name);
  return result;
};
const resolved = (product: ProductRecord, name: string): string | number | boolean | null =>
  resolveAttributeValue(product, attr(name));
const example = (title: string, description: string, specs: ProductRecord["specs"] = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "carretillas-nuevas", categoryName: "Carretillas",
  url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/6423-hyster-j3-0utl",
  title, shortDescription: "Ficha del equipo", longDescription: description,
  price: null, reference: "6423", condition: "Nuevo", brand: "HYSTER", model: "J3.0UTL",
  year: null, location: null, country: null, horometer: null, serialNumber: null, image: null, specs
});

test("GAM manutención: altura de elevación explícita en metros y milímetros", () => {
  const stacker = {
    ...example("Apilador eléctrico 1000Kg Yale MS10E", "El apilador Yale MS10E alcanza una altura máxima de elevación de 3.5 metros."),
    categoryKey: "apiladores-nuevos", model: "MS10E", brand: "YALE"
  };
  assert.equal(resolved(stacker, "Altura de elevación"), 3500);
  assert.equal(resolved(example("Carretilla elevadora eléctrica HYSTER J3.0UTL", "La HYSTER J3.0UTL ofrece una elevación de 3.000 mm."), "Altura de elevación"), 3000);
  const orderPicker = {
    ...example("Preparapedidos 1000 Kg YALE MO10E AC", "El YALE MO10E AC tiene una altura de elevación de 1,7 metros."),
    categoryKey: "manutencion", model: "MO10E AC", brand: "YALE"
  };
  assert.equal(resolved(orderPicker, "Altura de elevación"), 1700);
});

test("GAM manutención: alias técnico con un valor y protecciones para configuraciones múltiples", () => {
  const machine = example("Carretilla elevadora HYSTER J3.0UTL", "La HYSTER J3.0UTL.", { "Altura Elevación (Industr.)": "5815 mm" });
  assert.equal(resolved(machine, "Altura de elevación"), 5815);
  assert.equal(resolved({ ...machine, specs: { "Altura Elevación (Industr.)": "2860/5500 mm" } }, "Altura de elevación"), null);
  assert.equal(resolved({ ...machine, specs: { "Altura Elevación (Industr.)": "2860/5500 mm" }, longDescription: "La HYSTER J3.0UTL tiene una altura de elevación de 5500 mm." }, "Altura de elevación"), null);
});

test("GAM manutención: conserva alturas desconocidas si hay opciones, cotas distintas o modelos incompatibles", () => {
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "La HYSTER J3.0UTL alcanza una altura máxima de elevación de hasta 6.000 mm."), "Altura de elevación"), null);
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "La HYSTER J3.0UTL tiene una altura de elevación de 3000 mm o 5500 mm."), "Altura de elevación"), null);
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "La HYSTER J3.0UTL tiene una altura de elevación de 3000 mm y una altura de elevación de 5000 mm."), "Altura de elevación"), null);
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "La HYSTER J4.0FT tiene una altura de elevación de 3000 mm."), "Altura de elevación"), null);
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "La HYSTER J3.0UTL tiene una altura de trabajo de 10 metros y una altura de mástil de 2100 mm."), "Altura de elevación"), null);
  const scissorPallet = {
    ...example("Transpaleta de tijera manual 1500 kg Logitrans HL", "La transpaleta Logitrans HL carga 1500 kg hasta una elevación de 470 mm y 1000 kg entre 470 y 800 mm."),
    categoryKey: "marcas-nuevas", model: "HL", brand: "LOGITRANS"
  };
  assert.equal(resolved(scissorPallet, "Altura de elevación"), null);
});

test("GAM manutención: carga nominal explícita, sin confundir alternativas", () => {
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "La HYSTER J3.0UTL tiene capacidad de carga de 3.000 kg."), "Capacidad de carga"), 3000);
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "La HYSTER J3.0UTL dispone de capacidad de carga de 2 toneladas."), "Capacidad de carga"), 2000);
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "La HYSTER J3.0UTL puede cargar 3000 kg."), "Capacidad de carga"), null);
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "La HYSTER J3.0UTL tiene capacidad de carga de 1600 kg o 2000 kg."), "Capacidad de carga"), null);
  const direct = example("Carretilla elevadora HYSTER J3.0UTL", "La HYSTER J3.0UTL tiene capacidad de carga de 3000 kg.", { "Capacidad de carga (kg)": "2000 KG" });
  assert.equal(resolved(direct, "Capacidad de carga"), 2000);
});

test("GAM manutención: normaliza mástiles acreditados sin elegir entre configuraciones", () => {
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "Ficha", { "Tipo Mástil": "TRIPLEX" }), "Tipo de mástil"), "Tríplex");
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "Ficha", { "Tipo Mástil": "Duplex" }), "Tipo de mástil"), "Dúplex");
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "La HYSTER J3.0UTL monta un mástil tríplex."), "Tipo de mástil"), "Tríplex");
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "La HYSTER J3.0UTL permite mástiles de 2 o 3 etapas, con hasta 6000 mm en configuración triplex."), "Tipo de mástil"), null);
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "Con distintas opciones de mástil dúplex o tríplex."), "Tipo de mástil"), null);
  assert.equal(resolved(example("Carretilla elevadora HYSTER J3.0UTL", "Ficha", { "Tipo Mástil": "Duplex Vista Plus / Duplex Vista / Triplex Vista Plus" }), "Tipo de mástil"), null);
});

test("GAM manutención: energía eléctrica documentada, sin confundir combustibles alternativos", () => {
  const electric = example("Carretilla elevadora eléctrica HYSTER J3.0UTL", "La HYSTER J3.0UTL es una carretilla eléctrica.", { "Motorización": "Eléctrico" });
  assert.equal(resolved(electric, "Motorización / Energía"), "Eléctrico");
  assert.equal(resolved({ ...electric, specs: { "Tipo motor": "Eléctrico" } }, "Motorización / Energía"), "Eléctrico");
  assert.equal(resolved({ ...electric, specs: {} }, "Motorización / Energía"), null);
  assert.equal(resolved({ ...electric, specs: { "Motorización": "Eléctrico", "Tipo motor": "Diésel" } }, "Motorización / Energía"), null);
  assert.equal(resolved({ ...electric, title: "Carretilla elevadora diésel HYSTER J3.0UTL" }, "Motorización / Energía"), null);
  assert.equal(resolved({ ...electric, title: "Carretilla elevadora eléctrica o diésel HYSTER J3.0UTL" }, "Motorización / Energía"), null);
  assert.equal(resolved({ ...electric, title: "Transpaleta manual HYSTER J3.0UTL" }, "Motorización / Energía"), null);
});

test("GAM manutención: marca y modelo requieren coincidencia de título y descripción", () => {
  const incomplete = example("Carretilla elevadora eléctrica 3000KG HYSTER J3.0UTL", "La HYSTER J3.0UTL ofrece 3000 kg de capacidad.");
  assert.equal(resolved({ ...incomplete, brand: null }, "Marca"), "HYSTER");
  assert.equal(resolved({ ...incomplete, model: null }, "Modelo"), "J3.0UTL");
  assert.equal(resolved({ ...incomplete, brand: null, model: null }, "Marca"), "HYSTER");
  assert.equal(resolved({ ...incomplete, brand: null, model: null }, "Modelo"), "J3.0UTL");
  assert.equal(resolved({ ...incomplete, model: null, longDescription: "La HYSTER J2.0UTL ofrece 2000 kg." }, "Modelo"), null);
  assert.equal(resolved({ ...incomplete, brand: null, longDescription: "La YALE J3.0UTL es una carretilla." }, "Marca"), null);
});

test("GAM manutención: únicamente afecta al proveedor y familias autorizados", () => {
  const value = example("Carretilla elevadora eléctrica HYSTER J3.0UTL", "La HYSTER J3.0UTL tiene una altura de elevación de 3 metros y capacidad de carga de 3000 kg, con mástil tríplex.");
  for (const record of [
    { ...value, providerId: "gomariz" },
    { ...value, url: "https://example.com/es/carretillas-elevadoras-electricas-hyster/6423" },
    { ...value, categoryKey: "limpieza-fregadoras" },
    { ...value, title: "Fregadora industrial HYSTER J3.0UTL" }
  ]) {
    assert.equal(resolved(record, "Altura de elevación"), null);
    assert.equal(resolved(record, "Capacidad de carga"), null);
    assert.equal(resolved(record, "Tipo de mástil"), null);
  }
  const prepared = prepareProduct({ ...value, brand: null, model: null }, catalog);
  assert.ok(prepared.product.attributes.some((item) => item.attributeID === 13 && item.value === 3000));
  assert.ok(prepared.product.attributes.some((item) => item.attributeID === 15 && item.value === 3000));
  assert.ok(prepared.product.attributes.some((item) => item.attributeID === 16 && item.value === "Tríplex"));
  assert.ok(prepared.product.attributes.some((item) => item.attributeID === 115 && item.value === "HYSTER"));
  assert.ok(prepared.product.attributes.some((item) => item.attributeID === 116 && item.value === "J3.0UTL"));
});

test("GAM manutención: capacidad máxima genérica no identifica la configuración de carga", () => {
  const product = example("Carretilla elevadora HYSTER J3.0UTL", "La HYSTER J3.0UTL ofrece una capacidad de carga de hasta 3000 kg.");
  assert.equal(resolved(product, "Capacidad de carga"), null);
  assert.equal(resolved({ ...product, specs: { "Capacidad de carga (kg)": "3000 KG" } }, "Capacidad de carga"), 3000);
  assert.equal(resolved({ ...product, longDescription: "La HYSTER J3.0UTL tiene una capacidad nominal de carga de 3000 kg." }, "Capacidad de carga"), 3000);
  assert.equal(resolved({ ...product, shortDescription: "HYSTER J3.0UTL: capacidad de carga de 3000 kg" }, "Capacidad de carga"), 3000);
});

test("GAM energía: utiliza un motor eléctrico literal sin introducir conflictos ni sustituir valores directos", () => {
  const source = example("Plataforma elevadora BRAVI modelo", "Ficha del equipo", { "Tipo motor": "Eléctrico" });
  assert.equal(resolved(source, "Motorización / Energía"), "Eléctrico");
  for (const invalid of [
    { ...source, specs: { "Tipo motor": "Diésel" } },
    { ...source, specs: { "Tipo motor": "Eléctrico / Diésel" } },
    { ...source, specs: { "Tipo motor": "Eléctrico", "Motorización": "GLP" } },
    { ...source, title: "Plataforma elevadora diésel BRAVI" },
    { ...source, shortDescription: "Motor de gasolina" },
    { ...source, url: "https://example.com/es/plataformas-elevadoras-bravi/2155" },
    { ...source, providerId: "gomariz" }
  ]) {
    assert.equal(resolved(invalid, "Motorización / Energía"), null);
  }
  assert.equal(resolved({ ...source, specs: { "Tipo motor": "Eléctrico", "Motorización / Energía": "Eléctrico" } },
    "Motorización / Energía"), "Eléctrico");
});
