import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const attribute = (name: string) => {
  const value = catalog.attributes.find((item) => item.name === name);
  assert.ok(value, name);
  return value;
};
const valueOf = (record: ProductRecord, name: string): string | number | boolean | null =>
  resolveAttributeValue(record, attribute(name));
const item = (changes: Partial<ProductRecord> = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "otros-nuevos", categoryName: "Otros equipos",
  url: "https://online.gamrentals.com/es/xcmg-manipulacion/4813-xcmg",
  title: "Manipulador telescópico XCMG XT2506KH", shortDescription: "Ficha XCMG XT2506KH",
  longDescription: "El XCMG XT2506KH dispone de capacidad nominal de 2500 kg y altura máxima de elevación de 6 metros.",
  price: null, reference: "4813", condition: "Nuevo", brand: "XCMG", model: "XT2506KH",
  year: null, location: null, country: null, horometer: null, serialNumber: null, image: null,
  specs: { "Capacidad de carga (kg)": "2500 KG", "Altura de elevación (m)": "6 metros" },
  ...changes
});

test("GAM especializadas: recupera capacidad y altura inequívocas de manipuladores XCMG", () => {
  const machine = item();
  assert.equal(valueOf(machine, "Capacidad máxima"), 2500);
  assert.equal(valueOf(machine, "Altura máxima de elevación"), 6);
  const prepared = prepareProduct(machine, catalog);
  assert.equal(prepared.product.categorySellID, 86);
  assert.ok(prepared.product.attributes.some((attr) => attr.attributeID === 38 && attr.value === 2500));
  assert.ok(prepared.product.attributes.some((attr) => attr.attributeID === 39 && attr.value === 6));
});

test("GAM especializadas: alturas contradictorias y capacidades múltiples permanecen pendientes", () => {
  assert.equal(valueOf(item({
    longDescription: "El XCMG XT2506KH tiene una altura máxima de elevación de 5,8 metros.",
  }), "Altura máxima de elevación"), null);
  assert.equal(valueOf(item({
    longDescription: "El XCMG XT2506KH tiene una altura máxima de elevación de 6 metros o 5 metros.",
  }), "Altura máxima de elevación"), null);
  assert.equal(valueOf(item({
    longDescription: "El XCMG XT2506KH tiene capacidad nominal de 3000 kg.",
  }), "Capacidad máxima"), null);
  assert.equal(valueOf(item({
    longDescription: "El XCMG XT2506KH tiene capacidad máxima de 2500 kg y capacidad nominal de 2700 kg.",
  }), "Capacidad máxima"), null);
  assert.equal(valueOf(item({
    specs: { "Capacidad de carga (kg)": "2500 / 3200 KG", "Altura de elevación (m)": "6 / 7 metros" }
  }), "Capacidad máxima"), null);
  assert.equal(valueOf(item({
    specs: { "Capacidad de carga (kg)": "2500 KG", "Altura de elevación (m)": "6 / 7 metros" }
  }), "Altura máxima de elevación"), null);
});

test("GAM especializadas: limita recuperaciones al equipo correcto y al origen válido", () => {
  for (const record of [
    item({ providerId: "gomariz" }),
    item({ url: "https://example.com/es/xcmg-manipulacion/4813-xcmg" }),
    item({ url: "https://online.gamrentals.com/es/volteadores-logitrans/4813-xcmg" }),
    item({ title: "Manipulador telescópico XCMG XT3207KH" }),
    item({ categoryKey: "elevacion-nueva" })
  ]) {
    assert.equal(valueOf(record, "Capacidad máxima"), null);
    assert.equal(valueOf(record, "Altura máxima de elevación"), null);
  }
});

test("GAM especializadas: tractores eléctricos solo desde motorización expresa", () => {
  const tractor = item({
    categoryKey: "otros-nuevos", title: "Tractor eléctrico de arrastre Tecnacar VTA 103",
    url: "https://online.gamrentals.com/es/tractores-electricos-de-arrastre-tecnacar/278-tecnacar",
    specs: { "Motorización": "Eléctrico" }
  });
  assert.equal(valueOf(tractor, "Motorización / Energía"), "Eléctrico");
  assert.equal(valueOf({ ...tractor, specs: {} }, "Motorización / Energía"), null);
  assert.equal(valueOf({ ...tractor, specs: { "Motorización": "Diésel" } }, "Motorización / Energía"), null);
  assert.equal(valueOf({ ...tractor, title: "Tractor de arrastre Tecnacar VTA 103" }, "Motorización / Energía"), null);
  assert.equal(valueOf({ ...tractor, url: "https://online.gamrentals.com/es/grupos-electrogenos-nuevos/278" }, "Motorización / Energía"), null);
  assert.equal(valueOf({ ...tractor, providerId: "mercaeleva" }, "Motorización / Energía"), null);
});

test("GAM especializadas: volteadores y elevadores usan hojas diferentes sin alterar el usado", () => {
  const generic = item({
    categoryKey: "otros-nuevos", title: "Volteador multifunción Logitrans ELFR", model: "ELFR",
    url: "https://online.gamrentals.com/es/volteadores-logitrans/213-logitrans",
    specs: { "Capacidad de carga (kg)": "1000 KG", "Modelo": "ELFR", "Marca": "LOGITRANS" }
  });
  const reel = { ...generic, title: "Elevador de bobinas Logitrans RL 500", model: "RL 500" };
  const drum = { ...generic, title: "Volteador de bidones Logitrans MDT", model: "MDT" };
  assert.equal(prepareProduct(generic, catalog).product.categorySellID, 105);
  assert.equal(prepareProduct(reel, catalog).product.categorySellID, 106);
  assert.equal(prepareProduct(drum, catalog).product.categorySellID, 109);
  assert.equal(prepareProduct({ ...generic, title: "Transportador Logitrans" }, catalog).product.categorySellID, null);
  assert.equal(prepareProduct({ ...generic, providerId: "gomariz" }, catalog).product.categorySellID, null);
  assert.equal(prepareProduct({ ...generic, condition: "Segunda mano" }, catalog).product.categorySellID, null);
});

test("GAM especializadas: potencia de motor o kVA alternativos no se convierten en potencia de grupo", () => {
  const generator = item({
    categoryKey: "energia", title: "Grupo electrógeno PRAMAC GSW110V 110 kVA",
    url: "https://online.gamrentals.com/es/generadores-electricos-segunda-mano/6834-devol",
    longDescription: "Potencia motor 97 / 87 kW. Potencia de grupo 110 kVA.",
    specs: { "Potencia Motor (KW)": "97.34 / 87.05" }
  });
  assert.equal(valueOf(generator, "Potencia"), null);
});
