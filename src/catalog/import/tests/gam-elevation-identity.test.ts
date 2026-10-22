import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const workingHeight = catalog.attributes.find((attribute) => attribute.name === "Altura de trabajo");
assert.ok(workingHeight);
const height = (record: ProductRecord): string | number | boolean | null => {
  assert.ok(workingHeight);
  return resolveAttributeValue(record, workingHeight);
};

const machine = (overrides: Partial<ProductRecord> = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "elevacion-nueva", categoryName: "Elevación nueva",
  url: "https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/4730-xcmg",
  title: "Plataforma elevadora de tijera eléctrica orugas 6M XCMG XG0608C",
  shortDescription: "XCMG XG0608C Nueva. Plataforma de tijera eléctrica",
  longDescription: "La plataforma XCMG XG0608C permite trabajar a una altura máxima de 8 metros.",
  price: null, reference: "4730", condition: "Nuevo", brand: "XCMG", model: "XG0608C",
  year: null, location: null, country: null, horometer: null, serialNumber: null,
  image: "https://online.gamrentals.com/4730.jpg", specs: {}, ...overrides
});

test("GAM: recupera trabajar a una altura máxima solo con identidad coherente", () => {
  const record = machine();
  assert.equal(height(record), 8);
  const prepared = prepareProduct(record, catalog);
  assert.ok(workingHeight);
  assert.ok(prepared.product.attributes.some((attribute) => attribute.attributeID === workingHeight.id && attribute.value === 8));
  assert.ok(!prepared.issues.includes("Atributo obligatorio ausente: Altura de trabajo"));
  assert.equal(height(machine({ longDescription: "La XCMG XG0608C tiene altura de plataforma de 6 metros." })), null);
  assert.equal(height(machine({ longDescription: "La XCMG XG0608C permite trabajar a una altura máxima de 8 metros o 10 metros." })), null);
  assert.equal(height(machine({ longDescription: "La XCMG XG0608C permite trabajar a una altura máxima de 8 metros, pero otra opción alcanza 10 metros de altura máxima de trabajo." })), null);
});

test("GAM: un modelo técnico incompatible con título o descripción no presta sus alturas", () => {
  for (const record of [
    machine({ model: "XG1823RT", title: "Plataforma elevadora tijera 18M XCMG XG1823RT", shortDescription: "XCMG XG1523RT Nueva" }),
    machine({ model: "XG1523ERT", title: "Plataforma elevadora tijera 15M XCMG XG1523RT", shortDescription: "XCMG XG1523RT Nueva" }),
    machine({ model: "XG0608C", title: "Plataforma elevadora tijera XCMG XG0607DC", shortDescription: "XCMG XG0608C Nueva" })
  ]) {
    assert.equal(height(record), null);
    assert.ok(workingHeight);
    assert.ok(!prepareProduct(record, catalog).product.attributes.some((attribute) => attribute.attributeID === workingHeight.id));
  }
});

test("GAM: sufijos de batería, títulos abreviados y modelos completos compatibles siguen admitidos", () => {
  assert.equal(height(machine({
    model: "XG0608C-LI", title: "Plataforma XCMG XG0608C con batería de litio",
    shortDescription: "XCMG XG0608C-LI Nueva"
  })), 8);
  assert.equal(height(machine({
    model: "XGS58E1", title: "Plataforma telescópica XCMG XGS58E",
    shortDescription: "XCMG XGS58E1 Nueva", longDescription: "XCMG XGS58E1 permite trabajar a una altura máxima de 58 metros."
  })), 58);
  assert.equal(height(machine({ providerId: "gomariz" })), null);
  assert.equal(height(machine({ url: "https://example.com/es/plataformas-de-tijera-electricas-xcmg/4730-xcmg" })), null);
});


test("GAM: distingue alturas de otros parámetros y rechaza medidas de trabajo incompatibles", () => {
  assert.equal(height(machine({
    shortDescription: "XCMG XG0608C Nueva. Plataforma de 6 metros de altura",
    longDescription: "La XCMG XG0608C permite trabajar a una altura máxima de 8 metros, con una altura de plataforma de 6 metros."
  })), 8);
  assert.equal(height(machine({
    longDescription: "La XCMG XG0608C ofrece 8 m de altura de trabajo, 6 m de altura de plataforma y 4 m de alcance horizontal."
  })), 8);
  assert.equal(height(machine({
    shortDescription: "XCMG XG0608C Nueva. Plataforma de 12 metros de altura",
    longDescription: "La XCMG XG0608C alcanza una altura de trabajo de hasta 12 metros y permite trabajar a una altura máxima de 8 metros."
  })), null);
  assert.equal(height(machine({
    longDescription: "La XCMG XG0608C alcanza una altura de trabajo de 8 metros o 10 metros."
  })), null);
});
