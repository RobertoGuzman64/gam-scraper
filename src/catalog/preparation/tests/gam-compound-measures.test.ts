import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { SOURCE_TECHNICAL_FIELDS } from "../source/technical-fields.js";
import { prepareSourceProduct } from "../prepare-product.js";

const attribute = (name: string) => {
  const result = SOURCE_TECHNICAL_FIELDS.find((item) => item.name === name);
  assert.ok(result, name);
  return result;
};

const record = (specs: SpecsMap): ProductRecord => ({
  providerId: "gam", categoryKey: "otros-nuevos", categoryName: "Otros equipos",
  url: "https://online.gamrentals.com/es/tractores-electricos-de-arrastre-tecnacar/283-tractor-electrico",
  title: "Tractor eléctrico TECNACAR VTA307", shortDescription: "Tractor eléctrico TECNACAR VTA307",
  longDescription: "Tractor eléctrico TECNACAR VTA307", reference: "283", price: null,
  brand: "TECNACAR", model: "VTA307", year: null, location: null, country: null,
  horometer: null, serialNumber: null, condition: "Nuevo", image: null, specs
});

test("GAM: convierte altura publicada en mm con sufijo redundante de metros", () => {
  const target = attribute("Altura de plataforma");
  for (const [source, expected] of [["6085mm metros", 6.085], ["9 225 mm metros", 9.225], ["10725mm metro", 10.725]] as const) {
    const product = record({ "Altura Plataforma": source });
    assert.deepEqual(resolveAttribute(product, target), { status: "resolved", value: expected });
    assert.ok(!prepareSourceProduct(product).issues.includes("Atributo no normalizable: Altura de plataforma"));
    assert.equal(product.specs?.["Altura Plataforma"], source);
  }
});

test("GAM: no corrige alturas contradictorias, alternativas o baterías etiquetadas como altura", () => {
  const target = attribute("Altura de plataforma");
  for (const value of ["4.8mm metros", "-/980 metros", "-/980/1500mmmm metros", "6085mm / 9225mm metros", "24V / 465Ah(V/Ah) metros", "6085 kg metros"]) {
    assert.deepEqual(resolveAttribute(record({ "Altura Plataforma": value }), target), { status: "invalid", value: null }, value);
  }
});

test("GAM: totaliza la potencia nominal explícita de varios motores", () => {
  const target = attribute("Potencia");
  for (const [source, expected] of [["2x4,3", 8.6], ["2×6,5", 13], ["2 x 10", 20], ["2x4.3 kW", 8.6], ["3x2,15", 6.45]] as const) {
    const product = record({ "Potencia Motor (KW)": source });
    assert.deepEqual(resolveAttribute(product, target), { status: "resolved", value: expected });
    assert.ok(!prepareSourceProduct(product).issues.includes("Atributo no normalizable: Potencia"));
    assert.equal(product.specs?.["Potencia Motor (KW)"], source);
  }
});

test("GAM: no interpreta potencias de variantes, otras unidades ni expresiones encadenadas", () => {
  const target = attribute("Potencia");
  for (const value of ["2x12x5", "2x4,3 / 2x6,5", "2x4,3 kVA", "2x24V", "2x4,3-7", "2x1,2345", "0x10"]) {
    assert.deepEqual(resolveAttribute(record({ "Potencia Motor (KW)": value }), target), { status: "invalid", value: null }, value);
  }
  assert.deepEqual(resolveAttribute(record({ "Potencia": "2x4,3" }), target), { status: "invalid", value: null });
  const foreign = { ...record({ "Potencia Motor (KW)": "2x4,3" }), providerId: "gomariz" } as const;
  assert.notEqual(resolveAttribute(foreign, target).status, "resolved");
});
