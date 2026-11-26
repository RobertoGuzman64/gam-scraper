import assert from "node:assert/strict";
import test from "node:test";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { recoverReviewedModelTechnicalSpecs } from "../documented-technical-evidence.js";
import { documentedPlatform, recoverDocumented, documentedManainJlgPlatform } from "./reviewed-model-fixtures.js";

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
  for (const [brand, model, height, length, width, platformHeight, rotation] of [
    ["Haulotte", "HA12IP", "12 m", "5,45 m", "1,35 m", "10 m", "355°"],
    ["Haulotte", "HA15IP", "15 m", "6,6 m", "1,5 m", "13 m", "350°"],
    ["HAULOTTE", "HA 15 IP", "15 m", "6,6 m", "1,5 m", "13 m", "350°"]
  ] as const) {
    const slug = `${brand}-${model}`.toLowerCase().replaceAll(" ", "-");
    const record = { ...documentedPlatform(), brand, model, title: `Plataforma articulada eléctrica ${brand} ${model}`,
      url: `https://www.gomarizrent.com/producto/${slug}/`,
      specs: { "Altura de trabajo": height, Capacidad: "230 kg", Motor: "Eléctrico", Longitud: length, Anchura: width } };
    const before = structuredClone(record);
    const additions = { "Altura de plataforma": platformHeight, "Anchura de plataforma": "0,8 m", "Rotación de torreta": rotation };
    const output = recoverDocumented(record);
    assert.deepEqual(output, { ...record.specs, ...additions });
    assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
    assert.deepEqual(record, before);
    const other = { ...documentedManainJlgPlatform(brand, model, height, "230 kg", length, width, "0,8 m", "1,5 m"),
      url: `https://manain.com/producto/venda-elevacio-bracos-articulats-${slug}/` };
    assert.deepEqual(recoverDocumented(other), { ...other.specs, "Altura de plataforma": platformHeight, "Rotación de torreta": rotation });
    const existing = { ...record, specs: { ...record.specs, "Altura plataforma": platformHeight } };
    assert.deepEqual(recoverDocumented(existing), { ...existing.specs, "Anchura de plataforma": "0,8 m", "Rotación de torreta": rotation });
    const withRotation = { ...record, specs: { ...record.specs, "Giro de torreta": rotation } };
    assert.deepEqual(recoverDocumented(withRotation), { ...withRotation.specs, "Altura de plataforma": platformHeight, "Anchura de plataforma": "0,8 m" });
    assert.equal("Rotación de cesta" in output, false);
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
      { ...record, specs: { ...record.specs, "Giro de torreta": "360°" } },
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

test("acredita la rotación de torreta LGMG sin inferir rotación de cesta ni duplicar valores", () => {
  const record = { ...documentedPlatform(), model: "A14JE", title: "Plataforma articulada eléctrica LGMG A14JE",
    url: "https://www.gomarizrent.com/producto/lgmg-a14je/",
    specs: { "Altura de trabajo": "15,8 m", Capacidad: "230 kg", Motor: "Eléctrico", Longitud: "6,66 m", Anchura: "1,8 m" } };
  const output = recoverDocumented(record);
  assert.equal(output["Rotación de torreta"], "355°");
  assert.equal(output["Rotación de cesta"], undefined);
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  const entry = prepareSourceProduct(record).technicalProvenance?.entries.find((item) => item.field === "Rotación de torreta");
  assert.equal(entry?.scope, "model-document");
  assert.equal(entry?.verification?.kind, "reviewed-model-fact");
  for (const value of ["355°", "360°"]) {
    const existing = { ...record, specs: { ...record.specs, "Giro de torreta": value } };
    assert.equal(recoverDocumented(existing)["Rotación de torreta"], undefined);
  }
  for (const invalid of [
    { ...record, model: "A14JE-Li" },
    { ...record, title: "Plataforma articulada eléctrica LGMG A14JE-2" },
    { ...record, specs: { ...record.specs, Anchura: "2 m" } },
    { ...record, specs: { ...record.specs, Capacidad: "300 kg" } }
  ]) assert.equal(recoverDocumented(invalid)["Rotación de torreta"], undefined);
});
