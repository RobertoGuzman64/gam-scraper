import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { sourceSemanticQualityIssues } from "../source/semantic-quality.js";

test("el motor no acredita pesos físicamente inverosímiles en plataformas ni altera la fuente", () => {
  const platform: ProductRecord = {
    providerId: "manain",
    categoryKey: "venta",
    categoryName: "Maquinaria en venta",
    url: "https://manain.com/producto/venta-elevacion-brazo-articulado-equiptest-tx1/",
    title: "TX1",
    shortDescription: null,
    longDescription: null,
    price: null,
    condition: "Segunda mano",
    reference: "PRUEBA-TX1",
    brand: "EQUIPTEST",
    model: "TX1",
    year: "2021",
    location: null,
    country: null,
    horometer: "500",
    serialNumber: null,
    image: "https://manain.com/imagen-tx1.jpg",
    specs: {
      Marca: "EQUIPTEST", Modelo: "TX1", Motor: "Diésel", "Nueva o usada": "usada",
      "Altura trabajo": "15 m", "Capacidad carga": "230 kg", Peso: "10 kg"
    }
  };
  const before = JSON.stringify(platform);
  const rejected = prepareSourceProduct(platform);
  assert.equal(rejected.status, "review");
  assert.ok(sourceSemanticQualityIssues(platform).some((issue) => /Peso técnicamente inverosímil/u.test(issue)));
  assert.match(rejected.product.description_general ?? "", /altura de trabajo de 15 m/u);
  assert.doesNotMatch(rejected.product.description_general ?? "", /peso declarado de 10 kg/u);
  assert.equal(rejected.product.spec.Peso, "10 kg");
  assert.equal(JSON.stringify(platform), before);
  const supported: ProductRecord = { ...platform, specs: { ...platform.specs, Peso: "1200 kg" } };
  const accepted = prepareSourceProduct(supported);
  assert.deepEqual(sourceSemanticQualityIssues(supported), []);
  assert.equal(accepted.status, "ready");
  assert.match(accepted.product.description_general ?? "", /peso declarado de 1\.200 kg/u);
  const alternativeSource: ProductRecord = { ...platform, providerId: "gam" };
  assert.deepEqual(sourceSemanticQualityIssues(alternativeSource), []);
});
