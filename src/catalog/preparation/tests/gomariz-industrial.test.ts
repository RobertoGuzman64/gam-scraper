import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../prepare.js";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";

const catalog = await loadImportCatalog();
const source = (family: string, section: string, specs: SpecsMap = {}, title = "Máquina"): ProductRecord => ({
  providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria de ocasión",
  url: `https://www.gomarizrent.com/venta/${section}/${family}/ficha/`,
  title, shortDescription: null, longDescription: null, price: null, reference: "TEST",
  brand: null, model: null, year: null, location: null, country: null, horometer: null,
  serialNumber: null, image: null, specs
});
const value = (record: ProductRecord, name: string): string | number | boolean | null => {
  const attribute = catalog.attributes.find((item) => item.name === name);
  assert.ok(attribute);
  return resolveAttributeValue(record, attribute);
};

const material = "manipulacion-de-materiales";
const works = "movimiento-de-tierras-demolicion-y-compactacion";
const energy = "energia-electrica-e-iluminacion";

test("Gomariz: motorización eléctrica solo en ramas industriales con motor inequívoco", () => {
  for (const [section, family] of ([
    [material, "carretilla-industrial"], [material, "carretilla-retractil"],
    [material, "manipulador-telescopico"], ["limpieza", "fregadora"],
    [works, "dumper"], [works, "rodillo"], [works, "retroexcavadora"]
  ] as const)) {
    assert.equal(value(source(family, section, { Motor: "Eléctrico" }), "Motorización / Energía"), "Eléctrico", family);
    assert.equal(value(source(family, section), "Motorización / Energía"), null, family);
    assert.equal(value(source(family, section, { Motor: "Diésel" }), "Motorización / Energía"), null, family);
  }
  const lift = source("carretilla-industrial", material, { Motor: "Eléctrico" });
  assert.equal(value({ ...lift, providerId: "gam" }, "Motorización / Energía"), null);
  assert.equal(value({ ...lift, url: lift.url.replace("gomarizrent.com", "otra.example") }, "Motorización / Energía"), null);
  assert.equal(value({ ...lift, title: "Carretilla diésel" }, "Motorización / Energía"), null);
  assert.equal(value({ ...lift, specs: { Motor: "Eléctrico", Combustible: "Diésel" } }, "Motorización / Energía"), null);
  assert.equal(value({ ...lift, specs: { Motor: "Eléctrico, Gasolina" } }, "Motorización / Energía"), null);
  assert.equal(value(source("generador", energy, { Motor: "Eléctrico" }), "Motorización / Energía"), null);
  assert.equal(value(source("camion-porta-maquinaria", "camion", { Motor: "Eléctrico" }), "Motorización / Energía"), null);
  assert.equal(value(source("carretilla-industrial", "energia-electrica-e-iluminacion", { Motor: "Eléctrico" }), "Motorización / Energía"), null);
  assert.equal(value(source("carretilla-industrial", works, { Motor: "Eléctrico" }), "Motorización / Energía"), null);
  assert.equal(value(source("dumper", material, { Motor: "Eléctrico" }), "Motorización / Energía"), null);
  assert.equal(value({ ...lift, specs: { Motor: "Eléctrico", "Motorización / Energía": "Diésel" } }, "Motorización / Energía"), null);
});

test("Gomariz: potencia total de focos normalizada desde W, sin aplicarla a generadores", () => {
  const tower = source("torre-de-luz", energy, { Potencia: "4 x 120W" });
  assert.equal(value(tower, "Potencia"), 0.48);
  assert.equal(value(tower, "Nº y tipo de focos"), "4 focos (tipo no publicado)");
  const second = source("torre-de-luz", energy, { Potencia: "4x400 W" });
  assert.equal(value(second, "Potencia"), 1.6);
  assert.equal(value(source("torre-de-luz", energy, { Potencia: "4 × 120 W" }), "Potencia"), 0.48);
  assert.equal(value(source("torre-de-luz", energy, { Potencia: "4x120W / 4x200W" }), "Potencia"), null);
  assert.equal(value(source("torre-de-luz", energy, { Potencia: "4x120 kW" }), "Potencia"), null);
  assert.equal(value(source("torre-de-luz", energy, { Potencia: "60 kVA" }), "Potencia"), null);
  assert.equal(value(source("generador", energy, { Potencia: "4 x 120W" }), "Potencia"), null);
  assert.equal(value(source("torre-de-luz", material, { Potencia: "4 x 120W" }), "Potencia"), null);
  assert.equal(value({ ...tower, providerId: "gam" }, "Potencia"), null);
  assert.equal(value({ ...tower, specs: { Potencia: "4x120W", "Nº y tipo de focos": "4 focos LED" } }, "Nº y tipo de focos"), "4 focos LED");
  assert.equal(value({ ...tower, specs: { Potencia: "4x120W", "Potencia (kW)": "0.5 kW" } }, "Potencia"), null);
});

test("Gomariz: solo recupera modelo técnico explícito del título de torres", () => {
  const tower = source("torre-de-luz", energy, {}, "GENERAC VT-HYBRID");
  assert.equal(value({ ...tower, brand: "Generac" }, "Modelo"), "VT-HYBRID");
  assert.equal(value({ ...tower, brand: "Generac", model: "VB9" }, "Modelo"), "VB9");
  assert.equal(value({ ...tower, brand: "Generac", title: "GENERAC TORRE DE LUZ" }, "Modelo"), null);
  assert.equal(value({ ...tower, brand: "Otro fabricante" }, "Modelo"), null);
  assert.equal(value({ ...tower, brand: "Generac", title: "GENERAC VB9 torre de luz" }, "Modelo"), null);
  assert.equal(value({ ...tower, brand: "Generac", specs: { Modelo: "VB9" } }, "Modelo"), null);
  assert.equal(value({ ...tower, providerId: "gam", brand: "Generac" }, "Modelo"), null);
  assert.equal(value({ ...tower, url: tower.url.replace("torre-de-luz", "generador"), brand: "Generac" }, "Modelo"), null);
});

test("Gomariz: preparación comercial sin rellenos ni reclasificaciones", () => {
  const tower = source("torre-de-luz", energy, { Potencia: "4 x 120W", Motor: "Diésel" });
  const lift = source("carretilla-industrial", material, { Motor: "Eléctrico", Capacidad: "2500 kg" });
  const towerResult = prepareProduct(tower, catalog);
  const liftResult = prepareProduct(lift, catalog);
  assert.equal(towerResult.status, "ready");
  assert.equal(liftResult.status, "ready");
  assert.ok(towerResult.importIssues?.excel.includes("Precio ausente o inválido"));
  assert.ok(liftResult.importIssues?.createMany.some((issue) => issue.startsWith("Descripción ")));
  assert.equal(towerResult.product.price, null);
  assert.equal(towerResult.product.condition, "Segunda_Mano");
  assert.equal(liftResult.product.condition, "Segunda_Mano");
  assert.equal(towerResult.product.description, null);
  assert.equal(liftResult.product.attributes.find((entry) => entry.attributeID === 119)?.value, "Eléctrico");
  assert.equal(towerResult.product.attributes.find((entry) => entry.attributeID === 70)?.value, 0.48);
  const classifiedLift = prepareProduct({ ...lift, condition: "Segunda mano" }, catalog);
  const classifiedTower = prepareProduct({ ...tower, condition: "Segunda mano" }, catalog);
  assert.equal(classifiedLift.product.attributes.find((entry) => entry.attributeID === 119)?.value, "Eléctrico");
  assert.equal(classifiedTower.product.attributes.find((entry) => entry.attributeID === 70)?.value, 0.48);
  assert.equal(classifiedTower.product.attributes.find((entry) => entry.attributeID === 86)?.value, "4 focos (tipo no publicado)");
});
