import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";

const catalog = await loadImportCatalog();
const attribute = (name: string) => {
  const found = catalog.attributes.find((entry) => entry.name === name);
  assert.ok(found, name);
  return found;
};
const machine = (specs: SpecsMap, overrides: Partial<ProductRecord> = {}): ProductRecord => ({
  providerId: "gam",
  categoryKey: "elevacion",
  categoryName: "Elevación",
  url: "https://online.gamrentals.com/es/cte/6164-plataforma-sobre-camion-telescopico-cte-b-lift-18-auto",
  title: "PLATAFORMA SOBRE CAMIÓN TELESCÓPICO 18M CTE B-LIFT 18 AUTO",
  shortDescription: "CTE B-LIFT 18 AUTO Nueva",
  longDescription: null,
  price: null,
  reference: "6164",
  brand: "CTE",
  model: "B-LIFT 18 AUTO",
  year: null,
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  condition: "Nuevo",
  image: null,
  specs,
  ...overrides
});
const resolution = (record: ProductRecord, name: string) => resolveAttribute(record, attribute(name));

test("GAM: recupera dimensiones 2D con unidad repetida sin cambiar los datos de origen", () => {
  for (const [raw, expected] of [
    ["2,27 x 1,12 m metros", "2,27 x 1,12 m"],
    ["1400x700 mm", "1,4 x 0,7 m"],
    ["2,4X1,17 metros", "2,4 x 1,17 m"]
  ] as const) {
    const record = machine({ "Dimensiones Cesta": raw });
    assert.deepEqual(resolution(record, "Dimensiones de la cesta"), { status: "resolved", value: expected });
    assert.equal(record.specs?.["Dimensiones Cesta"], raw);
  }
});

test("GAM: conserva las tres dimensiones de cesta cuando la unidad original es inequívoca", () => {
  for (const [raw, expected] of [
    ["1400x700x1100 mm metros", "1,4 x 0,7 x 1,1 m"],
    ["140x70x110 cm metros", "1,4 x 0,7 x 1,1 m"],
    ["1,4 x 0,7 x 1,1 m metros", "1,4 x 0,7 x 1,1 m"],
    ["1,4 x 0,7 x 1,1 m", "1,4 x 0,7 x 1,1 m"]
  ] as const) {
    assert.deepEqual(resolution(machine({ "Dimensiones Cesta": raw }), "Dimensiones de la cesta"),
      { status: "resolved", value: expected }, raw);
  }
});

test("GAM: no inventa unidades ni reconstruye dimensiones corruptas o contradictorias", () => {
  for (const raw of [
    "1 1,83 x 0,76 76 82 x 0 metros",
    "1400x700x1100 mm cm", "1,4 x 0,7 x 1,1",
    "2,27 x 1,12", "2,27 x 1,12 m mm", "0x1,12 m", "25x1,12 m", "1,2x-0,8 m"
  ]) {
    assert.deepEqual(resolution(machine({ "Dimensiones Cesta": raw }), "Dimensiones de la cesta"),
      { status: "invalid", value: null }, raw);
  }
});

test("GAM: omite fragmentos sin pareja recuperable y conserva formatos no acreditados como inválidos", () => {
  for (const raw of ["1 76 83X0 metros", "4 81 88x1 metros", "1400x700x1100 metros"]) {
    assert.deepEqual(resolution(machine({ "Dimensiones Cesta": raw }), "Dimensiones de la cesta"),
      { status: "not_observed", value: null }, raw);
  }
});

test("GAM: rechaza valores distintos de la misma cesta sin elegir arbitrariamente", () => {
  assert.deepEqual(resolution(machine({ "Dimensiones Cesta": "2,27 x 1,12 m metros", "Dimensiones de la cesta": "3 x 1 m" }),
    "Dimensiones de la cesta"), { status: "contradiction", value: null });
  assert.deepEqual(resolution(machine({ "Dimensiones Cesta": ["2,27 x 1,12 m metros", "3 x 1 m"] }),
    "Dimensiones de la cesta"), { status: "rejected", value: null });
});

test("GAM: normaliza grados simples de torreta sin truncar giros superiores a una vuelta", () => {
  for (const [raw, expected] of [["700º", 700], ["320º", 320], ["300º", 300], ["700°", 700], ["320 º", 320]] as const) {
    assert.deepEqual(resolution(machine({ "Rotación de torreta": raw }), "Rotación de torreta"),
      { status: "resolved", value: expected }, raw);
  }
});

test("GAM: no suma movimientos direccionales ni reasigna rotación de cesta a torreta", () => {
  for (const raw of ["90º/90º", "700º+20º", "700 grados", "700º extra"]) {
    assert.deepEqual(resolution(machine({ "Rotación de torreta": raw }), "Rotación de torreta"),
      { status: "invalid", value: null }, raw);
  }
  assert.deepEqual(resolution(machine({ "Rotación de la cesta": "90° + 90°" }), "Rotación de torreta"),
    { status: "not_observed", value: null });
});

test("GAM: omite giros direccionales sin escoger ni sumar un ángulo único", () => {
  for (const raw of ["190º+190º", "190° + 190°"]) {
    assert.deepEqual(resolution(machine({ "Rotación de torreta": raw }), "Rotación de torreta"),
      { status: "not_observed", value: null }, raw);
  }
});

test("GAM: el normalizador de unidades duplicadas no modifica otros proveedores", () => {
  assert.deepEqual(resolution(machine({ "Dimensiones Cesta": "2,27 x 1,12 m metros" }, { providerId: "gomariz" }),
    "Dimensiones de la cesta"), { status: "not_observed", value: null });
  assert.deepEqual(resolution(machine({ "Rotación de torreta": "700º" }, { providerId: "gomariz" }),
    "Rotación de torreta"), { status: "invalid", value: null });
});
