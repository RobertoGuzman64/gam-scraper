import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const attribute = (name: string) => {
  const result = catalog.attributes.find((item) => item.name === name);
  assert.ok(result, name);
  return result;
};
const value = (record: ProductRecord, name: string): string | number | boolean | null =>
  resolveAttributeValue(record, attribute(name));

const generator = (changes: Partial<ProductRecord> = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "otros-nuevos", categoryName: "Otros equipos",
  url: "https://online.gamrentals.com/es/grupos-electrogenos-nuevos/1214-gsw200p",
  title: "Grupo electrógeno PRAMAC GSW200P 200 kVA",
  shortDescription: "PRAMAC GSW200P: venta de grupo electrógeno nuevo 200 kWA",
  longDescription: "El grupo PRAMAC GSW200P integra un alternador profesional.",
  price: null, reference: "1214", condition: "Nuevo", brand: "PRAMAC", model: "GSW200P",
  year: null, location: null, country: null, horometer: null, serialNumber: null, image: null,
  specs: { "Potencia Motor (KW)": "178.66 / 160.77", "Combustible": "Diésel" },
  ...changes
});

const platform = (changes: Partial<ProductRecord> = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "elevacion-nueva", categoryName: "Elevación",
  url: "https://online.gamrentals.com/es/cte/6186-plataforma-sobre-camion-articulado-cte-dz-24-auto-fib",
  title: "PLATAFORMA SOBRE CAMIÓN ELÉCTRICA 24M CTE DZ 24 AUTO FIB",
  shortDescription: "➨ CTE DZ 24 AUTO FIB Nueva ➨ Venta de plataforma sobre camión",
  longDescription: "La plataforma sobre camión articulado CTE DZ 24 AUTO incorpora una cesta de fibra.",
  price: null, reference: "6186", condition: "Nuevo", brand: null, model: null,
  year: null, location: null, country: null, horometer: null, serialNumber: null, image: null, specs: {},
  ...changes
});

const motorcycle = (changes: Partial<ProductRecord> = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "maquinaria", categoryName: "Maquinaria",
  url: "https://online.gamrentals.com/es/ciclomotores-electricos-segunda-mano/6805-lvneng-lx05",
  title: "LVNENG LX05", shortDescription: "La LVNENG LX05 es un ciclomotor eléctrico compacto.",
  longDescription: "La LVNENG LX05 es un ciclomotor eléctrico diseñado para movilidad urbana.",
  price: null, reference: "6805", condition: "Segunda mano", brand: null, model: null,
  year: null, location: null, country: null, horometer: null, serialNumber: null, image: null, specs: {},
  ...changes
});

test("GAM industriales: potencia de grupo publicada en kVA, nunca potencia del motor", () => {
  const record = generator();
  assert.equal(value(record, "Potencia"), 200);
  const prepared = prepareProduct(record, catalog);
  assert.ok(prepared.product.attributes.some((item) => item.attributeID === 70 && item.value === 200));
  assert.ok(!prepared.issues.includes("Atributo obligatorio ausente: Potencia"));
  assert.equal(value(generator({ title: "Grupo electrógeno PRAMAC GSW200P" }), "Potencia"), null);
  assert.equal(value(generator({ title: "Grupo electrógeno PRAMAC GSW200P 200 kW" }), "Potencia"), null);
  assert.equal(value(generator({ specs: { "Potencia Motor (KW)": "178.66 / 160.77" }, shortDescription: "Potencia motor de 178 kW." }), "Potencia"), 200);
});

test("GAM industriales: potencia alternativa o contradictory en el origen queda en revisión", () => {
  for (const record of [
    generator({ shortDescription: "Grupo electrógeno nuevo 194,51 kWA" }),
    generator({ shortDescription: "Grupo electrógeno nuevo 200 kVA y 210 kVA" }),
    generator({ longDescription: "Potencia del grupo 190 kVA." }),
    generator({ specs: { "Potencia": "190", "Potencia Motor (KW)": "178.66 / 160.77" } }),
    generator({ title: "Grupo electrógeno PRAMAC GSW200P 200 kVA / 180 kVA" }),
    generator({ model: "GSW300P" }),
    generator({ providerId: "mercaeleva" }),
    generator({ url: "https://otro-proveedor.es/es/grupos-electrogenos-nuevos/1214" }),
    generator({ url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-yale/1214" })
  ]) assert.equal(value(record, "Potencia"), null);
});

test("GAM industriales: identidad de CTE confirmada por título, descripción corta y larga", () => {
  const record = platform();
  assert.equal(value(record, "Marca"), "CTE");
  assert.equal(value(record, "Modelo"), "DZ 24 AUTO FIB");
  const prepared = prepareProduct(record, catalog);
  assert.ok(prepared.product.attributes.some((item) => item.attributeID === 115 && item.value === "CTE"));
  assert.ok(prepared.product.attributes.some((item) => item.attributeID === 116 && item.value === "DZ 24 AUTO FIB"));
  const another = platform({
    title: "CTE | Plataformas elevadoras sobre camión ZED 21.3 JHV FIB | GAM Online",
    shortDescription: "➨ CTE ZED 21.3 JHV FIB Nueva",
    longDescription: "La plataforma sobre camión articulado CTE ZED 21.3 JHV FIB ofrece gran alcance."
  });
  assert.equal(value(another, "Modelo"), "ZED 21.3 JHV FIB");
});

test("GAM industriales: identidad de CTE contradictoria o ajena queda pendiente", () => {
  for (const record of [
    platform({ shortDescription: "➨ CTE ZED 23.3 JHV FIB Nueva" }),
    platform({ longDescription: "La plataforma CTE DZ 26 AUTO es de gran alcance." }),
    platform({ longDescription: "CTE DZ 24 AUTO: también se vende CTE DZ 26 AUTO." }),
    platform({ shortDescription: "Plataforma sobre camión articulado" }),
    platform({ categoryKey: "manutencion" }),
    platform({ url: "https://otro-proveedor.es/es/cte/6186" }),
    platform({ providerId: "gomariz" })
  ]) {
    assert.equal(value(record, "Marca"), null);
    assert.equal(value(record, "Modelo"), null);
  }
  assert.equal(value(platform({ specs: { Marca: "OTRA" } }), "Marca"), null);
  assert.equal(value(platform({ specs: { Modelo: "DZ 26 AUTO FIB" } }), "Modelo"), null);
});

test("GAM industriales: ciclomotor con identidad repetida en fuentes independientes", () => {
  const record = motorcycle();
  assert.equal(value(record, "Marca"), "LVNENG");
  assert.equal(value(record, "Modelo"), "LX05");
  assert.equal(value(motorcycle({ longDescription: "El ciclomotor LVNENG LX06 es potente." }), "Marca"), null);
  assert.equal(value(motorcycle({ longDescription: "El ciclomotor LVNENG LX06 es potente." }), "Modelo"), null);
  assert.equal(value(motorcycle({ categoryKey: "elevacion" }), "Modelo"), null);
  assert.equal(value(motorcycle({ url: "https://online.gamrentals.com/es/tennant/6805" }), "Modelo"), null);
});

test("GAM industriales: aspiradoras sin potencia de aspiración inequívoca no se rellenan", () => {
  const aspirator = platform({
    categoryKey: "marcas-nuevas", url: "https://online.gamrentals.com/es/aspiradoras-industriales-nuevas/4035-ap-v-can-10",
    title: "Aspiradora TENNANT AP V-CAN-10", brand: "Tennant", model: "AP V-CAN-10",
    longDescription: "Aspiradora profesional con un motor eléctrico de 1200 W y cable de 8 metros."
  });
  assert.equal(value(aspirator, "Potencia de aspiración"), null);
  assert.equal(value(aspirator, "Ancho de trabajo"), null);
});
