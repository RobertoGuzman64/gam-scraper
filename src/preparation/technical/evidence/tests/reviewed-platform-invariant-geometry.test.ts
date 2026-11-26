import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { matchesTechnicalDocumentVerification } from "../../../../contracts/technical-provenance.js";
import { controlledGomarizPlatform, controlledMercaelevaPlatform } from "../../../editorial/core/editorial-contract-records.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { recoverReviewedModelTechnicalSpecs } from "../documented-technical-evidence.js";
import { recoverDocumented, documentedManainJlgPlatform } from "./reviewed-model-fixtures.js";

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

const standardExtensionPlatform = (base = controlledMercaelevaPlatform(),
  url = "https://sales.mercaeleva.com/es/for-sale/machine/JLG-1930-ES-CONTROL-02"): ProductRecord => ({
  ...base, brand: "JLG", model: "1930 ES", year: "2008", condition: "Segunda mano",
  title: "Plataforma de tijera eléctrica JLG 1930 ES", shortDescription: null,
  longDescription: "Plataforma de tijera eléctrica JLG 1930 ES con altura de trabajo de 8 m.", url,
  specs: { Marca: "JLG", Modelo: "1930 ES", "Tipo de motor": "Eléctrico", "Altura de trabajo": "8 m", "Año de fabricación": "2008" }
});

test("recupera la extensión estándar acreditada para la tijera compatible", () => {
  const record = standardExtensionPlatform();
  const before = structuredClone(record);
  const output = recoverDocumented(record);
  assert.deepEqual(output, { ...record.specs, "Extensión de plataforma": "0,9 m" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  assert.deepEqual(record, before);
  const other = standardExtensionPlatform(controlledGomarizPlatform(), "https://www.gomarizrent.com/producto/jlg-1930-es/");
  assert.deepEqual(recoverDocumented(other), output);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec["Extensión de plataforma"], "0,9 m");
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === "Extensión de plataforma");
  assert.equal(entry?.scope, "model-document");
  assert.equal(entry?.verification?.kind, "reviewed-model-fact");
});

test("no atribuye la extensión ante identidad, periodo o configuración insuficientes", () => {
  const record = standardExtensionPlatform();
  for (const invalid of [
    { ...record, year: null }, { ...record, year: "2009" }, { ...record, model: "1930 ES II" },
    { ...record, title: `${record.title} II` },
    { ...record, url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-2030-ES-CONTROL-02" },
    { ...record, shortDescription: "JLG 2030 ES" },
    { ...record, longDescription: "Plataforma de tijera eléctrica de 8 m." },
    { ...record, longDescription: `${record.longDescription} Plataforma modificada.` },
    { ...record, longDescription: `${record.longDescription} Extensión opcional.` },
    { ...record, specs: { ...record.specs, "Extensión de plataforma": "0,9 m" } },
    { ...record, specs: { ...record.specs, "Lateral extensible": "800 mm" } },
    { ...record, specs: { ...record.specs, "Altura de trabajo": "10 m" } },
    { ...record, specs: { ...record.specs, "Año de fabricación": "2009" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});

const compactExtensionPlatform = (model = "COMPACT-10N", height = "10", year = "2018"): ProductRecord => ({
  ...controlledMercaelevaPlatform(), brand: "Haulotte", model, year, condition: "Segunda mano",
  title: `Plataforma de tijera eléctrica Haulotte ${model}`, shortDescription: null,
  longDescription: `Plataforma de tijera eléctrica Haulotte ${model} con altura de trabajo de ${height} m.`,
  url: `https://sales.mercaeleva.com/es/for-sale/machine/Haulotte-${model}-CONTROL-02`,
  specs: { Marca: "Haulotte", Modelo: model, "Tipo de motor": "Eléctrico", "Altura de trabajo": `${height} m`, "Año de fabricación": year }
});

test("recupera la extensión de diseño de las Compact acreditadas sin modificar la altura declarada", () => {
  for (const [model, height, year] of [["COMPACT-10N", "10", "2016"], ["COMPACT-10", "10", "2018"], ["COMPACT-14", "14", "2018"]] as const) {
    const record = compactExtensionPlatform(model, height, year);
    const before = structuredClone(record);
    const result = recoverDocumented(record);
    assert.deepEqual(result, { ...record.specs, "Extensión de plataforma": "0,92 m" });
    assert.deepEqual(record, before);
    assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Extensión de plataforma"], "0,92 m");
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === "Extensión de plataforma");
    assert.equal(entry?.scope, "model-document");
    assert.equal(entry?.verification?.kind, "reviewed-model-fact");
    const other = { ...record, providerId: "gomariz", reference: "OTRA-UNIDAD",
      url: `https://www.gomarizrent.com/producto/haulotte-${model.toLowerCase()}/` };
    assert.deepEqual(recoverDocumented(other), result);
  }
});

test("protege la extensión Compact frente a variantes, opciones, equivalencias y periodos incompatibles", () => {
  const record = compactExtensionPlatform();
  for (const invalid of [
    { ...record, year: "2019" }, { ...record, year: null },
    compactExtensionPlatform("COMPACT-10N AE"), compactExtensionPlatform("COMPACT-10 DX"),
    { ...record, url: record.url.replace("COMPACT-10N", "COMPACT-10") },
    { ...record, longDescription: `${record.longDescription} Extensión opcional.` },
    { ...record, longDescription: `${record.longDescription} Plataforma modificada.` },
    { ...record, specs: { ...record.specs, "Lateral extensible": "920 mm" } },
    { ...record, specs: { ...record.specs, "Extensión de plataforma": "1,2 m" } },
    { ...record, specs: { ...record.specs, "Año de fabricación": "2017" } },
    { ...record, specs: { ...record.specs, "Altura de trabajo": "12 m" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});

const sparseArticulatedPlatform = (brand: string, model: string, year: string, height: string): ProductRecord => ({
  ...controlledMercaelevaPlatform(), brand, model, year, condition: "Segunda mano",
  title: `Plataforma articulada eléctrica ${brand} ${model}`, shortDescription: null,
  longDescription: `Plataforma articulada eléctrica ${brand} ${model} con altura de trabajo de ${height} m.`,
  url: `https://sales.mercaeleva.com/es/for-sale/machine/${brand}-${model}-CONTROL-02`,
  specs: { Marca: brand, Modelo: model, "Tipo de motor": "Eléctrico", "Altura de trabajo": `${height} m`, "Año de fabricación": year }
});

test("recupera la anchura común sin atribuir dimensiones variables cuando faltan cotas de identificación", () => {
  for (const [brand, model, year, height, width] of [
    ["Haulotte", "HA12IP", "2015", "12", "0,8 m"], ["Haulotte", "HA15IP", "2017", "15", "0,8 m"],
    ["JLG", "E300AJP", "2006", "11", "0,76 m"], ["LGMG", "A14JE", "2022", "16", "0,76 m"]
  ] as const) {
    const record = sparseArticulatedPlatform(brand, model, year, height);
    const before = structuredClone(record);
    const result = recoverDocumented(record);
    assert.deepEqual(result, { ...record.specs, "Anchura de plataforma": width });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
    assert.deepEqual(record, before);
    const other: ProductRecord = { ...record, providerId: "gomariz", reference: "OTRA-UNIDAD",
      url: `https://www.gomarizrent.com/producto/${brand.toLowerCase()}-${model.toLowerCase()}/` };
    assert.deepEqual(recoverDocumented(other), result);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Anchura de plataforma"], width);
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === "Anchura de plataforma");
    assert.equal(entry?.scope, "model-document");
    assert.equal(entry?.verification?.kind, "reviewed-model-fact");
  }
});

test("mantiene la precedencia geométrica y rechaza contradicciones en la recuperación alternativa", () => {
  const record = sparseArticulatedPlatform("Haulotte", "HA12IP", "2015", "12");
  const complete: ProductRecord = { ...record, specs: { ...record.specs, Longitud: "5,45 m", Anchura: "1,35 m", Capacidad: "230 kg" } };
  assert.deepEqual(recoverDocumented(complete), { ...complete.specs, "Altura de plataforma": "10 m", "Anchura de plataforma": "0,8 m", "Rotación de torreta": "355°" });
  for (const invalid of [
    { ...record, year: null }, { ...record, year: "2021" }, { ...record, condition: "Nuevo" as const },
    { ...record, url: record.url.replace("HA12IP", "HA15IP") },
    { ...record, longDescription: "Plataforma articulada eléctrica Haulotte HA15IP" },
    { ...record, longDescription: `${record.longDescription} Cesta modificada.` },
    { ...record, specs: { ...record.specs, Longitud: "7 m" } },
    { ...record, specs: { ...record.specs, Anchura: "2 m" } },
    { ...record, specs: { ...record.specs, Capacidad: "400 kg" } },
    { ...record, specs: { ...record.specs, "Anchura de cesta": "0,9 m" } },
    { ...record, specs: { ...record.specs, "Dimensiones de cesta": "1,5 x 0,8 m" } },
    { ...record, specs: { ...record.specs, "Año de fabricación": "2016" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  const equivalent = { ...record, specs: { ...record.specs, "Ancho de cesta": "800 mm" } };
  assert.equal(recoverDocumented(equivalent), equivalent.specs);
});

test("recupera extensiones de diseño y una cota de cesta con identidad de generación acreditada", () => {
  const holland = { ...compactExtensionPlatform("N-165EL12", "18,5", "2011"), brand: "Hollandlift",
    title: "Plataforma de tijera eléctrica Hollandlift N-165EL12", longDescription: "Plataforma de tijera eléctrica Hollandlift N-165EL12 de 18,5 m.",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/Hollandlift-N-165EL12-CONTROL-02",
    specs: { Marca: "Hollandlift", Modelo: "N-165EL12", "Tipo de motor": "Eléctrico", "Altura de trabajo": "18,5 m" } };
  const compact = { ...compactExtensionPlatform("COMPACT-12DX", "12", "2018"),
    title: "Plataforma de tijera diésel Haulotte COMPACT-12DX", longDescription: "Plataforma de tijera diésel Haulotte COMPACT-12DX de 12 m.",
    specs: { Marca: "Haulotte", Modelo: "COMPACT-12DX", "Tipo de motor": "Diésel", "Altura de trabajo": "12 m" } };
  const jlg = { ...sparseArticulatedPlatform("JLG", "450 AJ SII", "2013", "16"),
    title: "Plataforma articulada diésel JLG 450 AJ SII", longDescription: "Plataforma articulada diésel JLG 450 AJ SII de 16 m.",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-SII-CONTROL-02",
    specs: { Marca: "JLG", Modelo: "450 AJ SII", "Tipo de motor": "Diésel", "Altura de trabajo": "16 m" } };
  for (const [record, field, value] of [[holland, "Extensión de plataforma", "1,5 m"],
    [compact, "Extensión de plataforma", "1,2 m"], [jlg, "Anchura de plataforma", "0,76 m"]] as const) {
    const result = recoverDocumented(record);
    assert.deepEqual(result, { ...record.specs, [field]: value, ...(record === holland ? { "Longitud de plataforma": "3,38 m", "Anchura de plataforma": "1,16 m" } : {}) });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[field], value);
    assert.equal(prepared.technicalProvenance?.entries.find((item) => item.field === field)?.scope, "model-document");
    const invalid = { ...record, url: "https://sales.mercaeleva.com/es/for-sale/machine/OTRO-MODELO-CONTROL-02" };
    assert.equal(recoverDocumented(invalid), invalid.specs);
  }
});

test("recupera recorridos angulares nominales sin confundir giro total y giro por lado", () => {
  for (const [model, height] of [["170AETJL", "17"], ["120AETJC", "12"]] as const) {
    const record = sparseArticulatedPlatform("Manitou", model, "2015", height);
    const result = recoverDocumented(record);
    assert.deepEqual(result, { ...record.specs, "Rotación de torreta": "355°", "Rotación de cesta": "140°" });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
    const prepared = prepareSourceProduct(record);
    for (const field of ["Rotación de torreta", "Rotación de cesta"]) {
      const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
      assert.ok(entry && entry.scope === "model-document");
      assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
    }
    for (const invalid of [
      { ...record, year: "2022" }, { ...record, model: `${model} X` },
      { ...record, longDescription: `${record.longDescription} Torreta modificada.` },
      { ...record, specs: { ...record.specs, "Giro de cesta": "140° a cada lado" } },
      { ...record, specs: { ...record.specs, "Giro de torreta": "360°" } }
    ]) assert.equal(recoverDocumented(invalid), invalid.specs);
    const equivalent = { ...record, specs: { ...record.specs, "Giro de torreta": "355°", "Giro de cesta": "140°" } };
    assert.equal(recoverDocumented(equivalent), equivalent.specs);
  }
});

test("recupera los giros nominales acreditados sin mezclar variantes ni configuraciones", () => {
  const base = sparseArticulatedPlatform("Haulotte", "HA16RTJ", "2017", "16");
  const record: ProductRecord = { ...base, title: "Plataforma articulada diésel Haulotte HA16RTJ",
    longDescription: "Plataforma articulada diésel Haulotte HA16RTJ de 16 m.",
    specs: { ...base.specs, "Tipo de motor": "Diésel" } };
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, "Rotación de torreta": "355°", "Rotación de cesta": "165°" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  const other: ProductRecord = { ...record, providerId: "gomariz", reference: "OTRA-UNIDAD",
    url: "https://www.gomarizrent.com/producto/haulotte-ha16rtj/" };
  assert.deepEqual(recoverDocumented(other), result);
  const prepared = prepareSourceProduct(record);
  for (const field of ["Rotación de torreta", "Rotación de cesta"]) {
    const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
    assert.ok(entry && entry.scope === "model-document");
    assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
  }
  for (const invalid of [
    { ...record, year: "2020" }, { ...record, model: "HA16RTJ PRO" },
    { ...record, title: "Plataforma articulada diésel Haulotte HA16 RTJ PRO" },
    { ...record, url: record.url.replace("HA16RTJ", "HA16-RTJ-PRO") },
    { ...record, longDescription: `${record.longDescription} Cesta modificada.` },
    { ...record, specs: { ...record.specs, "Giro de torreta": "360°" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  const equivalent = { ...record, specs: { ...record.specs, "Giro de torreta": "355°", "Giro de cesta": "165°" } };
  assert.equal(recoverDocumented(equivalent), equivalent.specs);
});

test("recupera la extensión Optimum 8 de la generación acreditada y conserva las equivalencias", () => {
  const record = { ...compactExtensionPlatform("Optimum 8", "8", "2018"),
    url: "https://sales.mercaeleva.com/es/for-sale/machine/Haulotte-Optimum-8-CONTROL-02" };
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, "Extensión de plataforma": "0,86 m" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  const entry = prepareSourceProduct(record).technicalProvenance?.entries.find((item) => item.field === "Extensión de plataforma");
  assert.ok(entry && entry.scope === "model-document");
  assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
  for (const invalid of [
    { ...record, year: "2016", specs: { ...record.specs, "Año de fabricación": "2016" } },
    { ...record, url: record.url.replace("Optimum-8", "Optimum-8-AE") },
    { ...record, longDescription: `${record.longDescription} Extensión opcional.` },
    { ...record, specs: { ...record.specs, "Extensión de plataforma": "0,92 m" } },
    { ...record, specs: { ...record.specs, "Extensión de plataforma": "860 mm" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});


test("recupera dimensiones fijas de tijeras acreditadas sin sustituir medidas de origen", () => {
  const base = compactExtensionPlatform("Compact 12", "12", "2018");
  const record: ProductRecord = { ...base, url: "https://sales.mercaeleva.com/es/for-sale/machine/Haulotte-Compact-12-CONTROL-02" };
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, "Longitud de plataforma": "2,31 m", "Anchura de plataforma": "1,2 m" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  for (const field of ["Longitud de plataforma", "Anchura de plataforma"]) {
    const entry = prepareSourceProduct(record).technicalProvenance?.entries.find((item) => item.field === field);
    assert.ok(entry && entry.scope === "model-document");
    assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
  }
  const other: ProductRecord = { ...record, providerId: "gomariz", reference: "OTRA-UNIDAD",
    url: "https://www.gomarizrent.com/producto/haulotte-compact-12/" };
  assert.deepEqual(recoverDocumented(other), result);
  for (const invalid of [
    { ...record, year: "2009" },
    { ...record, model: "Compact 12 DX" },
    { ...record, url: record.url.replace("Compact-12", "Compact-12-PRO") },
    { ...record, longDescription: `${record.longDescription} Plataforma modificada.` },
    { ...record, specs: { ...record.specs, "Longitud de plataforma": "3 m" } },
    { ...record, specs: { ...record.specs, "Dimensiones de cesta": "2,31 x 1,2 m" } },
    { ...record, specs: { ...record.specs, "Longitud": "2,49 m" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  const equivalent = { ...record, specs: { ...record.specs, "Longitud de plataforma": "2310 mm", "Anchura de plataforma": "1200 mm" } };
  assert.equal(recoverDocumented(equivalent), equivalent.specs);
});

test("recupera giros acreditados de plataformas diésel conservando la variante y la procedencia", () => {
  const base = sparseArticulatedPlatform("Manitou", "MAN GO 12", "2017", "12");
  const record: ProductRecord = { ...base, title: "Plataforma articulada diésel Manitou MAN GO 12",
    longDescription: "Plataforma articulada diésel Manitou MAN GO 12 de 12 m.",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/Manitou-MAN-GO-12-CONTROL-02",
    specs: { ...base.specs, "Tipo de motor": "Diésel" } };
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, "Rotación de torreta": "350°" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  const entry = prepareSourceProduct(record).technicalProvenance?.entries.find((item) => item.field === "Rotación de torreta");
  assert.ok(entry && entry.scope === "model-document");
  assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
  const other: ProductRecord = { ...record, providerId: "gomariz", reference: "OTRA-UNIDAD",
    url: "https://www.gomarizrent.com/producto/manitou-man-go-12/" };
  assert.deepEqual(recoverDocumented(other), result);
  for (const invalid of [
    { ...record, year: "2020" },
    { ...record, model: "MAN GO 12 X" },
    { ...record, specs: { ...record.specs, "Giro de torreta": "360°" } },
    { ...record, longDescription: `${record.longDescription} Torreta modificada.` }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});

test("recupera la extensión nominal Liftlux sin confundir dimensiones ni variantes", () => {
  const record: ProductRecord = { ...compactExtensionPlatform("153-12", "17", "2006"), brand: "JLG",
    title: "Plataforma de tijera eléctrica JLG 153-12", longDescription: "Plataforma de tijera eléctrica JLG 153-12 con altura de trabajo de 17 m.",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-153-12-CONTROL-02",
    specs: { Marca: "JLG", Modelo: "153-12", "Tipo de motor": "Eléctrico", "Altura de trabajo": "17 m", "Año de fabricación": "2006" } };
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, "Extensión de plataforma": "1,5 m" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  assert.equal(prepareSourceProduct(record).technicalProvenance?.entries.find((entry) => entry.field === "Extensión de plataforma")?.scope, "model-document");
  for (const invalid of [
    { ...record, year: "2007" }, { ...record, model: "153-12X" },
    { ...record, url: record.url.replace("153-12", "153-22") },
    { ...record, longDescription: `${record.longDescription} Extensión opcional.` },
    { ...record, specs: { ...record.specs, "Extensión de plataforma": "1500 mm" } }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});
