import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { corroboratedSourceUnitBrief } from "../domain/editorial-source-unit-brief.js";
import { formatEditorialQuantity } from "../domain/editorial-measurements.js";

const original = (reference: string): ProductRecord => accreditedSourceRecord("gam-original", reference);
const short = "Plataforma de tijera eléctrica SNORKEL S3219E, con altura de elevación de 8 m y capacidad de 250 kg.";

test("recupera contexto acreditado de unidades GAM sin volver a narrar el modelo", () => {
  for (const [firstRef, secondRef, firstHours, secondHours] of [
    ["6854", "6855", "410", "234"],
    ["6063", "6064", "964", "946"],
    ["6819", "6820", "1962", "2084"],
    ["6682", "6703", "22192", "22498"]
  ] as const) {
    const first = original(firstRef);
    const second = original(secondRef);
    const before = [JSON.stringify(first), JSON.stringify(second)];
    const preparedFirst = prepareSourceProduct(first);
    const preparedSecond = prepareSourceProduct(second);
    assert.equal(preparedFirst.status, "ready");
    assert.equal(preparedSecond.status, "ready");
    assert.notEqual(preparedFirst.product.description, preparedSecond.product.description);
    assert.match(preparedFirst.product.description ?? "", /año de fabricación \d{4}/u);
    assert.match(preparedSecond.product.description ?? "", /año de fabricación \d{4}/u);
    assert.ok(preparedFirst.product.description?.includes(`horómetro declarada de ${formatEditorialQuantity(Number(firstHours))} horas`));
    assert.ok(preparedSecond.product.description?.includes(`horómetro declarada de ${formatEditorialQuantity(Number(secondHours))} horas`));
    assert.equal(preparedFirst.product.sourceUrl, first.url);
    assert.equal(preparedSecond.product.sourceUrl, second.url);
    assert.equal(JSON.stringify(first), before[0]);
    assert.equal(JSON.stringify(second), before[1]);
  }
});

test("distingue año publicado y horómetro sustituido sin inventar horas", () => {
  const replaced = original("6778");
  const numeric = original("6854");
  const replaceShort = prepareSourceProduct(replaced).product.description ?? "";
  assert.match(replaceShort, /año de fabricación 2017/u);
  assert.doesNotMatch(replaceShort, /lectura de horómetro declarada/u);
  assert.match(prepareSourceProduct(numeric).product.description ?? "", /horómetro declarada de 410 horas/u);
  const alsoReplaced = original("6912");
  assert.doesNotMatch(prepareSourceProduct(alsoReplaced).product.description ?? "", /lectura de horómetro declarada/u);
});

test("rechaza identidad cruzada, procedencia ajena, año discordante, opciones y horas no acreditadas", () => {
  const source = original("6854");
  assert.match(corroboratedSourceUnitBrief(source, source, short) ?? "", /año de fabricación 2018/u);
  const negative: ProductRecord[] = [
    { ...source, reference: "OTRA" },
    { ...source, url: "https://origen.example/ficha/OTRA" },
    { ...source, providerId: "otro" },
    { ...source, brand: "OTRA MARCA" },
    { ...source, model: "OTRO MODELO" },
    { ...source, condition: "Nuevo" },
    { ...source, year: "2019" },
    { ...source, specs: { ...source.specs, "Año de fabricación": "2019" } },
    { ...source, title: "Ficha sin marca ni modelo" }
  ];
  for (const prepared of negative) assert.equal(corroboratedSourceUnitBrief(source, prepared, short), null);
  for (const otherSource of [
    { ...source, shortDescription: "Año 2019, máquina del año 2018" },
    { ...source, shortDescription: "No se acredita el año 2018" },
    { ...source, shortDescription: "Máquina de 2018 sin año anunciado" },
    { ...source, shortDescription: null }
  ]) assert.equal(corroboratedSourceUnitBrief(otherSource, otherSource, short), null);
  assert.equal(corroboratedSourceUnitBrief(source, source, `${short} Año 2018.`), null);
  const wrongHours = { ...source, horometer: "999 horas" };
  const summary = corroboratedSourceUnitBrief(wrongHours, wrongHours, short) ?? "";
  assert.match(summary, /año de fabricación 2018/u);
  assert.doesNotMatch(summary, /lectura de horómetro declarada/u);
});
