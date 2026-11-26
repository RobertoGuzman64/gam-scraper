import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { originalRecordFingerprint } from "../../../catalog/identity-fingerprint.js";
import { controlledGomarizPlatform } from "../../editorial/core/editorial-contract-records.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { findTechnicalSpecEvidence } from "../../provenance/technical-provenance.js";
import { classifyPublishedTechnicalSpec } from "../../provenance/technical-spec-classification.js";
import { recoverSourcePlatformGeometry } from "./platform-geometry-recovery.js";

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
    const provenance = prepared.technicalProvenance;
    assert.ok(provenance);
    assert.equal(provenance.originalRecordSha256, originalRecordFingerprint(record));
    const entry = findTechnicalSpecEvidence(provenance.entries, "Dimensiones de cesta", "1,4 x 0,7 x 1,1 m");
    assert.equal(entry?.scope, "unit");
    assert.equal(entry?.sourceField, "longDescription");
    assert.equal(entry?.sourceValue, record.longDescription);
    assert.equal(classifyPublishedTechnicalSpec(record, provenance, "Dimensiones de cesta", "1,4 x 0,7 x 1,1 m"), "own");
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
