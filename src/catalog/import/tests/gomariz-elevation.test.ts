import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { resolveCategory } from "../mapping/category-mapping.js";
import { prepareProduct } from "../preparation/prepare.js";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";

const catalog = await loadImportCatalog();
const url = (family: string, id = "lgmg-ss0507e"): string =>
  `https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/${family}/${id}/`;
const record = (family: string, specs: SpecsMap = {}, title = "LGMG SS0507E", longDescription: string | null = null): ProductRecord => ({
  providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria de ocasión", url: url(family),
  title, shortDescription: null, longDescription, price: null, reference: "TEST", brand: "LGMG", model: "SS0507E",
  year: "2022", location: null, country: null, horometer: null, serialNumber: null, image: null, specs
});
const value = (source: ProductRecord, name: string): string | number | boolean | null => {
  const attribute = catalog.attributes.find((entry) => entry.name === name);
  assert.ok(attribute);
  return resolveAttributeValue(source, attribute);
};

test("Gomariz: recupera motorización eléctrica publicada en plataformas, sin deducir por modelo o familia", () => {
  for (const family of ["elevador-tijera", "brazo-articulado", "brazo-articulado-boom-lift", "brazo-telescopico", "oruga", "elevador-mastil-vertical"]) {
    const source = record(family, { Motor: "Eléctrico" });
    assert.equal(value(source, "Motorización / Energía"), "Eléctrico", family);
    assert.equal(value(record(family), "Motorización / Energía"), null, family);
    assert.equal(value(record(family, { Motor: "Diésel" }), "Motorización / Energía"), null, family);
  }
  assert.equal(value(record("elevador-tijera", { Motor: "Eléctrico, Gasolina" }), "Motorización / Energía"), null);
  assert.equal(value(record("elevador-tijera", { Motor: "Eléctrico", "Tipo motor": "Diésel" }), "Motorización / Energía"), null);
  assert.equal(value(record("elevador-tijera", { Motor: "Eléctrico" }, "Plataforma diésel"), "Motorización / Energía"), null);
  assert.equal(value(record("camion-plataforma", { Motor: "Eléctrico" }), "Motorización / Energía"), null);
  assert.equal(value(record("elevador-tijera", { Motor: "Eléctrico", "Motorización / Energía": "Diésel" }), "Motorización / Energía"), null);
  assert.equal(value(record("elevador-tijera", { Motor: "Eléctrico", "Motorización / Energía": "Eléctrico" }), "Motorización / Energía"), "Eléctrico");
});

test("Gomariz: solo registra orugas y camión con categoría y texto de origen congruentes", () => {
  const tracked = record("oruga", { Motor: "Eléctrico, Gasolina", "Altura de trabajo": "15 m" }, "SOCAGE 15S",
    "La Oruga Socage 15S es una plataforma elevadora ideal para terrenos difíciles gracias a sus orugas.");
  const truck = record("camion-plataforma", { "Altura de trabajo": "20 m" }, "SOCAGE IVECO 35S14",
    "Los Camiones Cesta son plataformas montadas sobre camión.");
  assert.equal(value(tracked, "Tipo de tracción"), "Orugas");
  assert.equal(value(truck, "Tipo de tracción"), "Sobre camión");
  assert.equal(value(record("oruga", {}, "SOCAGE 15S"), "Tipo de tracción"), null);
  assert.equal(value(record("oruga", {}, "SOCAGE 15S", "Sistema de orugas y ruedas"), "Tipo de tracción"), null);
  assert.equal(value(record("camion-plataforma", {}, "SOCAGE 35S14", "Los Camiones Cesta"), "Tipo de tracción"), null);
  assert.equal(value(record("camion-plataforma", {}, "SOCAGE IVECO", "Plataforma de acceso"), "Tipo de tracción"), null);
  assert.equal(value(record("elevador-tijera", {}, "LGMG", "Plataforma sobre camión con orugas"), "Tipo de tracción"), null);
  assert.equal(value(tracked, "Motorización / Energía"), null);
  const candidate = prepareProduct(tracked, catalog).product;
  assert.equal(candidate.attributes.find((entry) => entry.attributeID === 9)?.value, "Orugas");
  assert.equal(prepareProduct(truck, catalog).product.attributes.find((entry) => entry.attributeID === 9)?.value, "Sobre camión");
});

test("Gomariz: no afecta a otros proveedores, ramas, hosts ni categorías sin destino seguro", () => {
  const source = record("elevador-tijera", { Motor: "Eléctrico" });
  assert.equal(value({ ...source, providerId: "gam" }, "Motorización / Energía"), null);
  assert.equal(value({ ...source, providerId: "mercaeleva" }, "Motorización / Energía"), null);
  assert.equal(value({ ...source, url: "https://otro.example/venta/elevacion-y-trabajos-en-altura/elevador-tijera/prueba/" }, "Motorización / Energía"), null);
  assert.equal(value({ ...source, url: "https://www.gomarizrent.com/venta/manipulacion-de-materiales/elevador-tijera/prueba/" }, "Motorización / Energía"), null);
  assert.equal(value(record("carretilla-industrial", { Motor: "Eléctrico" }), "Motorización / Energía"), null);
  const lift = record("elevador-mastil-vertical", { Capacidad: "363 kg" }, "GENIE SLA15");
  assert.equal(resolveCategory(lift, catalog.categories), null);
  assert.equal(value(lift, "Motorización / Energía"), null);
  assert.equal(prepareProduct(lift, catalog).product.price, null);
  assert.equal(prepareProduct(source, catalog).product.condition, null);
});
