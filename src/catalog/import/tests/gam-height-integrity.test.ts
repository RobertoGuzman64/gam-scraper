import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const attr = (name: string) => {
  const result = catalog.attributes.find((entry) => entry.name === name);
  assert.ok(result, name);
  return result;
};
const value = (record: ProductRecord, name: string): string | number | boolean | null =>
  resolveAttributeValue(record, attr(name));

const scissor = (overrides: Partial<ProductRecord> = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "elevacion-nueva", categoryName: "Elevación nueva",
  url: "https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/4743-xcmg",
  title: "Plataforma elevadora de tijera eléctrica 12M XCMG XG1212AC con batería de litio",
  shortDescription: "XCMG XG1212AC-LI Nueva. Venta de plataforma de tijera de 12 metros de altura",
  longDescription: "La plataforma XCMG XG1212AC tiene batería de litio. ¿Cuál es la altura máxima de trabajo? Hasta 12 metros.",
  price: null, reference: "4743", condition: "Nuevo", brand: "XCMG", model: "XG1212AC-LI",
  year: null, location: null, country: null, horometer: null, serialNumber: null,
  image: "https://online.gamrentals.com/4743.jpg", specs: { "Altura de elevación (m)": "12 metros" },
  ...overrides
});

test("GAM: recupera altura máxima de trabajo en pregunta-respuesta con modelo corroborado", () => {
  const record = scissor();
  assert.equal(value(record, "Altura de trabajo"), 12);
  const prepared = prepareProduct(record, catalog);
  assert.ok(prepared.product.attributes.some((item) => item.attributeID === 1 && item.value === 12));
  assert.ok(!prepared.issues.includes("Atributo obligatorio ausente: Altura de trabajo"));
  assert.equal(value(scissor({ longDescription: "XCMG XG1212AC: altura de trabajo de 12 metros. ¿Cuál es la altura máxima de trabajo? Hasta 14 metros." }), "Altura de trabajo"), null);
});

test("GAM: no asigna alturas de otra variante ni de una ficha sin identidad comprobable", () => {
  const sample = scissor();
  for (const record of [
    scissor({ model: "XG1012AC-LI" }),
    scissor({ shortDescription: "XCMG XG1012AC-LI Nueva" }),
    scissor({ title: "Plataforma elevadora XCMG XG1012AC con batería de litio" }),
    scissor({ longDescription: "La plataforma XCMG XG1012AC. ¿Cuál es la altura máxima de trabajo? Hasta 12 metros." }),
    scissor({ providerId: "gomariz" }),
    scissor({ categoryKey: "manutencion" }),
    scissor({ longDescription: "Plataforma de 12 metros de altura XCMG XG1212AC" }),
    scissor({ longDescription: "La XCMG XG1212AC dispone de una altura de elevación de 12 metros" })
  ]) assert.equal(value(record, "Altura de trabajo"), null);
  assert.equal(value(sample, "Altura de elevación"), 12000);
});

test("GAM: si descripción y especificación discrepan en altura de elevación, se bloquea", () => {
  const conflict = scissor({
    categoryKey: "elevacion", reference: "6236",
    title: "Plataforma tijera eléctrica 8M SNORKEL S3219E",
    model: "S4732E", brand: "SNORKEL",
    shortDescription: "SNORKEL S3219E de segunda mano, 8 metros de altura",
    longDescription: "Plataforma SNORKEL S3219E con altura de elevación de 8 metros",
    specs: { "Altura de elevación (m)": "12 metros" }
  });
  assert.equal(value(conflict, "Altura de elevación"), null);
  const prepared = prepareProduct(conflict, catalog);
  assert.ok(!prepared.product.attributes.some((item) => item.attributeID === 15));
  assert.equal(value(scissor({ longDescription: "La XCMG XG1212AC tiene altura de elevación de 12 metros." }), "Altura de elevación"), 12000);
  assert.equal(value(scissor({ longDescription: "La XCMG XG1212AC tiene altura de elevación de 11,5 metros." }), "Altura de elevación"), null);
  assert.equal(value(scissor({ longDescription: "La XCMG XG1212AC trabaja a 12 metros de altura." }), "Altura de elevación"), 12000);
});

test("GAM: no sustituye altura de trabajo por altura de elevación, título o altura de plataforma", () => {
  assert.equal(value(scissor({ longDescription: "La XCMG XG1212AC eleva 12 metros." }), "Altura de trabajo"), null);
  assert.equal(value(scissor({ longDescription: "La XCMG XG1212AC tiene una altura de plataforma de 10 metros." }), "Altura de trabajo"), null);
  assert.equal(value(scissor({ longDescription: "La XCMG XG1212AC tiene una altura de plataforma de 10 metros." }), "Altura de plataforma"), 10);
});

test("GAM: recupera alcance horizontal máximo, inverso y con hasta, sin reutilizar el lateral", () => {
  const example = scissor({ longDescription: "La plataforma XCMG XG1212AC tiene un alcance horizontal máximo: 24,6 m." });
  assert.equal(value(example, "Alcance horizontal"), 24.6);
  assert.equal(value(scissor({ longDescription: "XCMG XG1212AC con un alcance horizontal de hasta 14 m." }), "Alcance horizontal"), 14);
  assert.equal(value(scissor({ longDescription: "XCMG XG1212AC con 14 metros de alcance horizontal." }), "Alcance horizontal"), 14);
  assert.equal(value(scissor({ longDescription: "XCMG XG1212AC con un alcance lateral de hasta 14 m." }), "Alcance horizontal"), null);
  assert.equal(value(scissor({ longDescription: "XCMG XG1212AC con un alcance horizontal de 12 m o 14 m." }), "Alcance horizontal"), null);
});

test("GAM: recupera altura de plataforma inversa sin convertirla en altura de trabajo", () => {
  const record = scissor({ longDescription: "La XCMG XG1212AC incorpora 41,2 m de altura de plataforma." });
  assert.equal(value(record, "Altura de plataforma"), 41.2);
  assert.equal(value(record, "Altura de trabajo"), null);
  assert.equal(value(scissor({ longDescription: "XCMG XG1212AC tiene altura de la plataforma de 10,5 m." }), "Altura de plataforma"), 10.5);
  assert.equal(value(scissor({ longDescription: "XCMG XG1212AC tiene 6 m de altura de plataforma o 8 m." }), "Altura de plataforma"), null);
});
