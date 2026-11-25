import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { controlledGomarizPlatform, controlledMercaelevaPlatform } from "../../../editorial/core/editorial-contract-records.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { recoverReviewedModelTechnicalSpecs } from "../documented-technical-evidence.js";
import { documentedPlatform, recoverDocumented, documentedManainJlgPlatform } from "./reviewed-model-fixtures.js";

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
