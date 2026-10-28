import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";

const catalog = await loadImportCatalog();
const workingHeight = catalog.attributes.find((attribute) => attribute.name === "Altura de trabajo");
const platformHeight = catalog.attributes.find((attribute) => attribute.name === "Altura de plataforma");
assert.ok(workingHeight);
assert.ok(platformHeight);

const gamRecord = (specs: SpecsMap): ProductRecord => ({
  providerId: "gam",
  categoryKey: "elevacion",
  categoryName: "Elevación",
  url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/5845-2015-jlg-10rs",
  title: "Plataforma tijera eléctrica 12M JLG 10RS",
  shortDescription: "Ficha técnica JLG 10RS",
  longDescription: "Información técnica JLG 10RS",
  price: null,
  reference: "5845",
  brand: "JLG",
  model: "10RS",
  year: "2015",
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  condition: "Segunda mano",
  image: null,
  specs
});

test("normalización conserva las unidades de origen de alturas expresadas en metros", () => {
  const result = normalizeSpecsObject({
    "altura de trabajo (m)": "14,4 metros",
    "altura plataforma (m)": "12,4 metros"
  });
  assert.equal(result.normalized["Altura de trabajo (m)"], 14.4);
  assert.equal(result.normalized["Altura plataforma (m)"], 12.4);
  assert.equal(result.normalized["Altura plataforma (mm)"], undefined);
  assert.deepEqual(result.unknownKeys, []);
});

test("los números normalizados conservan la conversión de mm a m", () => {
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (mm)": 12000 }), workingHeight), 12);
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (m)": 12 }), workingHeight), 12);
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (m)": "12 metros" }), workingHeight), 12);
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (mm)": "12000 mm" }), workingHeight), 12);
});

test("rechaza unidades explícitas incompatibles y alturas contradictorias", () => {
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (mm)": "12 m" }), workingHeight), null);
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (m)": "12000 mm" }), workingHeight), null);
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (mm)": -12000 }), workingHeight), null);
  assert.equal(resolveAttributeValue(gamRecord({
    "Altura de trabajo (mm)": 12000,
    "Altura de trabajo (m)": "12 metros"
  }), workingHeight), 12);
  assert.equal(resolveAttributeValue(gamRecord({
    "Altura de trabajo (mm)": 12000,
    "Altura de trabajo (m)": "13 metros"
  }), workingHeight), null);
});

test("convierte alturas de plataforma sin mezclar mm con m", () => {
  assert.equal(resolveAttributeValue(gamRecord({ "Altura plataforma (mm)": 10000 }), platformHeight), 10);
  assert.equal(resolveAttributeValue(gamRecord({ "Altura plataforma (m)": "10 metros" }), platformHeight), 10);
});

test("la conversión de medidas normalizadas es consistente entre proveedores", () => {
  const gomariz: ProductRecord = {
    ...gamRecord({ "Altura de trabajo (mm)": 6300 }),
    providerId: "gomariz",
    categoryKey: "venta",
    url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-ss0507etijera-electrica-electric-scissor/",
    reference: "TE1858"
  };
  const mercaeleva: ProductRecord = {
    ...gamRecord({ "Altura de trabajo (mm)": 6300 }),
    providerId: "mercaeleva",
    categoryKey: "venta",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/BT-LPE200-8-M239-6301",
    reference: "M239-6301"
  };
  assert.equal(resolveAttributeValue(gomariz, workingHeight), 6.3);
  assert.equal(resolveAttributeValue(mercaeleva, workingHeight), 6.3);
});
