import assert from "node:assert/strict";

import test from "node:test";

import type { ProductRecord } from "../../../../contracts/catalog.js";

import { prepareSourceProduct } from "../../../prepare-product.js";

import { normalizePreparedTechnicalSpecs } from "../../../shared/technical/reconciliation/preparation-technical-stages.js";

import { resolveEditorialFacts } from "../../../shared/editorial/domain/editorial-facts.js";

import { reconcileManainEditorialSourceSpecs } from "../mapping/domain-source.js";

test("Manain: capacidad de carga por unidad en familias compatibles, sin alterar specs ni propagar variantes", () => {
  const source: ProductRecord = {
    providerId: "manain",
    categoryKey: "venta",
    categoryName: "Maquinaria en venta",
    url: "https://manain.com/producto/venta-elevacion-tijera-marca-modelo10/",
    title: "MODELO10",
    shortDescription: null,
    longDescription: null,
    price: null,
    condition: "Segunda mano",
    reference: "CONTROL-01",
    brand: "MARCA",
    model: "MODELO10",
    year: "2022",
    location: null,
    country: null,
    horometer: "300",
    serialNumber: null,
    image: null,
    specs: {
      Marca: "MARCA", Modelo: "MODELO10", Motor: "Eléctrico", Peso: "2000 kg",
      "Altura trabajo": "10 m", "Capacidad carga": "230 kg", "Nueva o usada": "usada"
    }
  };
  const original = JSON.stringify(source);
  assert.equal(resolveEditorialFacts(source)?.loadCapacityKg, null);
  const adapted = reconcileManainEditorialSourceSpecs(source);
  assert.equal(adapted.specs?.["Capacidad de carga"], "230 kg");
  assert.equal(resolveEditorialFacts(adapted)?.loadCapacityKg, 230);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description_general ?? "", /capacidad de 230 kg/u);
  assert.deepEqual(prepared.product.spec, normalizePreparedTechnicalSpecs(source, source.specs ?? {}));
  assert.equal(JSON.stringify(source), original);

  const next: ProductRecord = {
    ...source, reference: "CONTROL-02", url: source.url.replace("modelo10", "modelo11"),
    title: "MODELO11", model: "MODELO11",
    specs: { ...source.specs, Modelo: "MODELO11", "Capacidad carga": "320 kg" }
  };
  assert.match(prepareSourceProduct(next).product.description_general ?? "", /capacidad de 320 kg/u);
  assert.doesNotMatch(prepareSourceProduct(next).product.description_general ?? "", /capacidad de 230 kg/u);

  const rejected: readonly ProductRecord[] = [
    { ...source, specs: { ...source.specs, "Capacidad carga": "230 lb" } },
    { ...source, specs: { ...source.specs, "Capacidad carga": "230 o 320 kg" } },
    { ...source, specs: { ...source.specs, "Capacidad carga": 230 } },
    { ...source, specs: { ...source.specs, "Capacidad de carga": "250 kg" } },
    { ...source, providerId: "gam" },
    { ...source, url: "https://manain.com.ejemplo.org/producto/venta-elevacion-tijera-marca-modelo10/" },
    { ...source, model: "OTRO" },
    { ...source, condition: "Nuevo" },
    { ...source, url: "https://manain.com/producto/venta-energia-grupo-electrogeno-marca-modelo10/" }
  ];
  for (const record of rejected) {
    assert.equal(reconcileManainEditorialSourceSpecs(record), record);
  }
});

test("Manain: las medidas de alcance ambiguas permanecen pendientes sin depender del catálogo", () => {
  const record: ProductRecord = {
    providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta",
    url: "https://manain.com/producto/venta-manipulacion-manipulador-equiptest-mt1/",
    title: "MT1", shortDescription: null, longDescription: null, price: null,
    condition: "Segunda mano", reference: "PRUEBA-MT1", brand: "EQUIPTEST", model: "MT1",
    year: "2021", location: null, country: null, horometer: "750", serialNumber: null,
    image: "https://manain.com/imagen-mt1.jpg",
    specs: {
      Marca: "EQUIPTEST", Modelo: "MT1", Motor: "Diésel", "Nueva o usada": "usada",
      "Capacidad carga": "4000 kg", "Altura de elevacion max": "14 m",
      "Alcance maximo": "3,09/1,01 m", Peso: "11370 kg"
    }
  };
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.status, "review");
  assert.ok(prepared.issues.includes("Atributo no normalizable: Alcance máximo"));
  assert.equal(prepared.product.spec["Alcance maximo"], "3,09/1,01 m");
});
