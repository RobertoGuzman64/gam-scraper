import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamConciseTitle } from "../mapping/providers/gam/concise-titles.js";
import { resolveGomarizEditorialTitle } from "../mapping/providers/gomariz/editorial-title.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");

const find = (records: readonly ProductRecord[], reference: string): ProductRecord => {
  const record = records.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Gomariz: el encabezado incorpora solo la familia corroborada por el propio anuncio", () => {
  const examples: readonly [string, string][] = [
    ["TE1620", "Plataforma de tijera LGMG S1413EII"],
    ["BA1335", "Plataforma articulada SKYJACK SJ85AJ"],
    ["OR1537", "Plataforma sobre orugas SOCAGE 15S"],
    ["GR1356", "Grupo electrógeno PRAMAC GPW200P-FN"],
    ["MT1661", "Manipulador telescópico JCB 540-140"],
    ["FR1077", "Fregadora industrial Nilfisk BR850-S"],
    ["RO457", "Rodillo compactador Dynapac CC142"]
  ];
  for (const [reference, title] of examples) {
    const source = find(gomariz.products, reference);
    const original = JSON.stringify(source);
    assert.equal(resolveGomarizEditorialTitle(source), title);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.product.title, title);
    assert.equal(prepared.product.description_title, title);
    assert.equal(prepared.product.reference, source.reference);
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.deepEqual(prepared.product.spec, source.specs);
    assert.equal(JSON.stringify(source), original);
  }
});

test("Gomariz: títulos ya completos, fuentes ambiguas y referencias no acreditables permanecen intactos", () => {
  for (const reference of ["TE1618", "TE1746", "GR1113", "PV556", "BA1294", "BT1461"]) {
    const record = find(gomariz.products, reference);
    assert.equal(resolveGomarizEditorialTitle(record), null, reference);
    assert.equal(prepareSourceProduct(record).product.title, record.title, reference);
  }
  const record = find(gomariz.products, "TE1620");
  const bad: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, categoryKey: "alquiler" },
    { ...record, condition: "Nuevo" },
    { ...record, specs: { ...record.specs, Marca: "JLG" } },
    { ...record, specs: { ...record.specs, Modelo: "OTRO" } },
    { ...record, reference: null },
    { ...record, title: "LGMG S1413EII Plataforma" },
    { ...record, title: "LGMG OTRO" },
    { ...record, brand: "JLG" },
    { ...record, model: "OTRO" },
    { ...record, url: record.url.replace("gomarizrent.com", "example.com") },
    { ...record, url: record.url.replace("elevador-tijera", "brazo-articulado") },
    { ...record, url: `${record.url}?campaign=1` },
    { ...record, url: record.url.replace("lgmg-s1413eii", "lgmg-s1413eiii") },
    { ...record, longDescription: "Texto de anuncio que no acredita el tipo de máquina" },
    { ...record, longDescription: null }
  ];
  for (const [index, changed] of bad.entries()) {
    assert.equal(resolveGomarizEditorialTitle(changed), null, String(index));
  }
});

test("GAM: tipos de vehículos confirmados sin tocar lotes ni fichas incompletas", () => {
  const expected = new Map([
    ["6218", "Ciclomotor eléctrico LVNENG LX05"],
    ["6477", "Ciclomotor eléctrico LVNENG LX05"],
    ["6262", "Ciclomotor eléctrico URBAN D2"],
    ["6478", "Motocicleta eléctrica LVNENG LX08"],
    ["6479", "Motocicleta eléctrica LVNENG LX08"],
    ["6813", "Motocicleta eléctrica LVNENG LX08"]
  ]);
  const changed = gam.products.filter((record) => resolveGamConciseTitle(record) !== null);
  assert.deepEqual(new Set(changed.map((record) => record.reference)), new Set(expected.keys()));
  for (const record of changed) {
    const original = JSON.stringify(record);
    const title = expected.get(record.reference ?? "");
    assert.equal(resolveGamConciseTitle(record), title);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.title, title);
    assert.equal(prepared.product.description_title, title);
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.deepEqual(prepared.product.spec, { ...record.specs, "Velocidad de desplazamiento (km/h)": "45 km/h" });
    assert.equal(JSON.stringify(record), original);
  }
  for (const reference of ["6805", "6971", "6987", "6988", "6989", "6993", "6994", "6995", "2364"]) {
    const record = find(gam.products, reference);
    assert.equal(resolveGamConciseTitle(record), null, reference);
    assert.equal(prepareSourceProduct(record).product.title, record.title, reference);
  }
});

test("GAM: no propaga encabezados por motor, modelo, procedencia ni textos contradictorios", () => {
  const record = find(gam.products, "6218");
  const bad: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, categoryKey: "venta" },
    { ...record, condition: "Nuevo" },
    { ...record, reference: "6219" },
    { ...record, title: "LVNENG LX08" },
    { ...record, brand: "URBAN" },
    { ...record, model: "LX08" },
    { ...record, specs: { ...record.specs, Marca: "OTRA" } },
    { ...record, specs: { ...record.specs, Modelo: "LX08" } },
    { ...record, specs: { ...record.specs, "Tipo motor": "Diésel" } },
    { ...record, specs: {} },
    { ...record, url: record.url.replace("online.gamrentals.com", "example.com") },
    { ...record, url: record.url.replace("ciclomotores-electricos", "motocicletas-electricas") },
    { ...record, url: `${record.url}#extra` },
    { ...record, shortDescription: "Vehículo sin familia acreditada" },
    { ...record, longDescription: "Máquina de clase diferente" }
  ];
  for (const [index, changed] of bad.entries()) {
    assert.equal(resolveGamConciseTitle(changed), null, String(index));
  }
});

test("La intervención es local a los títulos y no cambia proveedor ni textos de Mercaeleva", () => {
  assert.equal(gomariz.products.length, 143);
  assert.equal(gam.products.length, 983);
  const changed = gomariz.products.filter((record) => resolveGomarizEditorialTitle(record) !== null);
  assert.equal(changed.length, 127);
  assert.ok(changed.every((record) => record.title !== resolveGomarizEditorialTitle(record)));
  for (const record of gomariz.products) assert.equal(resolveGamConciseTitle(record), null);
  for (const record of gam.products) assert.equal(resolveGomarizEditorialTitle(record), null);
});
