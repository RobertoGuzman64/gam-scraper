import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import { controlledGomarizPlatform, controlledMercaelevaPlatform } from "../editorial/core/editorial-contract-records.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { recoverSourcePlatformGeometry } from "./platform-geometry-recovery.js";
import { recoverReviewedModelTechnicalSpecs } from "./documented-technical-evidence.js";

const pair = "La plataforma principal presenta unas dimensiones de 1.670 mm de longitud y 740 mm de anchura.";
const extension = "La plataforma extensible de 900 mm permite ampliar el espacio disponible.";
const source = (description = `${pair} ${extension}`): ProductRecord => ({
  ...controlledGomarizPlatform(),
  longDescription: `La plataforma de tijera MARCA MODELO10 es eléctrica. ${description}`,
  specs: { "Altura de trabajo": "10 m", Capacidad: "450 kg", Motor: "Eléctrico", Longitud: "2 m", Anchura: "1 m" }
});
const recover = (record: ProductRecord) => recoverSourcePlatformGeometry(record, record, record.specs ?? {});

test("recupera geometría explícita de unidad con procedencia y sin mutar la fuente", () => {
  const record = source();
  const before = structuredClone(record);
  const output = recover(record);
  assert.equal(output["Longitud de plataforma"], "1,67 m");
  assert.equal(output["Anchura de plataforma"], "0,74 m");
  assert.equal(output["Extensión de plataforma"], "0,9 m");
  assert.deepEqual(record, before);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec["Extensión de plataforma"], "0,9 m");
  const evidence = prepared.technicalProvenance?.entries.find((entry) => entry.value === "0,9 m" && entry.field === "Extensión de plataforma");
  assert.equal(evidence?.scope, "unit");
  assert.equal(evidence?.sourceField, "longDescription");
  assert.equal(evidence?.sourceValue, record.longDescription);
});

test("la recuperación no depende del proveedor", () => {
  const record: ProductRecord = { ...source(), providerId: "gam", categoryKey: "elevacion", categoryName: "Elevación",
    url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas/CONTROL-01-marca-modelo10" };
  assert.equal(recover(record)["Longitud de plataforma"], "1,67 m");
});

test("no deduce extensión de una longitud ambigua ni de una dimensión superior a la plataforma", () => {
  assert.equal(recover(source(`${pair} La plataforma extensible de 900 mm.`))["Extensión de plataforma"], undefined);
  assert.equal(recover(source(`${pair} La extensión de plataforma de 2 m.`))["Extensión de plataforma"], undefined);
});

test("rechaza cotas incompatibles, alternativas y contradictorias", () => {
  for (const description of [pair.replace("740 mm", "1.400 mm"), `${pair} ${pair.replace("740 mm", "840 mm")}`,
    pair.replace("740 mm de anchura", "740 mm de anchura o 900 mm"), `No ${pair.toLowerCase()}`]) {
    assert.equal(recover(source(description))["Longitud de plataforma"], undefined);
  }
  const record = { ...source(), shortDescription: `MARCA MODELO10. ${pair.replace("740 mm", "840 mm")}` };
  assert.equal(recover(record)["Longitud de plataforma"], undefined);
});

test("protege identidad, evidencia original y campos ya declarados", () => {
  const record = source();
  assert.deepEqual(recoverSourcePlatformGeometry(record, { ...record, reference: "OTRA" }, record.specs ?? {}), record.specs);
  assert.deepEqual(recoverSourcePlatformGeometry(record, { ...record, longDescription: extension }, record.specs ?? {}), record.specs);
  assert.deepEqual(recover({ ...record, shortDescription: "MARCA MODELO20" }), record.specs);
  const declared = { ...record, specs: { ...record.specs, "Longitud de plataforma": "1,5 m" } };
  assert.equal(recover(declared)["Longitud de plataforma"], "1,5 m");
  assert.equal(recover(declared)["Anchura de plataforma"], undefined);
});

test("recupera dimensiones de cesta de dos o tres ejes sin deducir el ausente", () => {
  for (const [raw, expected] of [["2,4 x 0,9 m", "2,4 x 0,9 m"], ["1400 x 700 x 1100 mm", "1,4 x 0,7 x 1,1 m"]] as const) {
    const record = { ...source(`Dispone de una cesta de ${raw}.`), title: "Plataforma articulada eléctrica MARCA MODELO10",
      longDescription: `La plataforma articulada MARCA MODELO10 dispone de una cesta de ${raw}.` };
    assert.equal(recover(record)["Dimensiones de cesta"], expected);
  }
});

const truck = (description: string): ProductRecord => ({
  ...source(), providerId: "gam", categoryKey: "elevacion", categoryName: "Elevación",
  url: "https://online.gamrentals.com/es/elevacion/CONTROL-01-plataforma-sobre-camion-marca-modelo10",
  title: "Plataforma telescópica sobre camión MARCA MODELO10",
  shortDescription: "MARCA MODELO10. Capacidad de la cesta 230 kg.",
  longDescription: `La plataforma telescópica sobre camión MARCA MODELO10 permite trabajar en altura. ${description}`,
  specs: { Marca: "MARCA", Modelo: "MODELO10", "Capacidad de carga (kg)": "230 kg" }
});

test("recupera cotas de cesta con millares explícitos y construcciones de capacidad o paréntesis", () => {
  const descriptions = [
    "La cesta ofrece una capacidad máxima de 230 kg y unas dimensiones de 1.400 × 700 × 1.100 mm.",
    "La cesta de trabajo admite una capacidad máxima de 230 kg y tiene unas dimensiones de 1.400 x 700 x 1.100 mm.",
    "Dispone de una cesta de aluminio antideslizante (1.400 x 700 x 1.100 mm)."
  ];
  for (const description of descriptions) {
    const record = truck(description);
    assert.equal(recover(record)["Dimensiones de cesta"], "1,4 x 0,7 x 1,1 m");
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Dimensiones de cesta"], "1,4 x 0,7 x 1,1 m");
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === "Dimensiones de cesta");
    assert.equal(entry?.scope, "unit");
    assert.equal(entry?.sourceValue, record.longDescription);
    const other: ProductRecord = { ...record, providerId: "gomariz", categoryKey: "venta",
      url: "https://www.gomarizrent.com/producto/plataforma-sobre-camion-marca-modelo10/" };
    assert.equal(recover(other)["Dimensiones de cesta"], "1,4 x 0,7 x 1,1 m");
  }
});

test("rechaza dimensiones opcionales, contradictorias o sin corroboración de identidad y familia", () => {
  const description = "La cesta ofrece una capacidad máxima de 230 kg y unas dimensiones de 1.400 x 700 x 1.100 mm.";
  for (const invalid of [description.replace("230 kg", "250 kg"),
    `${description} ${description.replace("700 x", "800 x")}`,
    "Dispone de una cesta de aluminio (1.400 x 700 x 1.100 mm) opcional.",
    "Dispone de una cesta de aluminio (1.400 x 700 x 1.100 mm.",
    "Puede equipar una cesta de aluminio (1.400 x 700 x 1.100 mm)."]) {
    assert.equal(recover(truck(invalid))["Dimensiones de cesta"], undefined);
  }
  const record = truck(description);
  assert.equal(recover({ ...record, shortDescription: "MARCA MODELO20" })["Dimensiones de cesta"], undefined);
  assert.equal(recover({ ...record, url: "https://online.gamrentals.com/es/elevacion/CONTROL-01-carretilla-marca-modelo10" })["Dimensiones de cesta"], undefined);
  assert.equal(recover({ ...record, shortDescription: `MARCA MODELO10. ${description.replace("700 x", "800 x")}` })["Dimensiones de cesta"], undefined);
  assert.equal(recover({ ...record, specs: { ...record.specs, "Dimensiones de cesta": "1 x 1 m" } })["Dimensiones de cesta"], "1 x 1 m");
});

const documentedPlatform = (): ProductRecord => ({
  ...controlledGomarizPlatform(), brand: "LGMG", model: "SR1018D",
  title: "Plataforma de tijera diésel LGMG SR1018D",
  url: "https://www.gomarizrent.com/producto/lgmg-sr1018d/",
  specs: { "Altura de trabajo": "11,7 m", Capacidad: "454 kg", Motor: "Diésel",
    Longitud: "3,76 m", Anchura: "1,79 m", "Altura de plataforma": "9,7 m" }
});

const recoverDocumented = (record: ProductRecord) => recoverReviewedModelTechnicalSpecs(record, record.specs ?? {});

test("reutiliza geometría documental acreditada sin depender de la referencia comercial", () => {
  const record = documentedPlatform();
  const before = structuredClone(record);
  const output = recoverDocumented(record);
  assert.deepEqual(output, { ...record.specs, "Longitud de plataforma": "2,79 m",
    "Anchura de plataforma": "1,6 m", "Extensión de plataforma": "1,52 m" });
  assert.deepEqual(recoverDocumented({ ...record, reference: "CONTROL-02" }), output);
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  assert.deepEqual(record, before);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec["Extensión de plataforma"], "1,52 m");
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === "Extensión de plataforma");
  assert.equal(entry?.scope, "model-document");
});

test("reutiliza evidencia entre proveedores sin duplicar alias de origen", () => {
  const record: ProductRecord = { ...documentedPlatform(), providerId: "manain", reference: "CONTROL-03",
    url: "https://manain.com/producto/venta-elevacion-tijera-lgmg-sr1018d/", title: "SR1018D",
    specs: { Marca: "LGMG", Modelo: "SR1018D", Motor: "Diésel", "Altura trabajo": "11,7 m",
      "Capacidad carga": "454 kg", "Longitud total": "3,76 m", "Ancho total": "1,79 m",
      "Nueva o usada": "usada", "Longitud plataforma": "2,79 m", "Ancho plataforma": "1,60 m" } };
  const output = recoverDocumented(record);
  assert.deepEqual(output, { ...record.specs, "Altura de plataforma": "9,7 m", "Extensión de plataforma": "1,52 m" });
});

test("rechaza identidad, configuración o magnitudes incompatibles con el documento", () => {
  const record = documentedPlatform();
  for (const invalid of [
    { ...record, model: "SR1018D-2" },
    { ...record, title: "Plataforma de tijera diésel LGMG SR1018D-LI" },
    { ...record, title: "Plataforma de tijera diésel", url: "https://www.gomarizrent.com/producto/equipo/" },
    { ...record, specs: { ...record.specs, Motor: "Eléctrico" } },
    { ...record, specs: { ...record.specs, Capacidad: "450 kg" } },
    { ...record, specs: { ...record.specs, Anchura: "1,80 m" } },
    { ...record, specs: { ...record.specs, Longitud: "" } },
    { ...record, specs: { ...record.specs, "Ancho plataforma": "1,5 m" } },
    { ...record, longDescription: "Longitud de plataforma de 3 m." },
    { ...record, longDescription: "Sin extensión de plataforma." },
    { ...record, longDescription: "Extensión de plataforma opcional." },
    { ...record, longDescription: "Plataforma modificada." }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  const declared = { ...record, specs: { ...record.specs, "Longitud extensión": "1,52 m" } };
  assert.equal(recoverDocumented(declared)["Extensión de plataforma"], undefined);
});

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

test("reutiliza geometría LGMG corroborada sin inferir variantes de longitud ni extensiones dobles", () => {
  for (const [model, family, height, length, width, capacity, platformHeight, platformLength, platformWidth, extension] of [
    ["AR14J", "articulada", "16,09 m", "6,77 m", "2,31 m", "230 kg", "14,09 m", "1,83 m", "0,76 m", undefined],
    ["AR16J", "articulada", "17,7 m", "7,56 m", "2,31 m", "230 kg", "15,7 m", "1,83 m", "0,76 m", undefined],
    ["SR1218D", "de tijera", "13,9 m", "3,76 m", "1,79 m", "365 kg", "11,9 m", "2,79 m", "1,6 m", "1,52 m"],
    ["SR1623D", "de tijera", "17,9 m", "4,90 m", "2,30 m", "680 kg", "15,9 m", undefined, "1,83 m", undefined]
  ] as const) {
    const record: ProductRecord = { ...documentedPlatform(), model,
      title: `Plataforma ${family} diésel LGMG ${model}`,
      url: `https://www.gomarizrent.com/producto/lgmg-${model.toLowerCase()}/`,
      specs: { "Altura de trabajo": height, Capacidad: capacity, Motor: "Diésel", Longitud: length, Anchura: width } };
    const output = recoverDocumented(record);
    assert.equal(output["Altura de plataforma"], platformHeight);
    assert.equal(output["Longitud de plataforma"], platformLength);
    assert.equal(output["Anchura de plataforma"], platformWidth);
    assert.equal(output["Extensión de plataforma"], extension);
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    const prepared = prepareSourceProduct(record);
    for (const [field, value] of Object.entries(output).filter(([field]) => !(field in (record.specs ?? {})))) {
      assert.equal(prepared.product.spec[field], value);
      const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
      assert.equal(entry?.scope, "model-document");
      assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    }
    const other: ProductRecord = { ...record, providerId: "manain", reference: "CONTROL-02",
      title: model, categoryKey: "venta", categoryName: "Maquinaria en venta",
      url: `https://manain.com/producto/venda-elevacio-${family === "articulada" ? "bracos-articulats" : "tisores"}-lgmg-${model.toLowerCase()}/`,
      specs: { Marca: "LGMG", Modelo: model, Motor: "Diésel", "Altura trabajo": height,
        "Capacidad carga": capacity, "Longitud total": length, "Ancho total": width,
        "Ancho plataforma": platformWidth, "Nueva o usada": "usada" } };
    assert.equal(recoverDocumented(other)["Altura de plataforma"], platformHeight);
    assert.equal(recoverDocumented(other)["Anchura de plataforma"], undefined);
    for (const invalid of [
      { ...record, model: `${model}-2` },
      { ...record, title: `${record.title}-2` },
      { ...record, specs: { ...record.specs, Anchura: "3 m" } },
      { ...record, specs: { ...record.specs, "Ancho plataforma": "0,5 m" } },
      { ...record, longDescription: "Plataforma modificada." }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  }
});

test("reutiliza las cotas acreditadas de la serie AS sin confundir accionamiento ni variantes", () => {
  for (const [model, height, length, width, capacity, platformHeight, platformLength, platformWidth] of [
    ["AS0808E", "10 m", "2,4 m", "0,83 m", "230 kg", "8 m", "2,26 m", undefined],
    ["AS1012E", "12 m", "2,47 m", "1,18 m", "320 kg", "10 m", "2,26 m", "1,12 m"],
    ["AS0812", "10 m", "2,42 m", "1,18 m", "450 kg", "8 m", "2,26 m", "1,15 m"],
    ["AS0607W", "7,8 m", "1,83 m", "0,81 m", "230 kg", "5,8 m", "1,63 m", "0,74 m"],
    ["AS1212E", "14 m", "2,47 m", "1,18 m", "320 kg", "12 m", "2,26 m", "1,12 m"],
    ["AS1212", "14 m", "2,47 m", "1,18 m", "320 kg", "12 m", "2,26 m", "1,15 m"]
  ] as const) {
    const record: ProductRecord = { ...documentedPlatform(), model,
      title: `Plataforma de tijera eléctrica LGMG ${model}`,
      url: `https://www.gomarizrent.com/producto/lgmg-${model.toLowerCase()}/`,
      specs: { "Altura de trabajo": height, Capacidad: capacity, Motor: "Eléctrico", Longitud: length, Anchura: width } };
    const before = structuredClone(record);
    const output = recoverDocumented(record);
    assert.equal(output["Altura de plataforma"], platformHeight);
    assert.equal(output["Longitud de plataforma"], platformLength);
    assert.equal(output["Anchura de plataforma"], platformWidth);
    assert.equal(output["Extensión de plataforma"], "0,9 m");
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const prepared = prepareSourceProduct(record);
    for (const [field, value] of Object.entries(output).filter(([field]) => !(field in (record.specs ?? {})))) {
      assert.equal(prepared.product.spec[field], value);
      const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
      assert.equal(entry?.scope, "model-document");
      assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    }
    const other: ProductRecord = { ...record, providerId: "manain", reference: "CONTROL-02",
      title: model, categoryKey: "venta", categoryName: "Maquinaria en venta",
      url: `https://manain.com/producto/venda-elevacio-tisores-lgmg-${model.toLowerCase()}/`,
      specs: { Marca: "LGMG", Modelo: model, Motor: "Eléctrico", "Altura trabajo": height,
        "Capacidad carga": capacity, "Longitud total": length, "Ancho total": width,
        "Longitud plataforma": platformLength, "Nueva o usada": "usada" } };
    assert.equal(recoverDocumented(other)["Extensión de plataforma"], "0,9 m");
    assert.equal(recoverDocumented(other)["Longitud de plataforma"], undefined);
    for (const invalid of [
      { ...record, model: `${model}-2` },
      { ...record, title: `${record.title}-2` },
      { ...record, specs: { ...record.specs, Anchura: "3 m" } },
      { ...record, specs: { ...record.specs, "Longitud plataforma": "1 m" } },
      { ...record, longDescription: "Sin extensión de plataforma." },
      { ...record, longDescription: "Extensión de plataforma opcional." }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  }
});

test("recupera cotas comunes de SS0507E y SR1023D con identidad corroborada", () => {
  for (const [model, motor, height, length, width, capacity, platformHeight, platformLength, platformWidth, extension] of [
    ["SS0507E", "Eléctrico", "6,3 m", "1,53 m", "0,81 m", "230 kg", "4,3 m", "1,35 m", "0,7 m", "0,6 m"],
    ["SR1023D", "Diésel", "12 m", "4,9 m", "2,3 m", "1100 kg", "10 m", undefined, "1,83 m", undefined]
  ] as const) {
    const record: ProductRecord = { ...documentedPlatform(), model,
      title: `Plataforma de tijera LGMG ${model}`,
      url: `https://www.gomarizrent.com/producto/lgmg-${model.toLowerCase()}/`,
      specs: { "Altura de trabajo": height, Capacidad: capacity, Motor: motor, Longitud: length, Anchura: width } };
    const before = structuredClone(record);
    const output = recoverDocumented(record);
    assert.equal(output["Altura de plataforma"], platformHeight);
    assert.equal(output["Longitud de plataforma"], platformLength);
    assert.equal(output["Anchura de plataforma"], platformWidth);
    assert.equal(output["Extensión de plataforma"], extension);
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const prepared = prepareSourceProduct(record);
    for (const [field, value] of Object.entries(output).filter(([field]) => !(field in (record.specs ?? {})))) {
      assert.equal(prepared.product.spec[field], value);
      const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
      assert.equal(entry?.scope, "model-document");
      assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    }
    const other: ProductRecord = { ...record, providerId: "manain", reference: "CONTROL-02",
      title: model, categoryKey: "venta", categoryName: "Maquinaria en venta",
      url: `https://manain.com/producto/venda-elevacio-tisores-lgmg-${model.toLowerCase()}/`,
      specs: { Marca: "LGMG", Modelo: model, Motor: motor, "Altura trabajo": height,
        "Capacidad carga": capacity, "Longitud total": length, "Ancho total": width,
        "Ancho plataforma": platformWidth, "Nueva o usada": "usada" } };
    assert.equal(recoverDocumented(other)["Altura de plataforma"], platformHeight);
    assert.equal(recoverDocumented(other)["Anchura de plataforma"], undefined);
    assert.equal(recoverDocumented(other)["Extensión de plataforma"], extension);
    for (const invalid of [
      { ...record, model: `${model}-2` },
      { ...record, title: `${record.title}-2` },
      { ...record, specs: { ...record.specs, Anchura: "3 m" } },
      { ...record, specs: { ...record.specs, "Altura plataforma": "1 m" } },
      { ...record, specs: { ...record.specs, "Ancho plataforma": "0,5 m" } },
      { ...record, longDescription: "Sin extensión de plataforma." },
      { ...record, longDescription: "Extensión de plataforma opcional." }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  }
});

const documentedManainJlgPlatform = (brand: string, model: string, height: string, capacity: string,
  length: string, width: string, platformWidth: string, platformLength?: string): ProductRecord => ({
  ...documentedPlatform(), providerId: "manain", reference: "CONTROL-02", brand, model,
  title: model, categoryKey: "venta", categoryName: "Maquinaria en venta",
  url: `https://manain.com/producto/venda-elevacio-tisores-jlg-${model.toLowerCase()}/`,
  specs: { Marca: brand, Modelo: model, Motor: "Eléctrico", "Altura trabajo": height,
    "Capacidad carga": capacity, "Longitud total": length, "Ancho total": width,
    "Ancho plataforma": platformWidth, "Nueva o usada": "usada",
    ...(platformLength === undefined ? {} : { "Longitud plataforma": platformLength }) }
});

test("reutiliza dimensiones principales JLG ES sin atribuir extensiones opcionales", () => {
  for (const [model, height, platformHeight, length, width, capacity, platformWidth] of [
    ["2646ES", "9,92 m", "7,92 m", "2,50 m", "1,17 m", "450 kg", "1,12 m"],
    ["3246ES", "11,68 m", "9,68 m", "2,50 m", "1,17 m", "320 kg", "1,12 m"]
  ] as const) {
    const record: ProductRecord = { ...documentedPlatform(), brand: "Jlg", model,
      title: `Plataforma de tijera eléctrica Jlg ${model}`,
      url: `https://www.gomarizrent.com/producto/jlg-${model.toLowerCase()}/`,
      specs: { "Altura de trabajo": height, Capacidad: capacity, Motor: "Eléctrico", Longitud: length, Anchura: width } };
    const before = structuredClone(record);
    const output = recoverDocumented(record);
    assert.equal(output["Altura de plataforma"], platformHeight);
    assert.equal(output["Longitud de plataforma"], length);
    assert.equal(output["Anchura de plataforma"], platformWidth);
    assert.equal(output["Extensión de plataforma"], undefined);
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const prepared = prepareSourceProduct(record);
    for (const field of ["Altura de plataforma", "Longitud de plataforma", "Anchura de plataforma"]) {
      assert.equal(prepared.product.spec[field], output[field]);
      const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
      assert.equal(entry?.scope, "model-document");
      assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    }
    const other = documentedManainJlgPlatform("Jlg", model, height, capacity, length, width, platformWidth);
    assert.equal(recoverDocumented(other)["Longitud de plataforma"], length);
    assert.equal(recoverDocumented(other)["Anchura de plataforma"], undefined);
    for (const invalid of [
      { ...record, model: `${model}-2` },
      { ...record, title: `${record.title}-2` },
      { ...record, specs: { ...record.specs, Capacidad: "100 kg" } },
      { ...record, specs: { ...record.specs, Motor: "Diésel" } },
      { ...record, specs: { ...record.specs, Anchura: "3 m" } },
      { ...record, specs: { ...record.specs, "Altura plataforma": "1 m" } },
      { ...record, specs: { ...record.specs, "Ancho plataforma": "0,5 m" } },
      { ...record, longDescription: "Plataforma modificada." }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  }
});

test("reutiliza geometría CE de Snorkel S3970RT con extensión estándar", () => {
  const record: ProductRecord = { ...documentedPlatform(), brand: "Snorkel", model: "S3970RT",
    title: "Plataforma de tijera diésel Snorkel S3970RT",
    url: "https://www.gomarizrent.com/producto/snorkel-s3970rt/",
    specs: { "Altura de trabajo": "13,8 m", "Altura plataforma": "11,8 m", Capacidad: "350 kg",
      Motor: "Diésel", Longitud: "3,4 m", Anchura: "1,8 m" } };
  const before = structuredClone(record);
  const output = recoverDocumented(record);
  const additions = { "Longitud de plataforma": "2,8 m", "Anchura de plataforma": "1,6 m", "Extensión de plataforma": "1,2 m" };
  assert.deepEqual(output, { ...record.specs, ...additions });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  assert.deepEqual(record, before);
  const prepared = prepareSourceProduct(record);
  for (const [field, value] of Object.entries(additions)) {
    assert.equal(prepared.product.spec[field], value);
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
    assert.equal(entry?.scope, "model-document");
    assert.equal(entry?.verification?.kind, "reviewed-model-fact");
  }
  const other: ProductRecord = { ...controlledMercaelevaPlatform(), brand: record.brand, model: record.model,
    title: record.title,
    specs: { "Altura de trabajo": "13,8 m", "Capacidad máxima de plataforma": "350 kg",
      "Tipo de motor": "Diésel", "Longitud total": "3,4 m", "Anchura total": "1,8 m",
      "Longitud plataforma": "2,8 m" } };
  assert.equal(recoverDocumented(other)["Longitud de plataforma"], undefined);
  assert.equal(recoverDocumented(other)["Anchura de plataforma"], "1,6 m");
  assert.equal(recoverDocumented(other)["Extensión de plataforma"], "1,2 m");
  for (const invalid of [
    { ...record, model: "S3970RT-2" },
    { ...record, title: `${record.title}-2` },
    { ...record, specs: { ...record.specs, Capacidad: "100 kg" } },
    { ...record, specs: { ...record.specs, Motor: "Eléctrico" } },
    { ...record, specs: { ...record.specs, Anchura: "3 m" } },
    { ...record, specs: { ...record.specs, "Longitud plataforma": "1 m" } },
    { ...record, longDescription: "Sin extensión de plataforma." },
    { ...record, longDescription: "Extensión de plataforma opcional." }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});

test("reutiliza geometría CE de JLG LE sin duplicar dimensiones de origen", () => {
  for (const [model, height, platformHeight, capacity] of [
    ["3369LE", "12,06 m", "10,06 m", "450 kg"],
    ["4069LE", "14,19 m", "12,19 m", "360 kg"]
  ] as const) {
    const record = { ...documentedPlatform(), brand: "Jlg", model,
      title: `Plataforma de tijera eléctrica Jlg ${model}`,
      url: `https://www.gomarizrent.com/producto/jlg-${model.toLowerCase()}/`,
      specs: { "Altura de trabajo": height, "Altura plataforma": platformHeight, Capacidad: capacity,
        Motor: "Eléctrico", Longitud: "3,07 m", Anchura: "1,75 m" } };
    const before = structuredClone(record);
    const additions = { "Longitud de plataforma": "2,92 m", "Anchura de plataforma": "1,65 m",
      "Extensión de plataforma": "0,91 m" };
    const output = recoverDocumented(record);
    assert.deepEqual(output, { ...record.specs, ...additions });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const prepared = prepareSourceProduct(record);
    for (const [field, value] of Object.entries(additions)) {
      assert.equal(prepared.product.spec[field], value);
      const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
      assert.equal(entry?.scope, "model-document");
      assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    }
    for (const invalid of [
      { ...record, model: `M${model.slice(0, 4)}` },
      { ...record, title: `${record.title}-2` },
      { ...record, specs: { ...record.specs, Capacidad: "100 kg" } },
      { ...record, specs: { ...record.specs, Motor: "Diésel" } },
      { ...record, specs: { ...record.specs, Longitud: "2,92 m" } },
      { ...record, specs: { ...record.specs, "Ancho plataforma": "0,5 m" } },
      { ...record, longDescription: "Sin extensión de plataforma." },
      { ...record, longDescription: "Extensión de plataforma opcional." }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  }
  const other = documentedManainJlgPlatform("JLG", "4069LE", "14,19 m", "360 kg", "3,07 m", "1,75 m", "1,65 m", "2,92 m");
  assert.deepEqual(recoverDocumented(other), { ...other.specs, "Altura de plataforma": "12,19 m",
    "Extensión de plataforma": "0,91 m" });
});

test("reutiliza geometría de articuladas eléctricas LGMG sin duplicar cotas de Manain", () => {
  for (const [model, height, platformHeight, length, width, capacity, platformLength, platformWidth] of [
    ["A09JE", "11 m", "9 m", "5,46 m", "1,19 m", "230 kg", "1,17 m", "0,76 m"],
    ["A13JE", "15 m", "13 m", "6,7 m", "1,5 m", "200 kg", "1,2 m", "0,9 m"]
  ] as const) {
    const record = { ...documentedPlatform(), model,
      title: `Plataforma articulada eléctrica LGMG ${model}`,
      url: `https://www.gomarizrent.com/producto/lgmg-${model.toLowerCase()}/`,
      specs: { "Altura de trabajo": height, Capacidad: capacity, Motor: "Eléctrico", Longitud: length, Anchura: width } };
    const before = structuredClone(record);
    const additions = { "Altura de plataforma": platformHeight, "Longitud de plataforma": platformLength,
      "Anchura de plataforma": platformWidth };
    const output = recoverDocumented(record);
    assert.deepEqual(output, { ...record.specs, ...additions });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const other = { ...documentedManainJlgPlatform("LGMG", model, height, capacity, length, width, platformWidth, platformLength),
      url: `https://manain.com/producto/venda-elevacio-bracos-articulats-lgmg-${model.toLowerCase()}/` };
    assert.deepEqual(recoverDocumented(other), { ...other.specs, "Altura de plataforma": platformHeight });
    const prepared = prepareSourceProduct(other);
    assert.equal(prepared.product.spec["Altura de plataforma"], platformHeight);
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === "Altura de plataforma");
    assert.equal(entry?.scope, "model-document");
    assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    for (const invalid of [
      { ...record, model: `${model}-2` },
      { ...record, title: `${record.title}-Li` },
      { ...record, title: "Plataforma articulada eléctrica", url: "https://www.gomarizrent.com/producto/equipo/" },
      { ...record, specs: { ...record.specs, Capacidad: "100 kg" } },
      { ...record, specs: { ...record.specs, Motor: "Diésel" } },
      { ...record, specs: { ...record.specs, Anchura: "3 m" } },
      { ...record, specs: { ...record.specs, "Altura plataforma": "1 m" } },
      { ...record, specs: { ...record.specs, "Ancho plataforma": "0,5 m" } },
      { ...record, longDescription: "Plataforma sustituida." }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  }
});

test("reutiliza cotas LGMG AR20J y AS0808 sin alterar las condiciones de capacidad o uso", () => {
  for (const [model, kind, energy, height, length, width, capacity, platformLength, platformWidth, field, value] of [
    ["AR20J", "articulada", "Diésel", "21,58 m", "9,42 m", "2,5 m", "260 kg", "2,44 m", "0,9 m", "Altura de plataforma", "19,58 m"],
    ["AS0808", "de tijera", "Eléctrico", "10 m", "2,4 m", "0,83 m", "230 kg", "2,26 m", "0,81 m", "Extensión de plataforma", "0,9 m"]
  ] as const) {
    const base = documentedManainJlgPlatform("LGMG", model, height, capacity, length, width, platformWidth, platformLength);
    const record = { ...base, specs: { ...base.specs, Motor: energy },
      url: `https://manain.com/producto/venda-elevacio-${kind === "articulada" ? "bracos-articulats" : "tisores"}-lgmg-${model.toLowerCase()}/` };
    const before = structuredClone(record);
    const output = recoverDocumented(record);
    assert.deepEqual(output, { ...record.specs, [field]: value });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[field], value);
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
    assert.equal(entry?.scope, "model-document");
    assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    const other = { ...documentedPlatform(), model, title: `Plataforma ${kind} ${energy} LGMG ${model}`,
      specs: { "Altura de trabajo": height, Capacidad: capacity, Motor: energy, Longitud: length, Anchura: width },
      url: `https://www.gomarizrent.com/producto/lgmg-${model.toLowerCase()}/` };
    assert.equal(recoverDocumented(other)[field], value);
    assert.equal(recoverDocumented(other)["Longitud de plataforma"], platformLength);
    assert.equal(recoverDocumented(other)["Anchura de plataforma"], platformWidth);
    for (const invalid of [
      { ...record, model: `${model}-2` },
      { ...record, title: `${record.title}-2` },
      { ...record, specs: { ...record.specs, "Capacidad carga": "350 kg" } },
      { ...record, specs: { ...record.specs, "Ancho total": "3 m" } },
      { ...record, specs: { ...record.specs, "Ancho plataforma": "0,5 m" } },
      { ...record, longDescription: "Plataforma modificada." }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
    assert.equal(recoverDocumented(other)[model === "AR20J" ? "Capacidad restringida" : "Altura de plataforma"], undefined);
  }
});


test("recupera geometría de LGMG S1413EII sin generalizar límites interiores", () => {
  const model = "S1413EII";
  const record = { ...documentedPlatform(), model, title: `Plataforma de tijera eléctrica LGMG ${model}`,
    url: `https://www.gomarizrent.com/producto/lgmg-${model.toLowerCase()}/`,
    specs: { "Altura de trabajo": "15,8 m", Capacidad: "320 kg", Motor: "Eléctrico", Longitud: "2,8 m", Anchura: "1,3 m" } };
  const before = structuredClone(record);
  const additions = { "Longitud de plataforma": "2,64 m", "Anchura de plataforma": "1,12 m", "Extensión de plataforma": "0,9 m" };
  const output = recoverDocumented(record);
  assert.deepEqual(output, { ...record.specs, ...additions });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  assert.deepEqual(record, before);
  const other = { ...documentedManainJlgPlatform("LGMG", model, "15,8 m", "320 kg", "2,8 m", "1,3 m", "1,12 m", "2,64 m"),
    url: `https://manain.com/producto/venda-elevacio-tisores-lgmg-${model.toLowerCase()}/` };
  assert.deepEqual(recoverDocumented(other), { ...other.specs, "Extensión de plataforma": "0,9 m" });
  const prepared = prepareSourceProduct(record);
  for (const [field, value] of Object.entries(additions)) {
    assert.equal(prepared.product.spec[field], value);
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
    assert.equal(entry?.scope, "model-document");
    assert.equal(entry?.verification?.kind, "reviewed-model-fact");
  }
  for (const invalid of [
    { ...record, model: `${model}-2` },
    { ...record, title: `${record.title}-Li` },
    { ...record, specs: { ...record.specs, "Altura de trabajo": "10 m" } },
    { ...record, specs: { ...record.specs, Capacidad: "230 kg" } },
    { ...record, specs: { ...record.specs, Anchura: "1,18 m" } },
    { ...record, specs: { ...record.specs, "Ancho plataforma": "0,8 m" } },
    { ...record, longDescription: "Extensión de plataforma opcional." }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  assert.equal(Object.hasOwn(output, "Altura de plataforma"), false);
});

test("recupera alturas de plataforma JLG articuladas sin atribuir cestas opcionales", () => {
  for (const [model, height, length, width, platformHeight, energy] of [
    ["340AJ", "12,33 m", "5,52 m", "1,93 m", "10,33 m", "Diésel"],
    ["600AJ", "20,46 m", "8,82 m", "2,49 m", "18,46 m", "Diésel"],
    ["800AJ", "26,38 m", "11,12 m", "2,44 m", "24,38 m", "Diésel"],
    ["E300AJP", "10,97 m", "5,74 m", "1,22 m", "8,97 m", "Eléctrico"],
    ["E400AJPN", "14,19 m", "6,71 m", "1,50 m", "12,19 m", "Eléctrico"]
  ] as const) {
    const record = { ...documentedPlatform(), brand: "JLG", model, title: `Plataforma articulada ${energy.toLowerCase()} JLG ${model}`,
      url: `https://www.gomarizrent.com/producto/jlg-${model.toLowerCase()}/`,
      specs: { "Altura de trabajo": height, Capacidad: "230 kg", Motor: energy, Longitud: length, Anchura: width } };
    const before = structuredClone(record);
    const output = recoverDocumented(record);
    assert.deepEqual(output, { ...record.specs, "Altura de plataforma": platformHeight });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const other = { ...documentedManainJlgPlatform("JLG", model, height, "230 kg", length, width, "0,91 m"),
      url: `https://manain.com/producto/venda-elevacio-bracos-articulats-jlg-${model.toLowerCase()}/`,
      specs: { ...documentedManainJlgPlatform("JLG", model, height, "230 kg", length, width, "0,91 m").specs, Motor: energy } };
    assert.deepEqual(recoverDocumented(other), { ...other.specs, "Altura de plataforma": platformHeight });
    const already = { ...record, specs: { ...record.specs, "Altura plataforma": platformHeight } };
    assert.equal(recoverDocumented(already), already.specs);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Altura de plataforma"], platformHeight);
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === "Altura de plataforma");
    assert.equal(entry?.scope, "model-document");
    assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    for (const invalid of [
      { ...record, model: `${model}-2` },
      { ...record, title: `${record.title}-2` },
      { ...record, specs: { ...record.specs, Motor: energy === "Diésel" ? "Eléctrico" : "Diésel" } },
      { ...record, specs: { ...record.specs, Capacidad: "250 kg" } },
      { ...record, specs: { ...record.specs, Anchura: "3 m" } },
      { ...record, specs: { ...record.specs, "Altura plataforma": "1 m" } },
      { ...record, longDescription: "Plataforma sustituida." }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  }
});


test("recupera alturas documentadas de plataformas articuladas sin atribuir configuraciones alternativas", () => {
  for (const [brand, model, height, capacity, length, width, platformHeight, energy] of [
    ["HAULOTTE", "HA 16 RTJ", "16 m", "230 kg", "6,75 m", "2,3 m", "14 m", "Diésel"],
    ["HAULOTTE", "HA 20 PX", "20,65 m", "230 kg", "8,93 m", "2,38 m", "18,65 m", "Diésel"],
    ["HAULOTTE", "HA 260 PX", "25,6 m", "230 kg", "12 m", "2,38 m", "23,6 m", "Diésel"],
    ["MANITOU", "170 AETJ-L", "16,9 m", "200 kg", "6,84 m", "1,75 m", "14,9 m", "Eléctrico"],
    ["MANITOU", "150 AETJ C", "15 m", "200 kg", "6,05 m", "1,5 m", "13 m", "Eléctrico"],
    ["GENIE", "Z-30-20 N", "11,14 m", "227 kg", "5,11 m", "1,19 m", "9,14 m", "Eléctrico"],
    ["GENIE", "Z-30-20 N RJ", "10,89 m", "227 kg", "5,31 m", "1,19 m", "8,89 m", "Eléctrico"]
  ] as const) {
    const slug = `${brand}-${model}`.toLowerCase().replaceAll(" ", "-");
    const record = { ...documentedPlatform(), brand, model, title: `Plataforma articulada ${energy.toLowerCase()} ${brand} ${model}`,
      url: `https://www.gomarizrent.com/producto/${slug}/`,
      specs: { "Altura de trabajo": height, Capacidad: capacity, Motor: energy, Longitud: length, Anchura: width } };
    const before = structuredClone(record);
    const output = recoverDocumented(record);
    assert.deepEqual(output, { ...record.specs, "Altura de plataforma": platformHeight });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const base = documentedManainJlgPlatform(brand, model, height, capacity, length, width, "0,8 m");
    const other = { ...base, url: `https://manain.com/producto/venda-elevacio-bracos-articulats-${slug}/`,
      specs: { ...base.specs, Motor: energy } };
    assert.deepEqual(recoverDocumented(other), { ...other.specs, "Altura de plataforma": platformHeight });
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Altura de plataforma"], platformHeight);
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === "Altura de plataforma");
    assert.equal(entry?.scope, "model-document");
    assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    const already = { ...record, specs: { ...record.specs, "Altura plataforma": platformHeight } };
    assert.equal(recoverDocumented(already), already.specs);
    for (const invalid of [
      { ...record, model: `${model} PRO` },
      { ...record, title: `${record.title}-2` },
      { ...record, specs: { ...record.specs, Motor: energy === "Diésel" ? "Eléctrico" : "Diésel" } },
      { ...record, specs: { ...record.specs, Capacidad: "250 kg" } },
      { ...record, specs: { ...record.specs, Capacidad: "220 kg", "Altura de trabajo": "14,6 m" } },
      { ...record, specs: { ...record.specs, Anchura: "3 m" } },
      { ...record, specs: { ...record.specs, "Altura plataforma": "1 m" } },
      { ...record, longDescription: "Plataforma sustituida." }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  }
});


test("recupera la cota común de cesta Haulotte IP sin atribuir la dimensión variable", () => {
  for (const [brand, model, height, length, width, platformHeight] of [
    ["Haulotte", "HA12IP", "12 m", "5,45 m", "1,35 m", "10 m"],
    ["Haulotte", "HA15IP", "15 m", "6,6 m", "1,5 m", "13 m"],
    ["HAULOTTE", "HA 15 IP", "15 m", "6,6 m", "1,5 m", "13 m"]
  ] as const) {
    const slug = `${brand}-${model}`.toLowerCase().replaceAll(" ", "-");
    const record = { ...documentedPlatform(), brand, model, title: `Plataforma articulada eléctrica ${brand} ${model}`,
      url: `https://www.gomarizrent.com/producto/${slug}/`,
      specs: { "Altura de trabajo": height, Capacidad: "230 kg", Motor: "Eléctrico", Longitud: length, Anchura: width } };
    const before = structuredClone(record);
    const additions = { "Altura de plataforma": platformHeight, "Anchura de plataforma": "0,8 m" };
    const output = recoverDocumented(record);
    assert.deepEqual(output, { ...record.specs, ...additions });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const other = { ...documentedManainJlgPlatform(brand, model, height, "230 kg", length, width, "0,8 m", "1,5 m"),
      url: `https://manain.com/producto/venda-elevacio-bracos-articulats-${slug}/` };
    assert.deepEqual(recoverDocumented(other), { ...other.specs, "Altura de plataforma": platformHeight });
    const existing = { ...record, specs: { ...record.specs, "Altura plataforma": platformHeight } };
    assert.deepEqual(recoverDocumented(existing), { ...existing.specs, "Anchura de plataforma": "0,8 m" });
    const prepared = prepareSourceProduct(record);
    for (const [field, value] of Object.entries(additions)) {
      assert.equal(prepared.product.spec[field], value);
      const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
      assert.equal(entry?.scope, "model-document");
      assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    }
    for (const invalid of [
      { ...record, model: `${model}-2` },
      { ...record, title: `${record.title}-2` },
      { ...record, specs: { ...record.specs, Motor: "Diésel" } },
      { ...record, specs: { ...record.specs, Capacidad: "200 kg" } },
      { ...record, specs: { ...record.specs, Anchura: "3 m" } },
      { ...record, specs: { ...record.specs, "Ancho plataforma": "0,9 m" } },
      { ...record, longDescription: "Cesta sustituida." }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  }
});


test("recupera geometría Haulotte DX y RTJ PRO con cotas compatibles", () => {
  for (const [model, family, height, length, width, capacity, platformHeight, platformLength, platformWidth, extension] of [
    ["COMPACT 12 DX", "de tijera", "12,06 m", "3,17 m", "1,78 m", "450 kg", "10,06 m", "2,45 m", "1,45 m", "1,2 m"],
    ["HA 32 RTJ PRO", "articulada", "31,8 m", "11,7 m", "2,53 m", "250 kg", "29,8 m", "2,44 m", "0,91 m", null]
  ] as const) {
    const slug = model.toLowerCase().replaceAll(" ", "-");
    const record = { ...documentedPlatform(), brand: "HAULOTTE", model,
      title: `Plataforma ${family} diésel HAULOTTE ${model}`,
      url: `https://www.gomarizrent.com/producto/haulotte-${slug}/`,
      specs: { "Altura de trabajo": height, Capacidad: capacity, Motor: "Diésel", Longitud: length, Anchura: width } };
    const before = structuredClone(record);
    const additions = { "Altura de plataforma": platformHeight, ...(extension === null ? {} : {
      "Longitud de plataforma": platformLength, "Anchura de plataforma": platformWidth, "Extensión de plataforma": extension }) };
    const output = recoverDocumented(record);
    assert.deepEqual(output, { ...record.specs, ...additions });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const base = documentedManainJlgPlatform("HAULOTTE", model, height, capacity, length, width, platformWidth, platformLength);
    const other = { ...base, url: `https://manain.com/producto/venda-elevacio-${extension === null ? "bracos-articulats" : "tisores"}-haulotte-${slug}/`,
      specs: { ...base.specs, Motor: "Diésel" } };
    assert.deepEqual(recoverDocumented(other), { ...other.specs, "Altura de plataforma": platformHeight,
      ...(extension === null ? {} : { "Extensión de plataforma": extension }) });
    const prepared = prepareSourceProduct(record);
    for (const [field, value] of Object.entries(additions)) {
      assert.equal(prepared.product.spec[field], value);
      const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
      assert.equal(entry?.scope, "model-document");
      assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    }
    for (const invalid of [
      { ...record, model: `${model}-2` },
      { ...record, specs: { ...record.specs, Motor: "Eléctrico" } },
      { ...record, specs: { ...record.specs, Capacidad: "200 kg" } },
      { ...record, specs: { ...record.specs, Anchura: "3 m" } },
      { ...record, specs: { ...record.specs, "Altura plataforma": "1 m" } },
      { ...record, longDescription: "Plataforma sustituida." }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
    const existing = { ...record, specs: { ...record.specs, ...additions } };
    assert.equal(recoverDocumented(existing), existing.specs);
  }
});

test("recupera geometría JLG ES1932 y R4045 sin extrapolar condiciones de uso", () => {
  for (const [brand, model, height, capacity, length, width, platformLength, platformWidth, extension, platformHeight] of [
    ["JLG", "ES1932", "7,8 m", "230 kg", "1,74 m", "0,81 m", "1,59 m", "0,64 m", "0,86 m", "5,8 m"],
    ["Jlg", "R4045", "13,96 m", "350 kg", "2,71 m", "1,14 m", "2,43 m", "1,05 m", "0,91 m", null]
  ] as const) {
    const record = { ...documentedPlatform(), brand, model, title: `Plataforma de tijera eléctrica ${brand} ${model}`,
      url: `https://www.gomarizrent.com/producto/jlg-${model.toLowerCase()}/`,
      specs: { "Altura de trabajo": height, Capacidad: capacity, Motor: "Eléctrico", Longitud: length, Anchura: width } };
    const before = structuredClone(record);
    const additions = { "Longitud de plataforma": platformLength, "Anchura de plataforma": platformWidth,
      "Extensión de plataforma": extension, ...(platformHeight === null ? {} : { "Altura de plataforma": platformHeight }) };
    const output = recoverDocumented(record);
    assert.deepEqual(output, { ...record.specs, ...additions });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const other = documentedManainJlgPlatform(brand, model, height, capacity, length, width, platformWidth, platformLength);
    assert.deepEqual(recoverDocumented(other), { ...other.specs, "Extensión de plataforma": extension,
      ...(platformHeight === null ? {} : { "Altura de plataforma": platformHeight }) });
    const prepared = prepareSourceProduct(record);
    for (const [field, value] of Object.entries(additions)) {
      assert.equal(prepared.product.spec[field], value);
      const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
      assert.equal(entry?.scope, "model-document");
      assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    }
    for (const invalid of [
      { ...record, model: `${model}i` },
      { ...record, title: `${record.title}-2` },
      { ...record, specs: { ...record.specs, Motor: "Diésel" } },
      { ...record, specs: { ...record.specs, Capacidad: "250 kg" } },
      { ...record, specs: { ...record.specs, Anchura: "3 m" } },
      { ...record, specs: { ...record.specs, "Ancho plataforma": "0,5 m" } },
      { ...record, longDescription: "Sin extensión de plataforma." }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
    const existing = { ...record, specs: { ...record.specs, ...additions } };
    assert.equal(recoverDocumented(existing), existing.specs);
  }
});

test("recupera geometría Haulotte SX y SXL sin confundir la doble extensión con una única", () => {
  for (const [model, height, length, platformLength, platformHeight] of [
    ["H15 SXL", "15 m", "5,3 m", "5,3 m", "13 m"],
    ["H18 SX", "18 m", "4,18 m", "4 m", "16 m"]
  ] as const) {
    const slug = model.toLowerCase().replaceAll(" ", "-");
    const record = { ...documentedPlatform(), brand: "HAULOTTE", model, title: `Plataforma de tijera diésel HAULOTTE ${model}`,
      url: `https://www.gomarizrent.com/producto/haulotte-${slug}/`,
      specs: { "Altura de trabajo": height, Capacidad: "500 kg", Motor: "Diésel", Longitud: length, Anchura: "2,25 m" } };
    const before = structuredClone(record);
    const additions = { "Altura de plataforma": platformHeight, "Longitud de plataforma": platformLength, "Anchura de plataforma": "1,89 m" };
    const output = recoverDocumented(record);
    assert.deepEqual(output, { ...record.specs, ...additions });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const base = documentedManainJlgPlatform("HAULOTTE", model, height, "500 kg", length, "2,25 m", "1,89 m", platformLength);
    const other = { ...base, url: `https://manain.com/producto/venda-elevacio-tisores-haulotte-${slug}/`,
      specs: { ...base.specs, Motor: "Diésel" } };
    assert.deepEqual(recoverDocumented(other), { ...other.specs, "Altura de plataforma": platformHeight });
    const prepared = prepareSourceProduct(record);
    for (const [field, value] of Object.entries(additions)) {
      assert.equal(prepared.product.spec[field], value);
      const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
      assert.equal(entry?.scope, "model-document");
      assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    }
    for (const invalid of [
      { ...record, model: `${model}-2` },
      { ...record, specs: { ...record.specs, Motor: "Eléctrico" } },
      { ...record, specs: { ...record.specs, Capacidad: "700 kg" } },
      { ...record, specs: { ...record.specs, Anchura: "3 m" } },
      { ...record, specs: { ...record.specs, "Altura plataforma": "1 m" } },
      { ...record, longDescription: "Plataforma sustituida." }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
    const existing = { ...record, specs: { ...record.specs, ...additions } };
    assert.equal(recoverDocumented(existing), existing.specs);
  }
});


test("recupera alturas Optimum 8 AE y 530LRT sin atribuir dimensiones alternativas", () => {
  for (const [brand, model, height, capacity, length, width, platformHeight, energy, extension] of [
    ["HAULOTTE", "OPTIMUM 8 AE", "7,77 m", "230 kg", "1,9 m", "0,79 m", "5,77 m", "Eléctrico", "0,86 m"],
    ["JLG", "530LRT", "18,15 m", "680 kg", "4,88 m", "2,31 m", "16,15 m", "Diésel", null]
  ] as const) {
    const slug = `${brand}-${model}`.toLowerCase().replaceAll(" ", "-");
    const record = { ...documentedPlatform(), brand, model, title: `Plataforma de tijera ${energy.toLowerCase()} ${brand} ${model}`,
      url: `https://www.gomarizrent.com/producto/${slug}/`,
      specs: { "Altura de trabajo": height, Capacidad: capacity, Motor: energy, Longitud: length, Anchura: width } };
    const before = structuredClone(record);
    const additions = { "Altura de plataforma": platformHeight, ...(extension === null ? {} : { "Extensión de plataforma": extension }) };
    const output = recoverDocumented(record);
    assert.deepEqual(output, { ...record.specs, ...additions });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const base = documentedManainJlgPlatform(brand, model, height, capacity, length, width, "0,74 m");
    const other = { ...base, url: `https://manain.com/producto/venda-elevacio-tisores-${slug}/`,
      specs: { ...base.specs, Motor: energy } };
    assert.deepEqual(recoverDocumented(other), { ...other.specs, ...additions });
    const prepared = prepareSourceProduct(record);
    for (const [field, value] of Object.entries(additions)) {
      assert.equal(prepared.product.spec[field], value);
      const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
      assert.equal(entry?.scope, "model-document");
      assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    }
    for (const invalid of [
      { ...record, model: `${model}-2` },
      { ...record, specs: { ...record.specs, Motor: energy === "Diésel" ? "Eléctrico" : "Diésel" } },
      { ...record, specs: { ...record.specs, Capacidad: "700 kg" } },
      { ...record, specs: { ...record.specs, Anchura: "3 m" } },
      { ...record, specs: { ...record.specs, "Altura plataforma": "1 m" } },
      { ...record, longDescription: "Plataforma sustituida." }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
    const existing = { ...record, specs: { ...record.specs, ...additions } };
    assert.equal(recoverDocumented(existing), existing.specs);
  }
});
