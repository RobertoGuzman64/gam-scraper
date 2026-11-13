import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reconcileUsedHandlingSource } from "../mapping/source-used-handling.js";
import { controlledGamForklift } from "./editorial-contract-records.js";

const used = (reference = "8200"): ProductRecord => ({
  ...controlledGamForklift(),
  categoryKey: "manutencion",
  reference,
  url: `https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/${reference}-2018-marca-modelo10`,
  condition: "Segunda mano",
  title: "Carretilla elevadora MARCA MODELO10 2500 kg",
  shortDescription: "MARCA MODELO10 usada, capacidad de carga de 2500 kg",
  longDescription: "La carretilla MARCA MODELO10, fabricada en 2021, ofrece altura de elevación de 3,2 metros y capacidad de carga indicada de 2000 kg.",
  brand: "MARCA",
  model: "MODELO10",
  serialNumber: `SERIE-${reference}`,
  year: "2018",
  yearSource: "url",
  specs: {
    Marca: "MARCA", Modelo: "MODELO10", "Nº de serie": `SERIE-${reference}`,
    "Altura de elevación (mm)": "3540 mm", "Capacidad de carga (kg)": "2500 kg"
  }
});

test("una unidad usada coherente normaliza año, elevación y capacidad sin modificar su fuente", () => {
  const source = used();
  const original = JSON.stringify(source);
  const resolved = reconcileUsedHandlingSource(source);
  assert.notEqual(resolved, source);
  assert.match(resolved.longDescription ?? "", /fabricada en 2018/u);
  assert.match(resolved.longDescription ?? "", /altura de elevación de 3,54 metros/u);
  assert.match(resolved.longDescription ?? "", /capacidad de carga indicada de 2500 kg/u);
  assert.equal(JSON.stringify(source), original);
  const prepared = prepareSourceProduct(source);
  assert.ok(!prepared.issues.includes("Atributo contradictorio: Altura de elevación"));
  assert.equal(prepared.product.spec["Altura de elevación (mm)"], "3540 mm");
});

test("la misma regla funciona para referencias nuevas y variantes del modelo sin tabla de referencias", () => {
  for (const reference of ["8201", "8202", "8203"]) {
    const source = used(reference);
    const result = reconcileUsedHandlingSource(source);
    assert.notEqual(result, source);
    assert.match(result.longDescription ?? "", /altura de elevación de 3,54 metros/u);
  }
  const secondary = used("8211");
  const sameFamily: ProductRecord = {
    ...secondary,
    providerId: "gomariz",
    url: "https://www.gomarizrent.com/venta/carretilla-elevadora/marca-modelo10/8211",
    shortDescription: "MARCA MODELO10, altura de elevación de 3,54 metros, 2500 kg de capacidad",
    yearSource: "ficha",
    specs: { ...secondary.specs, "Año de fabricación": "2018" }
  };
  const output = reconcileUsedHandlingSource(sameFamily);
  assert.match(output.longDescription ?? "", /altura de elevación de 3,54 metros/u);
  assert.match(output.longDescription ?? "", /fabricada en 2021/u);
});

test("no normaliza una altura con evidencia de unidad o familia insuficiente", () => {
  const source = used();
  const bad: readonly ProductRecord[] = [
    { ...source, condition: "Nuevo" },
    { ...source, categoryKey: "elevacion" },
    { ...source, model: "OTRA-VARIANTE" },
    { ...source, model: "MODELO1", specs: { ...source.specs, Modelo: "MODELO1" } },
    { ...source, specs: { ...source.specs, Modelo: "OTRA-VARIANTE" } },
    { ...source, serialNumber: "SERIE-DISTINTA" },
    { ...source, specs: { ...source.specs, "Nº de serie": "SERIE-DISTINTA" } },
    { ...source, specs: { ...source.specs, Marca: "OTRA-MARCA" } },
    { ...source, longDescription: "La carretilla MARCA MODELO-DISTINTO, fabricada en 2021, eleva 2000 kg." },
    { ...source, url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/8200-2019-marca-modelo10" },
    { ...source, yearSource: "ficha" },
    { ...source, specs: { ...source.specs, "Altura de elevación (mm)": "3540 kg" } }
  ];
  for (const current of bad) {
    const output = reconcileUsedHandlingSource(current);
    assert.doesNotMatch(output.longDescription ?? "", /altura de elevación de 3,54 metros/u, current.title ?? "");
  }
});

test("no reescribe alturas de concepto diferente ni declaraciones múltiples", () => {
  const source = used();
  const double: ProductRecord = {
    ...source,
    longDescription: `${source.longDescription} Tiene otra altura de elevación de 4,8 metros.`
  };
  const normalized = reconcileUsedHandlingSource(double);
  assert.match(normalized.longDescription ?? "", /altura de elevación de 3,2 metros/u);
  assert.match(normalized.longDescription ?? "", /altura de elevación de 4,8 metros/u);
  const platform: ProductRecord = { ...source,
    longDescription: "La carretilla MARCA MODELO10, fabricada en 2021, declara altura de trabajo de 3,2 metros."
  };
  assert.match(reconcileUsedHandlingSource(platform).longDescription ?? "", /altura de trabajo de 3,2 metros/u);
});

test("reconoce un año equivocado extraído de un peso solo cuando URL e imagen corroboran 2017", () => {
  const source: ProductRecord = {
    ...used("8212"),
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/8212-2017-marca-modelo10",
    title: "Carretilla elevadora MARCA MODELO10 2000 kg",
    shortDescription: "MARCA MODELO10 de 2000 kg y altura de elevación de 3,54 metros",
    specs: { ...used("8212").specs, "Capacidad de carga (kg)": "2000 kg" },
    image: "https://online.gamrentals.com/1234-product_main_2x/2017-marca-modelo10.jpg",
    year: "2000",
    yearSource: "titulo",
    longDescription: "La carretilla MARCA MODELO10, fabricada en 2016, anuncia altura de elevación de 3,2 metros y capacidad de carga de 2500 kg."
  };
  const output = reconcileUsedHandlingSource(source);
  assert.equal(output.year, "2017");
  assert.equal(output.yearSource, "url");
  assert.match(output.longDescription ?? "", /fabricada en 2017/u);
  assert.match(output.longDescription ?? "", /altura de elevación de 3,54 metros/u);
  assert.match(output.longDescription ?? "", /capacidad de carga de 2000 kg/u);
  for (const altered of [
    { ...source, image: "https://online.gamrentals.com/1234-product_main_2x/2018-marca-modelo10.jpg" },
    { ...source, image: "https://otro.example/2017-marca-modelo10.jpg" },
    { ...source, title: "Carretilla elevadora MARCA MODELO10 año 2000 de 2000 kg" }
  ]) {
    assert.equal(reconcileUsedHandlingSource(altered).year, "2000");
  }
});
