import assert from "node:assert/strict";

import test from "node:test";

import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";

import { prepareSourceProduct } from "../prepare-product.js";

import { normalizePreparedTechnicalSpecs } from "../technical/preparation-technical-stages.js";

import { resolveEditorialFacts } from "../editorial/core/editorial-facts.js";

import { reconcileManainEditorialSourceSpecs } from "./domain-source.js";
import { resolveAttribute } from "../classification/attribute-mapping.js";

test("Manain: capacidad de carga por unidad en familias compatibles, conservando masa y origen sin propagar variantes", () => {
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
  const { ["Capacidad carga"]: capacity, ["Altura trabajo"]: workHeight, ...remaining } = normalizePreparedTechnicalSpecs(source, source.specs ?? {});
  assert.equal(capacity, "230 kg");
  assert.equal(workHeight, "10 m");
  assert.deepEqual(prepared.product.spec, { ...remaining, "Capacidad de la cesta": capacity, "Altura de trabajo": workHeight });
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
  assert.match(prepared.product.description_general ?? "", /altura de elevación de 14 m/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /alcance lateral de/u);
  const scalar = { ...record, specs: { ...record.specs, "Alcance maximo": "3,4 m" } };
  const adapted = reconcileManainEditorialSourceSpecs(scalar);
  assert.equal(resolveEditorialFacts(adapted)?.lateralReachM, 3.4);
  assert.equal(resolveEditorialFacts(adapted)?.liftingHeightM, 14);

});

test("Manain: el alcance horizontal de una plataforma alimenta la narrativa compartida sin duplicar specs", () => {
  const record: ProductRecord = {
    providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta",
    url: "https://manain.com/producto/venta-elevacion-brazo-articulado-equiptest-ba1/",
    title: "BA1", shortDescription: null, longDescription: null, price: null,
    condition: "Segunda mano", reference: "CONTROL-BA1", brand: "EQUIPTEST", model: "BA1",
    year: "2022", location: null, country: null, horometer: "300", serialNumber: null, image: null,
    specs: { Marca: "EQUIPTEST", Modelo: "BA1", Motor: "Diésel", "Nueva o usada": "usada",
      "Altura trabajo": "16 m", "Capacidad carga": "230 kg", "Alcance horizontal max.": "8,20 m", Peso: "6500 kg" }
  };
  const original = JSON.stringify(record);
  const adapted = reconcileManainEditorialSourceSpecs(record);
  assert.equal(resolveEditorialFacts(adapted)?.lateralReachM, 8.2);
  assert.equal(reconcileManainEditorialSourceSpecs(adapted), adapted);
  const prepared = prepareSourceProduct(record);
  assert.match(prepared.product.description ?? "", /alcance horizontal máximo de 8,2 m/u);
  assert.match(prepared.product.description_general ?? "", /alcance horizontal máximo declarado de 8,2 m/u);
  assert.equal(prepared.product.spec["Alcance horizontal máximo"], "8,20 m");
  assert.equal(prepared.product.spec["Alcance horizontal max."], undefined);
  assert.equal(prepared.product.spec["Alcance Lateral"], undefined);
  assert.equal(JSON.stringify(record), original);
  for (const specs of [
    { ...record.specs, "Alcance horizontal": "9 m" },
    { ...record.specs, "Alcance horizontal max.": "8/9 m" },
    { ...record.specs, "Alcance horizontal max.": "8 mm" },
    { ...record.specs, "Alcance horizontal max.": "90 m" }
  ]) {
    const rejected = reconcileManainEditorialSourceSpecs({ ...record, specs });
    assert.equal(rejected.specs?.["Alcance Lateral"], undefined);
    assert.equal(resolveEditorialFacts(rejected)?.lateralReachM, null);
  }
  const canonical = { ...record, specs: { ...record.specs, "Alcance lateral": "7 m" } };
  assert.equal(reconcileManainEditorialSourceSpecs(canonical).specs?.["Alcance Lateral"], undefined);
  const other = { ...record, url: record.url.replace("brazo-articulado", "tijera") };
  assert.equal(reconcileManainEditorialSourceSpecs(other).specs?.["Alcance Lateral"], undefined);
  const unrelated = { ...record, providerId: "gam" };
  assert.equal(reconcileManainEditorialSourceSpecs(unrelated), unrelated);
});

test("Manain: altura de elevación y mástil se adaptan por familia y unidad sin inferir medidas", () => {
  const record: ProductRecord = {
    providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta",
    url: "https://manain.com/producto/venta-manipulacion-carretilla-equiptest-ce1/",
    title: "CE1", shortDescription: null, longDescription: null, price: null,
    condition: "Segunda mano", reference: "CONTROL-CE1", brand: "EQUIPTEST", model: "CE1",
    year: "2022", location: null, country: null, horometer: "300", serialNumber: null, image: null,
    specs: { Marca: "EQUIPTEST", Modelo: "CE1", Motor: "Diésel", "Nueva o usada": "usada",
      "Capacidad carga": "2500 kg", "Altura elevacion": "4750 mm", "Tipo mastil": "triplex", Peso: "4500 kg" }
  };
  const original = JSON.stringify(record);
  const adapted = reconcileManainEditorialSourceSpecs(record);
  assert.equal(resolveEditorialFacts(adapted)?.liftingHeightM, 4.75);
  assert.equal(resolveEditorialFacts(adapted)?.mastType, "tríplex");
  assert.equal(reconcileManainEditorialSourceSpecs(adapted), adapted);
  const prepared = prepareSourceProduct(record);
  assert.match(prepared.product.description ?? "", /altura de elevación de 4,75 m/u);
  assert.match(prepared.product.description_general ?? "", /mástil tríplex declarado/u);
  assert.equal(prepared.product.spec["Altura elevacion"], "4750 mm");
  assert.equal(prepared.product.spec["Altura de elevación (m)"], undefined);
  assert.equal(prepared.product.spec["Tipo Mástil"], "Tríplex");
  assert.equal(prepared.product.spec["Tipo mastil"], undefined);
  assert.equal(JSON.stringify(record), original);
  const invalid = { ...record, specs: { ...record.specs, "Altura elevacion": "4/5 m", "Tipo mastil": "desconocido" } };
  const rejected = reconcileManainEditorialSourceSpecs(invalid);
  assert.equal(rejected.specs?.["Altura de elevación (m)"], undefined);
  assert.equal(rejected.specs?.["Tipo Mástil"], undefined);
  const canonical = { ...record, specs: { ...record.specs, "Altura de elevación (mm)": "4000 mm", "Tipo de mástil": "Dúplex" } };
  assert.equal(reconcileManainEditorialSourceSpecs(canonical).specs?.["Altura de elevación (m)"], undefined);
  assert.equal(reconcileManainEditorialSourceSpecs(canonical).specs?.["Tipo Mástil"], undefined);
  const pump = { ...record, url: record.url.replace("manipulacion-carretilla", "pequena-maquinaria-bomba-sumergible") };
  assert.equal(reconcileManainEditorialSourceSpecs(pump), pump);
});

const geometrySource = (family: string, specs: SpecsMap): ProductRecord => ({
  providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta",
  url: `https://manain.com/producto/venta-${family}-equiptest-x1/`,
  title: "X1", shortDescription: null, longDescription: null, price: null,
  condition: "Segunda mano", reference: "CONTROL-GEOMETRIA", brand: "EQUIPTEST", model: "X1",
  year: null, location: null, country: null, horometer: null, serialNumber: null, image: null, specs
});

const reachAttribute = { name: "Alcance horizontal", type: "NUMBER", unit_option: "m" } as const;
const maxReachAttribute = { ...reachAttribute, name: "Alcance máximo horizontal" };
const extensionAttribute = { ...reachAttribute, name: "Extensión de plataforma" };
const basketAttribute = { name: "Dimensiones de la cesta", type: "TEXT", unit_option: "m" } as const;

test("Manain: el alcance acreditado se comparte con los atributos sin modificar la fuente", () => {
  const source = geometrySource("elevacion-brazo-articulado", { "Alcance horizontal max.": "8,2 m" });
  const before = JSON.stringify(source);
  assert.deepEqual(resolveAttribute(source, reachAttribute), { status: "resolved", value: 8.2 });
  assert.equal(JSON.stringify(source), before);
  assert.equal(resolveAttribute(geometrySource("elevacion-brazo-telescopico", source.specs ?? {}), reachAttribute).value, 8.2);
  assert.equal(resolveAttribute(geometrySource("manipulacion-manipulador", { "Alcance maximo": "4,5 m" }), maxReachAttribute).value, 4.5);
  for (const raw of ["8/9 m", "8 mm", "90 m", "8", "0 m"]) {
    assert.equal(resolveAttribute({ ...source, specs: { "Alcance horizontal max.": raw } }, reachAttribute).value, null);
  }
  assert.equal(resolveAttribute({ ...source, specs: { ...source.specs, "Alcance lateral": "7 m" } }, reachAttribute).value, null);
  assert.equal(resolveAttribute(geometrySource("elevacion-tijera", source.specs ?? {}), reachAttribute).value, null);
  assert.equal(resolveAttribute({ ...source, providerId: "gomariz" }, reachAttribute).value, null);
  assert.equal(resolveAttribute(geometrySource("manipulacion-manipulador", { "Alcance maximo": "3/4 m" }), maxReachAttribute).value, null);
});

test("Manain: dimensiones y extensiones de plataforma conservan magnitud, familia y precedencia", () => {
  const source = geometrySource("elevacion-tijera", {
    "Longitud plataforma": "2,4 m", "Ancho plataforma": "1,2 m", "Longitud extensión": "0,8 m"
  });
  assert.equal(resolveAttribute(source, basketAttribute).value, "2,4 x 1,2 m");
  assert.equal(resolveAttribute(source, extensionAttribute).value, 0.8);
  assert.equal(resolveAttribute({ ...source, specs: { ...source.specs, "Dimensiones de la cesta": "2 x 1 m" } }, basketAttribute).value, "2 x 1 m");
  for (const specs of [
    { "Longitud plataforma": "2,4 m" },
    { ...source.specs, "Ancho plataforma": "0,8/1,2 m" },
    { ...source.specs, "Anchura de plataforma": "1,4 m" },
    { ...source.specs, "Ancho plataforma": "1,2 mm" }
  ]) assert.equal(resolveAttribute({ ...source, specs }, basketAttribute).value, null);
  for (const raw of ["0,8/1,2 m", "n/a m", "3 m", "0,8 mm"]) {
    assert.equal(resolveAttribute({ ...source, specs: { ...source.specs, "Longitud extensión": raw } }, extensionAttribute).value, null);
  }
  assert.equal(resolveAttribute(geometrySource("movimiento-tierra-miniexcavadora", source.specs ?? {}), basketAttribute).value, null);
  assert.equal(resolveAttribute(geometrySource("elevacion-brazo-articulado", source.specs ?? {}), extensionAttribute).value, null);
  assert.equal(resolveAttribute({ ...source, shortDescription: "Miniexcavadora compacta" }, basketAttribute).value, null);
});
