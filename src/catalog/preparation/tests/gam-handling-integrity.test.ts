import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";

const catalog = await loadImportCatalog();
const attribute = (name: string) => {
  const found = catalog.attributes.find((item) => item.name === name);
  assert.ok(found, name);
  return found;
};
const value = (record: ProductRecord, name: string): string | number | boolean | null =>
  resolveAttributeValue(record, attribute(name));

const machine = (overrides: Partial<ProductRecord> = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "manutencion", categoryName: "Manutención",
  url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6702-hyster-h35ft",
  title: "Carretilla elevadora GLP 3500Kg Hyster H3.5FT",
  shortDescription: "HYSTER H3.5FT Segunda Mano. Capacidad de carga de 3500 kg",
  longDescription: "La Hyster H3.5FT dispone de una altura de elevación de 3,6 metros y una capacidad de carga de 3500 kg.",
  reference: "6702", condition: "Segunda mano", price: "10000", brand: "HYSTER", model: "H3.5FT",
  year: null, location: null, country: null, horometer: null, serialNumber: null, image: null,
  specs: { "Altura de elevación (mm)": "3600 mm", "Capacidad de carga (kg)": "3500 KG" },
  ...overrides
});

test("GAM manutención: bloquea altura estructurada discordante de su descripción individual", () => {
  assert.equal(value(machine(), "Altura de elevación"), 3600);
  assert.equal(value(machine({ longDescription: "La Hyster H3.5FT tiene una altura de elevación de 4,6 metros." }), "Altura de elevación"), null);
  assert.equal(value(machine({ longDescription: "La Hyster H3.5FT tiene una altura de elevación de 3,62 metros." }), "Altura de elevación"), null);
  assert.equal(value(machine({ longDescription: "La Hyster H3.5FT tiene una altura de elevación de 3,6 m." }), "Altura de elevación"), 3600);
  assert.equal(value(machine({
    specs: { "Altura de elevación (mm)": "3110 mm" },
    longDescription: "La Hyster H3.5FT ofrece altura de elevación de 3,1 metros."
  }), "Altura de elevación"), 3110);
});

test("GAM manutención: no confunde velocidades, máximos configurables ni otros modelos con cotas instaladas", () => {
  for (const description of [
    "La Hyster H3.5FT admite alturas de elevación de hasta 6.000 mm según configuración.",
    "La Hyster H3.5FT alcanza hasta una altura de elevación de 5,5 metros según mástil elegido.",
    "La Hyster H3.5FT permite elevación de hasta 0,8 metros por segundo.",
    "La Hyster H4.5FT ofrece una altura de elevación de 4,6 metros."
  ]) assert.equal(value(machine({ longDescription: description }), "Altura de elevación"), 3600);
});

test("GAM manutención: la capacidad de carga requiere corroboración para bloquear una ficha técnica", () => {
  const contradictory = machine({
    title: "Carretilla elevadora GLP 2000Kg Hyster H3.5FT",
    shortDescription: "HYSTER H3.5FT: capacidad de carga de 2000 kg",
    longDescription: "La Hyster H3.5FT tiene una capacidad de carga de 2000 kg."
  });
  assert.equal(value(contradictory, "Capacidad de carga"), null);
  assert.equal(value(machine({ title: contradictory.title }), "Capacidad de carga"), 3500);
  assert.equal(value(machine({ longDescription: contradictory.longDescription }), "Capacidad de carga"), 3500);
  assert.equal(value(machine({ title: contradictory.title, shortDescription: contradictory.shortDescription }), "Capacidad de carga"), null);
  assert.equal(value(machine({
    title: "Carretilla elevadora GLP 1600Kg Hyster H1.8FT", model: "H1.8FT",
    shortDescription: "La Hyster H1.8FT tiene capacidad de carga de 1800 kg",
    longDescription: "La Hyster H1.8FT tiene capacidad de carga de 1800 kg.",
    specs: { "Capacidad de carga (kg)": "1800 KG" }
  }), "Capacidad de carga"), 1800);
});

test("GAM manutención: reconoce toneladas exactas y evita convertir varias configuraciones en una capacidad", () => {
  assert.equal(value(machine({
    title: "Carretilla elevadora GLP 2000Kg Hyster H3.5FT",
    shortDescription: "Hyster H3.5FT: capacidad de carga de 2 toneladas",
    longDescription: "Hyster H3.5FT: capacidad de carga de 2.000 kg"
  }), "Capacidad de carga"), null);
  assert.equal(value(machine({
    specs: { "Capacidad de carga (kg)": "2000/3500 KG" },
    longDescription: "Hyster H3.5FT: capacidad de carga de 2000 kg"
  }), "Capacidad de carga"), null);
});

test("GAM manutención: no adjudica alturas ni mástiles desde la ficha de otra variante", () => {
  const withoutHeights = machine({ specs: {}, shortDescription: "Hyster H3.5FT de segunda mano" });
  assert.equal(value({ ...withoutHeights, longDescription: "La Hyster H3.5FTX monta mástil tríplex y eleva 5 metros." }, "Tipo de mástil"), null);
  assert.equal(value({ ...withoutHeights, longDescription: "La Hyster H3.5FTX tiene una altura de elevación de 5000 mm." }, "Altura de elevación"), null);
  assert.equal(value({ ...withoutHeights, longDescription: "La Hyster H3.5FTX dispone de capacidad de carga de 1800 kg." }, "Capacidad de carga"), null);
  assert.equal(value({ ...withoutHeights, longDescription: "La Hyster H3.5FT monta un mástil tríplex." }, "Tipo de mástil"), "Tríplex");
  assert.equal(value({ ...withoutHeights, longDescription: "La Hyster H3.5FT incorpora un mástil de 3 etapas." }, "Tipo de mástil"), "Tríplex");
  assert.equal(value({ ...withoutHeights, longDescription: "La Hyster H3.5FT incorpora un mástil de 2 etapas." }, "Tipo de mástil"), "Dúplex");
  assert.equal(value({ ...withoutHeights, longDescription: "La Hyster H3.5FT puede configurarse con mástiles de 2 o 3 etapas." }, "Tipo de mástil"), null);
});

test("GAM manutención: conserva mástil acreditado y bloquea contradicciones de configuración concreta", () => {
  const withMast = machine({ specs: { "Tipo Mástil": "TRIPLEX" } });
  assert.equal(value(withMast, "Tipo de mástil"), "Tríplex");
  assert.equal(value({ ...withMast, longDescription: "La Hyster H3.5FT monta un mástil dúplex." }, "Tipo de mástil"), null);
  assert.equal(value({ ...withMast, longDescription: "La Hyster H3.5FT ofrece distintas opciones de mástil dúplex y tríplex." }, "Tipo de mástil"), "Tríplex");
});

test("GAM manutención: las protecciones no afectan a proveedores, categorías ni dominios ajenos", () => {
  const conflict = machine({ longDescription: "La Hyster H3.5FT tiene una altura de elevación de 4,6 metros." });
  for (const record of [
    { ...conflict, providerId: "gomariz" },
    { ...conflict, categoryKey: "limpieza-fregadoras" },
    { ...conflict, url: "https://example.com/es/carretillas-elevadoras-glp-segunda-mano/6702" }
  ]) assert.equal(value(record, "Altura de elevación"), 3600);
});

test("GAM manutención: contrasta alturas máximas declaradas sin confundir configuraciones optativas", () => {
  assert.equal(value(machine({
    longDescription: "La Hyster H3.5FT presenta una altura máxima de elevación de 4,6 metros."
  }), "Altura de elevación"), null);
  assert.equal(value(machine({
    longDescription: "La Hyster H3.5FT ofrece una altura máxima de elevación de hasta 4,6 metros según configuración."
  }), "Altura de elevación"), 3600);
  assert.equal(value(machine({
    longDescription: "La Hyster H3.5FT puede equipar una altura de elevación de 4,6 m o 3,6 m."
  }), "Altura de elevación"), 3600);
});

test("GAM manutención: las capacidades máximas opcionales no invalidan una carga nominal estructurada", () => {
  const product = machine({
    title: "Carretilla elevadora GLP 1800Kg Hyster H3.5FT",
    specs: { "Capacidad de carga (kg)": "1800 KG" },
    shortDescription: "Hyster H3.5FT: capacidad de carga de 1800 kg"
  });
  assert.equal(value({ ...product, longDescription: "La Hyster H3.5FT tiene capacidad de carga de hasta 2000 kg." }, "Capacidad de carga"), 1800);
  assert.equal(value({ ...product, longDescription: "La Hyster H3.5FT tiene capacidad de carga de 2000 kg." }, "Capacidad de carga"), 1800);
});

test("GAM manutención: los mástiles de etapas instaladas contradicen tipos estructurados incompatibles", () => {
  const product = machine({ specs: { "Tipo Mástil": "TRIPLEX" } });
  assert.equal(value({ ...product, longDescription: "La Hyster H3.5FT monta un mástil de 2 etapas." }, "Tipo de mástil"), null);
  assert.equal(value({ ...product, longDescription: "La Hyster H3.5FT incorpora un mástil de 3 etapas." }, "Tipo de mástil"), "Tríplex");
  assert.equal(value({ ...product, longDescription: "La Hyster H3.5FT monta un mástil de 2 etapas según las opciones disponibles." }, "Tipo de mástil"), "Tríplex");
});


test("GAM manutención: mantiene en revisión una carga estructurada contradicha por fuentes distintas", () => {
  const product = machine({
    title: "Carretilla elevadora GLP Hyster H3.5FT",
    specs: { "Capacidad de carga (kg)": "4000 KG" },
    shortDescription: "Hyster H3.5FT con capacidad de carga de 4500 kg",
    longDescription: "Hyster H3.5FT con capacidad de carga de hasta 4500 kg"
  });
  assert.equal(value(product, "Capacidad de carga"), null);
});
