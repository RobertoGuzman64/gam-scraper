import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import { matchesTechnicalDocumentVerification } from "../../contracts/technical-provenance.js";
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

const truckFromOtherProvider = (record: ProductRecord): ProductRecord => ({ ...record, providerId: "gomariz", categoryKey: "venta",
  url: "https://www.gomarizrent.com/producto/plataforma-sobre-camion-marca-modelo10/" });

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
    assert.equal(recover(truckFromOtherProvider(record))["Dimensiones de cesta"], "1,4 x 0,7 x 1,1 m");
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

const truckMeasures = (description: string): ProductRecord => ({
  ...truck(description), shortDescription: "Plataforma telescópica sobre camión MARCA MODELO10. Capacidad de la cesta 230 kg.",
  specs: { Marca: "MARCA", Modelo: "MODELO10", "Capacidad de carga (kg)": "230 kg", "Altura de trabajo (m)": "20 m" }
});

const truckClaims = "La torreta giratoria ±320° permite trabajar. La cesta dispone de rotación hidráulica de 90° + 90°. " +
  "Dispone de 4 estabilizadores hidráulicos. Tiene una altura de trabajo de 20 m y una altura de cesta de 18 m. " +
  "El equipo se monta sobre camión de 3.500 kg de MMA.";

test("recupera prestaciones diferenciadas del camión cesta con evidencia de la unidad y sin duplicarlas", () => {
  const record = truckMeasures(truckClaims);
  const expected = { ...record.specs, "Rotación de torreta": "±320°", "Rotación de cesta": "90° a cada lado",
    "Número de estabilizadores hidráulicos": "4", "Altura de plataforma": "18 m", "Masa máxima autorizada del vehículo": "3.500 kg" };
  assert.deepEqual(recover(record), expected);
  assert.deepEqual(recoverSourcePlatformGeometry(record, record, expected), expected);
  const prepared = prepareSourceProduct(record);
  for (const [field, value] of Object.entries(expected).filter(([field]) => !(field in (record.specs ?? {})))) {
    assert.equal(prepared.product.spec[field], value);
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
    assert.equal(entry?.scope, "unit");
    assert.equal(entry?.sourceValue, record.longDescription);
  }
  assert.deepEqual(recover(truckFromOtherProvider(record)), expected);
});

test("no confunde el giro de la cesta con el del brazo ni incorpora opciones o valores contradictorios", () => {
  const invalid = [
    ["La cesta está instalada. El brazo dispone de rotación hidráulica de 90° + 90°.", "Rotación de cesta"],
    ["La cesta dispone de rotación hidráulica de 90° + 60°.", "Rotación de cesta"],
    ["Puede equipar 4 estabilizadores hidráulicos.", "Número de estabilizadores hidráulicos"],
    ["Dispone de 4 estabilizadores hidráulicos. Tiene 6 estabilizadores hidráulicos.", "Número de estabilizadores hidráulicos"],
    ["La torreta giratoria ±320° es opcional.", "Rotación de torreta"],
    ["La torreta giratoria ±320° o 360°.", "Rotación de torreta"],
    ["Tiene una altura de trabajo de 20 m y una altura de cesta de 20 m.", "Altura de plataforma"],
    ["Tiene una altura de trabajo de 22 m y una altura de cesta de 20 m.", "Altura de plataforma"],
    ["El equipo se monta sobre camión de 3.500 kg de MMA o 7.500 kg.", "Masa máxima autorizada del vehículo"]
  ] as const;
  for (const [description, field] of invalid) assert.equal(recover(truckMeasures(description))[field], undefined);
});

test("protege los alias, la identidad y las configuraciones del vehículo contradictorias", () => {
  const record = truckMeasures(truckClaims);
  const declared: ProductRecord = { ...record, specs: { ...record.specs, "Giro de torreta": "300°",
    "Rotación de la cesta": "80° a cada lado", "Estabilizadores hidráulicos": false,
    "Altura de cesta": "17 m", Peso: "3500 kg" } };
  assert.deepEqual(recover(declared), declared.specs);
  assert.deepEqual(recover({ ...record, shortDescription: "Plataforma sobre camión MARCA MODELO20" }), record.specs);
  const chassis: ProductRecord = { ...record, title: `${record.title} MARCA2`,
    shortDescription: "Plataforma sobre camión MARCA MODELO10. Plataforma sobre camión MARCA2 de 20 m." };
  assert.equal(recover(chassis)["Masa máxima autorizada del vehículo"], undefined);
  const disagreement: ProductRecord = { ...record, shortDescription: `${record.shortDescription} Dispone de 6 estabilizadores hidráulicos.` };
  assert.equal(recover(disagreement)["Número de estabilizadores hidráulicos"], undefined);
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
  assert.ok(entry?.document && entry.verification);
  assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
  assert.match(prepared.product.description_general ?? "", /altura de trabajo de 11,7 m/u);
  assert.match(prepared.product.description_general ?? "", /verificar la capacidad de cesta/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /documentación técnica del modelo|prestaciones de referencia del modelo/iu);
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

test("reutiliza evidencia en rutas genéricas solo con identidad y familia corroboradas", () => {
  const record: ProductRecord = { ...documentedPlatform(), title: "LGMG SR1018D",
    longDescription: "Las Tijeras Diésel permiten trabajos en altura." };
  assert.equal(recoverDocumented(record)["Longitud de plataforma"], "2,79 m");
  for (const invalid of [
    { ...record, longDescription: "Equipo para trabajos en altura." },
    { ...record, longDescription: "Las Articuladas Diésel permiten trabajos en altura." },
    { ...record, shortDescription: "Plataforma articulada LGMG SR1018D" },
    { ...record, url: "https://www.gomarizrent.com/producto/lgmg-sr1018d-otro/" },
    { ...record, specs: { ...record.specs, Motor: "Eléctrico" } },
    { ...record, specs: { ...record.specs, Anchura: "1,80 m" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});

test("admite motorización declarada en el encabezado sin inferirla de la marca o del modelo", () => {
  const record: ProductRecord = { ...documentedPlatform(), brand: "LGMG", model: "AS0607WE",
    title: "LGMG AS0607WE", url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-as0607we/",
    longDescription: "Las Tijeras Eléctricas permiten trabajos en altura.",
    specs: { "Altura de trabajo": "7,8 m", "Altura de plataforma": "5,8 m", Capacidad: "230 kg",
      Longitud: "1,86 m", Anchura: "0,81 m" } };
  const output = recoverDocumented(record);
  assert.deepEqual(output, { ...record.specs, "Longitud de plataforma": "1,63 m",
    "Anchura de plataforma": "0,74 m", "Extensión de plataforma": "0,9 m" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  for (const invalid of [
    { ...record, longDescription: "Las tijeras de elevación permiten trabajos en altura." },
    { ...record, longDescription: "Las Tijeras Diésel permiten trabajos en altura." },
    { ...record, longDescription: `${record.longDescription} Motor diésel.` },
    { ...record, longDescription: `${record.longDescription} Sin motor eléctrico.` },
    { ...record, specs: { ...record.specs, Motor: "Desconocido" } },
    { ...record, specs: { ...record.specs, Combustible: "Desconocido" } },
    { ...record, specs: { ...record.specs, Longitud: "1,83 m" } },
    { ...record, specs: { ...record.specs, "Ancho plataforma": "0,73 m" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
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

const invariantPlatform = (base = controlledMercaelevaPlatform(),
  url = "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-CONTROL-02"): ProductRecord => ({
  ...base, brand: "JLG", model: "450 AJ", year: "2015",
  title: "Plataforma articulada diésel JLG 450 AJ",
  longDescription: "Plataforma articulada diésel JLG 450 AJ con altura de trabajo de 16 m.",
  url,
  specs: { Marca: "JLG", Modelo: "450 AJ", "Tipo de motor": "Diésel", "Altura de trabajo": "16 m" }
});

test("recupera exclusivamente las cotas comunes documentadas de las variantes compatibles", () => {
  const record = invariantPlatform();
  const before = structuredClone(record);
  const additions = { "Anchura de plataforma": "0,76 m", "Longitud de plumín": "1,24 m" };
  const output = recoverDocumented(record);
  assert.deepEqual(output, { ...record.specs, ...additions });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  assert.deepEqual(record, before);
  const other = invariantPlatform(controlledGomarizPlatform(), "https://www.gomarizrent.com/producto/jlg-450-aj/");
  assert.deepEqual(recoverDocumented(other), output);
  const prepared = prepareSourceProduct(record);
  for (const [field, value] of Object.entries(additions)) {
    assert.equal(prepared.product.spec[field], value);
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
    assert.equal(entry?.scope, "model-document");
    assert.equal(entry?.verification?.kind, "reviewed-model-fact");
  }
  assert.equal(Object.hasOwn(output, "Longitud de plataforma"), false);
  assert.equal(Object.hasOwn(output, "Capacidad máxima de plataforma"), false);
});

test("protege la identidad, configuración, periodo y medidas declaradas de la unidad", () => {
  const record = invariantPlatform();
  for (const invalid of [
    { ...record, year: null }, { ...record, year: "2016" },
    { ...record, model: "450 AJ-2" },
    { ...record, title: `${record.title} Serie III` },
    { ...record, longDescription: "Plataforma articulada diésel de 16 m." },
    { ...record, longDescription: `${record.longDescription} Cesta sustituida.` },
    { ...record, longDescription: `${record.longDescription} Sin plumín.` },
    { ...record, longDescription: `${record.longDescription} Motor eléctrico.` },
    { ...record, specs: { ...record.specs, "Altura de trabajo": "18 m" } },
    { ...record, specs: { ...record.specs, "Ancho de cesta": "0,8 m" } },
    { ...record, specs: { ...record.specs, "Longitud del plumín": "1,5 m" } },
    { ...record, specs: { ...record.specs, Plumín: false } },
    { ...record, specs: { ...record.specs, "Año de fabricación": "2016" } },
    { ...record, specs: { ...record.specs, Combustible: "Eléctrico" } },
    { ...record, specs: { ...record.specs, "Dimensiones de cesta": "1,5 x 0,76 m" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  const existing = { ...record, specs: { ...record.specs, "Ancho de cesta": "760 mm", "Longitud del plumín": "1240 mm" } };
  assert.equal(recoverDocumented(existing), existing.specs);
});

test("recupera cotas comunes de 450AJ únicamente con la geometría de chasis acreditada", () => {
  for (const [model, length, width, capacity] of [
    ["450AJ", "6,53 m", "1,98 m", "230 kg"],
    ["450AJ Serie II", "6,71 m", "2,34 m", "227 kg"]
  ] as const) {
    const slug = model.toLowerCase().replaceAll(" ", "-");
    const record: ProductRecord = { ...controlledGomarizPlatform(), brand: "Jlg", model,
      title: `Plataforma articulada diésel Jlg ${model}`, url: `https://www.gomarizrent.com/producto/jlg-${slug}/`,
      specs: { "Altura de trabajo": "15,72 m", Capacidad: capacity, Motor: "Diésel", Longitud: length, Anchura: width } };
    const before = structuredClone(record);
    const additions = { "Anchura de plataforma": "0,76 m", "Longitud de plumín": "1,24 m" };
    const output = recoverDocumented(record);
    assert.deepEqual(output, { ...record.specs, ...additions });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const base = documentedManainJlgPlatform("Jlg", model, "15,72 m", capacity, length, width, "0,76 m");
    const other: ProductRecord = { ...base, url: `https://manain.com/producto/venda-elevacio-bracos-articulats-jlg-${slug}/`,
      specs: { ...base.specs, Motor: "Diésel" } };
    assert.deepEqual(recoverDocumented(other), { ...other.specs, "Longitud de plumín": "1,24 m" });
    const prepared = prepareSourceProduct(record);
    for (const [field, value] of Object.entries(additions)) {
      assert.equal(prepared.product.spec[field], value);
      const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
      assert.equal(entry?.scope, "model-document");
      assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    }
    for (const invalid of [
      { ...record, model: `${model}-2` },
      { ...record, specs: { ...record.specs, Longitud: "7 m" } },
      { ...record, specs: { ...record.specs, Anchura: "3 m" } },
      { ...record, specs: { ...record.specs, Capacidad: "500 kg" } },
      { ...record, specs: { ...record.specs, Motor: "Eléctrico" } },
      { ...record, longDescription: "Sin plumín." },
      { ...record, longDescription: "Cesta sustituida." },
      { ...record, specs: { ...record.specs, Plumín: false } },
      { ...record, specs: { ...record.specs, "Longitud del plumín": "1,5 m" } },
      { ...record, specs: { ...record.specs, "Ancho de cesta": "0,8 m" } }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
    const existing = { ...record, specs: { ...record.specs, "Ancho de cesta": "760 mm", "Longitud del plumín": "1240 mm" } };
    assert.equal(recoverDocumented(existing), existing.specs);
  }
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

test("recupera la altura documental de tijera sin equiparar la clase anunciada con la altura de plataforma", () => {
  const record: ProductRecord = { ...controlledGomarizPlatform(), providerId: "gam", categoryKey: "elevacion", categoryName: "Elevación",
    brand: "SNORKEL", model: "S3219E", year: "2017",
    url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas/CONTROL-01-snorkel-s3219e",
    title: "Plataforma tijera eléctrica 8 m SNORKEL S3219E",
    shortDescription: "Plataforma tijera eléctrica SNORKEL S3219E de 8 metros.",
    longDescription: "La plataforma tijera eléctrica SNORKEL S3219E ofrece una altura de elevación de 8 metros y capacidad de 250 kg.",
    specs: { Marca: "SNORKEL", Modelo: "S3219E", "Altura de elevación (m)": "8 metros",
      "Capacidad de carga (kg)": "250 kg", Longitud: "1780 mm", Anchura: "810 mm", "Dimensiones Cesta": "1,62 x 0,72 m" } };
  const before = structuredClone(record);
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, "Altura de plataforma": "5,79 m" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  assert.deepEqual(record, before);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec["Altura de plataforma"], "5,79 m");
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === "Altura de plataforma");
  assert.equal(entry?.scope, "model-document");
  assert.equal(entry?.verification?.kind, "reviewed-model-fact");
  const other: ProductRecord = { ...record, providerId: "gomariz", categoryKey: "venta", categoryName: "Venta de maquinaria",
    url: "https://www.gomarizrent.com/producto/snorkel-s3219e/",
    specs: { "Altura de trabajo": "7,79 m", Motor: "Eléctrico", Capacidad: "250 kg", Longitud: "1,78 m", Anchura: "0,81 m" } };
  assert.equal(recoverDocumented(other)["Altura de plataforma"], "5,79 m");
  for (const invalid of [
    { ...record, year: "2014" }, { ...record, year: null }, { ...record, model: "S3215E" },
    { ...record, longDescription: "La plataforma tijera eléctrica SNORKEL S3215E." },
    { ...record, longDescription: `${record.longDescription} Motor diésel.` },
    { ...record, specs: { ...record.specs, Anchura: "720 mm" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "272 kg" } },
    { ...record, specs: { ...record.specs, "Altura de elevación (m)": "6 m" } },
    { ...record, specs: { ...record.specs, "Altura de trabajo": "9 m" } },
    { ...record, specs: { ...record.specs, "Altura de plataforma": "6 m" } },
    { ...record, specs: { ...record.specs, "Año de fabricación": "2014" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});

test("distingue la Compact 12 de 300 kg de otras generaciones y conserva su cesta declarada", () => {
  const record: ProductRecord = { ...controlledGomarizPlatform(), brand: "HAULOTTE", model: "COMPACT 12", year: "2013",
    url: "https://www.gomarizrent.com/producto/haulotte-compact-12/",
    title: "Plataforma tijera eléctrica HAULOTTE COMPACT 12", shortDescription: "Plataforma tijera eléctrica HAULOTTE COMPACT 12.",
    longDescription: "La plataforma tijera eléctrica HAULOTTE COMPACT 12 tiene una altura de trabajo de 12 metros y capacidad de 300 kg.",
    specs: { "Altura de trabajo": "12 m", Motor: "Eléctrico", Capacidad: "300 kg", Longitud: "2,48 m", Anchura: "1,2 m", "Dimensiones Cesta": "2,4 x 1,17 m" } };
  assert.deepEqual(recoverDocumented(record), { ...record.specs, "Altura de plataforma": "10 m", "Extensión de plataforma": "0,92 m" });
  for (const invalid of [
    { ...record, year: "2024" }, { ...record, model: "COMPACT 12 DX" },
    { ...record, specs: { ...record.specs, Capacidad: "320 kg" } },
    { ...record, specs: { ...record.specs, "Extensión de plataforma": "1,2 m" } },
    { ...record, longDescription: `${record.longDescription} Extensión de plataforma opcional.` }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});
