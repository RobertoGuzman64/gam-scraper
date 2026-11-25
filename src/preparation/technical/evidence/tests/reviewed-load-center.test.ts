import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { controlledGomarizPlatform, controlledMercaelevaPlatform } from "../../../editorial/core/editorial-contract-records.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { recoverReviewedModelTechnicalSpecs } from "../documented-technical-evidence.js";
import { recoverDocumented } from "./reviewed-model-fixtures.js";

const documentedForklift = (): ProductRecord => ({
  ...controlledGomarizPlatform(), providerId: "gam", categoryKey: "manutencion", categoryName: "Manutención",
  brand: "HYSTER", model: "H2.5FT", country: "España", year: "2019",
  title: "Carretilla elevadora GLP HYSTER H2.5FT", shortDescription: "HYSTER H2.5FT GLP",
  url: "https://online.gamrentals.com/es/carretillas/CONTROL-01-hyster-h2-5ft",
  specs: { Marca: "HYSTER", Modelo: "H2.5FT", "Capacidad de carga (kg)": "2500 kg",
    "Altura de elevación (mm)": "4350 mm" }
});

const nominalCenter = "Centro de carga nominal del modelo";

test("recupera únicamente el centro nominal documentado, no la capacidad residual", () => {
  const record = documentedForklift();
  const before = structuredClone(record);
  const output = recoverDocumented(record);
  assert.deepEqual(output, { ...record.specs, [nominalCenter]: "500 mm" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  assert.deepEqual(record, before);
  assert.deepEqual(recoverDocumented({ ...record, reference: "CONTROL-02",
    url: record.url.replace("CONTROL-01", "CONTROL-02") }), output);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec[nominalCenter], "500 mm");
  assert.equal(prepared.product.spec["Centro de carga"], undefined);
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === nominalCenter);
  assert.equal(entry?.scope, "model-document");
  assert.equal(entry?.verification?.kind, "reviewed-model-fact");
});

test("reutiliza el centro nominal en otro proveedor con identidad y energía corroboradas", () => {
  const record: ProductRecord = { ...documentedForklift(), providerId: "gomariz", categoryKey: "venta",
    categoryName: "Venta de maquinaria", url: "https://www.gomarizrent.com/producto/hyster-h2-5ft/",
    specs: { Motor: "GLP", Capacidad: "2500 kg", "Altura máxima de elevación": "4,35 m" } };
  assert.equal(recoverDocumented(record)[nominalCenter], "500 mm");
});

test("protege variante, periodo, mercado, capacidad y precedencia del centro de carga", () => {
  const record = documentedForklift();
  for (const invalid of [
    { ...record, model: "H2.5FT-6" },
    { ...record, title: "Carretilla elevadora GLP HYSTER H2.5FT-6" },
    { ...record, year: "2022" }, { ...record, year: null }, { ...record, country: "México" },
    { ...record, title: "Carretilla elevadora HYSTER H2.5FT", shortDescription: null },
    { ...record, shortDescription: "HYSTER H2.5FT diésel" },
    { ...record, longDescription: "No funciona con GLP." },
    { ...record, specs: { ...record.specs, "Tipo motor": "Diésel" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "3000 kg" } },
    { ...record, specs: { ...record.specs, Capacidad: "3000 kg" } },
    { ...record, specs: { ...record.specs, "Centro de carga (mm)": "600 mm" } },
    { ...record, specs: { ...record.specs, "Distancia al centro de gravedad de la carga": "500 mm" } },
    { ...record, longDescription: "Centro de carga de 600 mm." }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  const reconciled = { ...record.specs, "Centro de carga": "600 mm" };
  assert.equal(recoverReviewedModelTechnicalSpecs(record, reconciled), reconciled);
});


test("aplica la referencia CESAB de segunda generación sin extrapolar a la primera", () => {
  const record: ProductRecord = { ...documentedForklift(), brand: "CESAB", model: "B318LII", year: "2023",
    title: "Carretilla elevadora eléctrica CESAB B318LII", shortDescription: "CESAB B318LII eléctrica",
    url: "https://online.gamrentals.com/es/carretillas/CONTROL-01-cesab-b318lii",
    specs: { Marca: "CESAB", Modelo: "B318LII", "Capacidad de carga (kg)": "1800 kg" } };
  assert.equal(recoverDocumented(record)[nominalCenter], "500 mm");
  assert.equal(recoverDocumented({ ...record, year: "2021" })[nominalCenter], undefined);
  assert.equal(recoverDocumented({ ...record, model: "B318L", title: "Carretilla elevadora eléctrica CESAB B318L",
    specs: { ...record.specs, Modelo: "B318L" } })[nominalCenter], undefined);
});

test("reutiliza las referencias Hyster GLP y XNT dentro de las ediciones acreditadas", () => {
  for (const [model, capacity, year, energy] of [
    ["H3.5FT", 3500, "2019", "GLP"],
    ["J1.5XNT SWB", 1500, "2019", "eléctrica"],
    ["J1.8XNT MWB", 1800, "2019", "eléctrica"],
    ["J2.0XNT MWB", 2000, "2021", "eléctrica"]
  ] as const) {
    const record: ProductRecord = { ...documentedForklift(), model, year,
      title: `Carretilla elevadora ${energy} HYSTER ${model}`, shortDescription: `HYSTER ${model} ${energy}`,
      url: `https://online.gamrentals.com/es/carretillas/CONTROL-01-hyster-${model.toLowerCase().replace(/[. ]/gu, "-")}`,
      specs: { Marca: "HYSTER", Modelo: model, "Capacidad de carga (kg)": `${capacity} kg` } };
    const output = recoverDocumented(record);
    assert.deepEqual(output, { ...record.specs, [nominalCenter]: "500 mm" });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[nominalCenter], "500 mm");
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === nominalCenter);
    assert.equal(entry?.scope, "model-document");
    assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    assert.equal(recoverDocumented({ ...record, year: "2025" })[nominalCenter], undefined);
    assert.equal(recoverDocumented({ ...record, model: `${model}-X` })[nominalCenter], undefined);
    assert.equal(recoverDocumented({ ...record, specs: { ...record.specs, "Centro de carga": "600 mm" } })[nominalCenter], undefined);
    assert.equal(recoverDocumented({ ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "1000 kg" } })[nominalCenter], undefined);
  }
});


test("recupera el centro nominal Yale VL acreditado sin extrapolar a otras versiones", () => {
  const record: ProductRecord = { ...documentedForklift(), brand: "YALE", model: "ERP35VL", year: "2019",
    title: "Carretilla elevadora eléctrica YALE ERP35VL", shortDescription: "YALE ERP35VL eléctrica",
    url: "https://online.gamrentals.com/es/carretillas/CONTROL-01-yale-erp35vl",
    specs: { Marca: "YALE", Modelo: "ERP35VL", "Capacidad de carga (kg)": "3500 kg" } };
  const before = structuredClone(record);
  const output = recoverDocumented(record);
  assert.deepEqual(output, { ...record.specs, [nominalCenter]: "500 mm" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  assert.deepEqual(record, before);
  assert.equal(recoverDocumented({ ...record, reference: "CONTROL-02", providerId: "gomariz",
    categoryKey: "venta", categoryName: "Venta de maquinaria", url: "https://www.gomarizrent.com/producto/yale-erp35vl/" })[nominalCenter], "500 mm");
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec[nominalCenter], "500 mm");
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === nominalCenter);
  assert.equal(entry?.scope, "model-document");
  assert.equal(entry?.verification?.kind, "reviewed-model-fact");
  for (const invalid of [
    { ...record, year: "2018" }, { ...record, year: "2022" }, { ...record, year: null },
    { ...record, country: "México" }, { ...record, model: "ERP35VL-X" },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "2500 kg" } },
    { ...record, specs: { ...record.specs, "Centro de carga": "600 mm" } },
    { ...record, longDescription: "Centro de carga de 600 mm." }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});

const catalogForklift = (): ProductRecord => ({
  ...documentedForklift(), brand: "YALE", model: "ERP18VT", condition: "Nuevo", year: null,
  country: null, serialNumber: null, horometer: null,
  title: "Carretilla elevadora eléctrica YALE ERP18VT",
  shortDescription: "Carretilla eléctrica YALE ERP18VT nueva",
  longDescription: "Carretilla elevadora eléctrica YALE ERP18VT de conductor sentado.",
  url: "https://online.gamrentals.com/es/carretillas/CONTROL-01-yale-erp18vt",
  specs: { Marca: "YALE", Modelo: "ERP18VT", "Capacidad de carga (kg)": "1800 kg",
    Longitud: "2898 mm", Anchura: "1116 mm", Motorización: "Eléctrica" }
});

test("recupera el centro nominal de una oferta de catálogo sin inventar año ni configuración", () => {
  const record = catalogForklift();
  const before = structuredClone(record);
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, [nominalCenter]: "500 mm" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  assert.deepEqual(record, before);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec[nominalCenter], "500 mm");
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === nominalCenter);
  assert.equal(entry?.scope, "model-document");
  assert.equal(entry?.verification?.kind, "reviewed-model-fact");
  const { providerId, categoryKey, categoryName, reference } = controlledMercaelevaPlatform();
  assert.equal(recoverDocumented({ ...record, reference,
    url: record.url.replace(record.reference ?? "", reference ?? "") })[nominalCenter], "500 mm");
  assert.equal(recoverDocumented({ ...record, country: "España", providerId, categoryKey, categoryName, reference,
    url: `https://sales.mercaeleva.com/es/for-sale/machine/YALE-ERP18VT-${reference}`,
    specs: { ...record.specs, Estado: "Nuevo", "Capacidad máxima de elevación": "1800 kg", "Tipo de motor": "Eléctrico" } })[nominalCenter], "500 mm");
});

test("excluye ofertas sin identidad, mercado o geometría compatible y no sustituye evidencia de unidad", () => {
  const record = catalogForklift();
  for (const invalid of [
    { ...record, condition: "Segunda mano" as const }, { ...record, year: "2019" },
    { ...record, country: "México" }, { ...record, serialNumber: "CONTROL-SERIAL" },
    { ...record, horometer: "100" }, { ...record, url: record.url.replace("erp18vt", "erp20vt") },
    { ...record, model: "ERP18VT-X" }, { ...record, shortDescription: "Carretilla eléctrica YALE ERP20VT" },
    { ...record, longDescription: "Carretilla elevadora eléctrica YALE ERP18VT usada." },
    { ...record, specs: { ...record.specs, Modelo: "ERP20VT" } },
    { ...record, specs: { ...record.specs, Longitud: "3100 mm" } },
    { ...record, specs: { ...record.specs, Anchura: "1289 mm" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "2000 kg" } },
    { ...record, specs: { ...record.specs, Año: "2016" } },
    { ...record, specs: { ...record.specs, "Centro de carga (mm)": "600 mm" } },
    { ...record, longDescription: `${record.longDescription} Centro de carga de 600 mm.` }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  const existing = { ...record.specs, "Centro de carga": "600 mm" };
  assert.equal(recoverReviewedModelTechnicalSpecs(record, existing), existing);
});

test("acepta anchuras alternativas documentadas sin asumir la opción montada", () => {
  const record: ProductRecord = { ...catalogForklift(), brand: "HYSTER", model: "A1.3XNT",
    title: "Carretilla elevadora eléctrica HYSTER A1.3XNT",
    shortDescription: "Carretilla eléctrica HYSTER A1.3XNT nueva",
    longDescription: "Carretilla elevadora eléctrica HYSTER A1.3XNT.",
    url: "https://online.gamrentals.com/es/carretillas/CONTROL-01-hyster-a13xnt",
    specs: { Marca: "HYSTER", Modelo: "A1.3XNT", "Capacidad de carga (kg)": "1300 kg",
      Longitud: "2724 mm", Anchura: "996 / 1056 mm", Motorización: "Eléctrica" } };
  assert.deepEqual(recoverDocumented(record), { ...record.specs, [nominalCenter]: "500 mm" });
  for (const specs of [ { ...record.specs, Anchura: "996 / 1200 mm" },
    { ...record.specs, "Anchura total": "1200 mm" } ]) {
    assert.equal(recoverDocumented({ ...record, specs }), specs);
  }
});

test("distingue la capacidad nominal de la gama UX diésel mediante las cotas documentadas", () => {
  const record: ProductRecord = { ...catalogForklift(), model: "GP30UX",
    title: "Carretilla elevadora diésel YALE GP30UX",
    shortDescription: "Carretilla elevadora diésel YALE GP30UX nueva",
    longDescription: "Carretilla elevadora diésel YALE GP30UX de conductor sentado.",
    url: "https://online.gamrentals.com/es/carretillas/CONTROL-01-yale-gp30ux",
    specs: { Marca: "YALE", Modelo: "GP30UX", "Capacidad de carga (kg)": "3000 kg",
      Longitud: "3765 mm", Anchura: "1210 mm", Motorización: "Diésel" } };
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, [nominalCenter]: "500 mm" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  for (const invalid of [
    { ...record, title: "Carretilla elevadora GLP YALE GP30UX" },
    { ...record, specs: { ...record.specs, Longitud: "3690 mm" } },
    { ...record, specs: { ...record.specs, Modelo: "GP25UX" } },
    { ...record, specs: { ...record.specs, "Centro de carga": "600 mm" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});

test("mantiene separados los centros nominales de las familias Fortens de 500 y 600 mm", () => {
  const record: ProductRecord = { ...documentedForklift(), model: "H5.5FT", year: "2021",
    title: "Carretilla elevadora GLP HYSTER H5.5FT", shortDescription: "HYSTER H5.5FT GLP",
    url: "https://online.gamrentals.com/es/carretillas/CONTROL-01-hyster-h55ft",
    specs: { Marca: "HYSTER", Modelo: "H5.5FT", "Capacidad de carga (kg)": "5500 kg" } };
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, [nominalCenter]: "600 mm" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec[nominalCenter], "600 mm");
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === nominalCenter);
  assert.equal(entry?.scope, "model-document");
  assert.equal(entry?.verification?.kind, "reviewed-model-fact");
  assert.equal(recoverDocumented({ ...record, providerId: "gomariz", categoryKey: "venta",
    categoryName: "Venta de maquinaria", url: "https://www.gomarizrent.com/producto/hyster-h55ft/",
    specs: { Motor: "GLP", Capacidad: "5500 kg" } })[nominalCenter], "600 mm");
  for (const invalid of [
    { ...record, year: "2018" }, { ...record, year: "2022" },
    { ...record, model: "H5.5FT-6" },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "5000 kg" } },
    { ...record, specs: { ...record.specs, "Centro de carga": "500 mm" } },
    { ...record, longDescription: "Centro de carga de 500 mm." }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  assert.equal(recoverDocumented({ ...documentedForklift(), year: "2021" })[nominalCenter], "500 mm");
});

test("recupera el centro de carga de gran tonelaje según capacidad y geometría de catálogo", () => {
  for (const [model, capacity, length] of [ ["GDP80DF", 8500, 5524], ["GDP100DF", 10500, 5724],
    ["GDP120DF", 12500, 5724] ] as const) {
    const record: ProductRecord = { ...catalogForklift(), model,
      title: `Carretilla elevadora diésel YALE ${model}`,
      shortDescription: `Carretilla elevadora diésel YALE ${model} nueva`,
      longDescription: `Carretilla elevadora diésel YALE ${model}.`,
      url: `https://online.gamrentals.com/es/carretillas/CONTROL-01-yale-${model.toLowerCase()}`,
      specs: { Marca: "YALE", Modelo: model, "Capacidad de carga (kg)": `${capacity} kg`,
        Longitud: `${length} mm`, Anchura: "2490 mm", Motorización: "Diésel" } };
    const output = recoverDocumented(record);
    assert.deepEqual(output, { ...record.specs, [nominalCenter]: "600 mm" });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[nominalCenter], "600 mm");
    assert.equal(prepared.technicalProvenance?.entries.find((item) => item.field === nominalCenter)?.scope, "model-document");
    for (const invalid of [
      { ...record, model: `${model}X` }, { ...record, country: "México" },
      { ...record, specs: { ...record.specs, Longitud: "6000 mm" } },
      { ...record, specs: { ...record.specs, Anchura: "2300 mm" } },
      { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "8000 kg" } },
      { ...record, specs: { ...record.specs, "Centro de carga": "500 mm" } }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  }
});

test("exige ambas cotas de la variante usada cuando el centro nominal depende de la geometría", () => {
  const record: ProductRecord = { ...documentedForklift(), brand: "MANITOU", model: "MI50D", year: "2026",
    title: "Carretilla elevadora diésel MANITOU MI50D", shortDescription: "MANITOU MI50D diésel",
    longDescription: "Carretilla elevadora diésel MANITOU MI50D.",
    url: "https://online.gamrentals.com/es/carretillas/CONTROL-01-manitou-mi50d",
    specs: { Marca: "MANITOU", Modelo: "MI50D", "Capacidad de carga (kg)": "5000 kg",
      Longitud: "3250 mm", Anchura: "1490 mm", Motorización: "Diésel" } };
  const output = recoverDocumented(record);
  assert.deepEqual(output, { ...record.specs, [nominalCenter]: "500 mm" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec[nominalCenter], "500 mm");
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === nominalCenter);
  assert.equal(entry?.scope, "model-document");
  assert.equal(entry?.verification?.kind, "reviewed-model-fact");
  assert.equal(recoverDocumented({ ...record, providerId: "gomariz", categoryKey: "venta",
    categoryName: "Venta de maquinaria", url: "https://www.gomarizrent.com/producto/manitou-mi50d/",
    specs: { Motor: "Diésel", Capacidad: "5000 kg", Longitud: "3250 mm", Anchura: "1490 mm" } })[nominalCenter], "500 mm");
  for (const invalid of [
    { ...record, model: "MI50LD" }, { ...record, year: "2025" },
    { ...record, specs: { ...record.specs, Longitud: "3499 mm", Anchura: "1990 mm" } },
    { ...record, specs: { ...record.specs, Anchura: "" } },
    { ...record, specs: { ...record.specs, Longitud: "" } },
    { ...record, specs: { ...record.specs, "Centro de carga": "600 mm" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});

test("recupera el centro nominal de una trilateral con identidad y batería corroboradas", () => {
  const record: ProductRecord = { ...catalogForklift(), brand: "HYSTER", model: "C1.3 48V",
    title: "Carretilla trilateral HYSTER C1.3 48V", shortDescription: "Carretilla trilateral HYSTER C1.3 48V nueva",
    longDescription: "Carretilla trilateral HYSTER C1.3 48V para pasillos estrechos.",
    url: "https://online.gamrentals.com/es/carretillas/CONTROL-01-hyster-c13-48v",
    specs: { Marca: "HYSTER", Modelo: "C1.3 48V", "Capacidad de carga (kg)": "1300 kg",
      Peso: "6701 kg", "Capacidad de la batería": "48 V / 700 Ah" } };
  const before = structuredClone(record);
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, [nominalCenter]: "600 mm" });
  assert.deepEqual(record, before);
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  const entry = prepareSourceProduct(record).technicalProvenance?.entries.find((item) => item.field === nominalCenter);
  assert.equal(entry?.scope, "model-document");
  assert.equal(entry?.verification?.kind, "reviewed-model-fact");
  for (const invalid of [
    { ...record, model: "C1.3 80V" }, { ...record, country: "México" }, { ...record, year: "2020" },
    { ...record, longDescription: `${record.longDescription} Motor diésel.` },
    { ...record, specs: { ...record.specs, "Capacidad de la batería": "80 V / 700 Ah" } },
    { ...record, specs: { Marca: "HYSTER", Modelo: "C1.3 48V", "Capacidad de carga (kg)": "1300 kg", Peso: "6701 kg" } },
    { ...record, specs: { ...record.specs, Peso: "6500 kg" } },
    { ...record, specs: { ...record.specs, "Centro de carga": "500 mm" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});

test("reutiliza una prestación nominal común a las configuraciones documentadas de la trilateral", () => {
  const record: ProductRecord = { ...catalogForklift(), model: "MTC15",
    title: "Carretilla trilateral eléctrica YALE MTC15", shortDescription: "Carretilla trilateral eléctrica YALE MTC15 nueva",
    longDescription: "Carretilla trilateral eléctrica YALE MTC15.",
    url: "https://online.gamrentals.com/es/carretillas/CONTROL-01-yale-mtc15",
    specs: { Marca: "YALE", Modelo: "MTC15", "Capacidad de carga (kg)": "1500 kg", Motorización: "Eléctrico" } };
  assert.deepEqual(recoverDocumented(record), { ...record.specs, [nominalCenter]: "600 mm" });
  const { providerId, categoryKey, categoryName, reference } = controlledMercaelevaPlatform();
  assert.equal(recoverDocumented({ ...record, country: "España", providerId, categoryKey, categoryName, reference,
    url: `https://sales.mercaeleva.com/es/for-sale/machine/YALE-MTC15-${reference}`,
    specs: { ...record.specs, Estado: "Nuevo", "Capacidad máxima de elevación": "1500 kg", "Tipo de motor": "Eléctrico" } })[nominalCenter], "600 mm");
  for (const invalid of [
    { ...record, longDescription: "Carretilla trilateral eléctrica YALE MTC10." },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "1000 kg" } },
    { ...record, specs: { ...record.specs, "Centro de carga nominal": "500 mm" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});

test("distingue centros nominales de gran tonelaje por designación técnica completa", () => {
  const record: ProductRecord = { ...documentedForklift(), brand: "KALMAR", model: "DCD200-12LB", year: "2008",
    title: "Carretilla elevadora diésel KALMAR DCD200-12LB", shortDescription: "KALMAR DCD200-12LB diésel",
    longDescription: "Carretilla elevadora diésel KALMAR DCD200-12LB.",
    url: "https://online.gamrentals.com/es/carretillas/CONTROL-01-kalmar-dcd200-12lb",
    specs: { Marca: "KALMAR", Modelo: "DCD200-12LB", "Capacidad de carga (kg)": "20000 kg", Anchura: "3050 mm", Motorización: "Diésel" } };
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, [nominalCenter]: "1200 mm" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  for (const invalid of [
    { ...record, model: "DCD200-6LB" }, { ...record, year: "2009" },
    { ...record, specs: { ...record.specs, Anchura: "2500 mm" } },
    { ...record, specs: { ...record.specs, "Centro de carga": "600 mm" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  const other: ProductRecord = { ...record, model: "DCE120-6", year: "2011",
    title: "Carretilla elevadora diésel KALMAR DCE120-6", shortDescription: "KALMAR DCE120-6 diésel",
    longDescription: "Carretilla elevadora diésel KALMAR DCE120-6.",
    url: "https://online.gamrentals.com/es/carretillas/CONTROL-01-kalmar-dce120-6",
    specs: { Marca: "KALMAR", Modelo: "DCE120-6", "Capacidad de carga (kg)": "12000 kg", Motorización: "Diésel" } };
  assert.equal(recoverDocumented(other)[nominalCenter], "600 mm");
  assert.equal(recoverDocumented({ ...other, model: "DCE120-12" }), other.specs);
});
