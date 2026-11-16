import assert from "node:assert/strict";
import test from "node:test";
import { accreditedSourceRecord } from "../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { parseSpecByRule } from "../../../tools/gam/seed/internal/spec.js";
import { reconcileMercaelevaVerifiedPlatformSourceSpecs } from "../../../preparation/mercaeleva/technical/evidence/verified-platform-source-specs.js";
import { normalizeSpecsObject } from "../normalize-specs.js";
import { parseDimension, parseDimensionRect, parseYear } from "../spec-parsers.js";

test("N02 conserva modelos y valores técnicos con palabras que forman parte de la descripción", () => {
  for (const reference of ["4029", "4030"]) {
    const source = accreditedSourceRecord("gam-original", reference);
    const original = structuredClone(source);
    const model = source.specs?.Modelo;
    assert.equal(model, source.model, reference);
    assert.equal(normalizeSpecsObject(source.specs).normalized.Modelo, model, reference);
    assert.equal(normalizeSpecsObject({ Modelo: model }).normalized.Modelo, model, reference);
    assert.equal(prepareSourceProduct(source).product.spec.Modelo, model, reference);
    assert.deepEqual(source, original, reference);
  }
  const charger = "Cargador externo 2A para batería de 10 Ah";
  assert.equal(normalizeSpecsObject({ "Cargador de batería": charger }).normalized["Cargador de batería"], charger);
  assert.deepEqual(normalizeSpecsObject({ Modelo: ["BCS S16H Descarga alto", "BCS S16L Descarga baja"] }).normalized.Modelo,
    "BCS S16H Descarga alto BCS S16L Descarga baja");
  for (const value of ["Modelo", "peso", "Altura (mm)", "Carga Máxima (kg)", "Cargador de batería"]) {
    assert.equal(normalizeSpecsObject({ Modelo: value }).normalized.Modelo, undefined, value);
  }
  assert.equal(normalizeSpecsObject({ Modelo: ["Modelo", "BCS S16L Descarga baja"] }).normalized.Modelo,
    "BCS S16L Descarga baja");
});

test("N07 interpreta geometría completa en milímetros sin perder decimales ni mezclar unidades", () => {
  for (const [raw, expected] of [
    ["1180x170x55 mm", { largo: 1180, ancho: 170, grosor: 55 }],
    ["1,2 x 0,1 x 0,04 m", { largo: 1200, ancho: 100, grosor: 40 }],
    ["1,2 m × 10 cm × 40 mm", { largo: 1200, ancho: 100, grosor: 40 }],
    ["120 x 10 x 4 cm", { largo: 1200, ancho: 100, grosor: 40 }],
    ["1.200 x 100 x 40 mm", { largo: 1200, ancho: 100, grosor: 40 }],
    ["1180 mm", { largo: 1180, ancho: null, grosor: null }],
    ["1200×80 mm", { largo: 1200, ancho: 80, grosor: null }]
  ] as const) {
    assert.deepEqual(parseDimension(raw), expected, raw);
    assert.deepEqual(normalizeSpecsObject({ "Dimensiones Horquillas": raw }).normalized["Dimensiones horquillas (mm)"], expected, raw);
  }
  assert.deepEqual(parseSpecByRule("Dimensiones horquillas (mm)", "1,2 x 0,1 x 0,04 m"), [1200, 100, 40]);
  assert.deepEqual(parseDimensionRect("1,2 m x 80 cm"), { ancho: 1200, largo: 800 });
  assert.deepEqual(parseDimensionRect("1,83 x 0,76 metros"), { ancho: 1830, largo: 760 });
  assert.deepEqual(parseDimensionRect("2,27 x 1,12 m metros"), { ancho: 2270, largo: 1120 });
});

test("N07 descarta medidas contaminadas, incompletas, imposibles o con unidades incompatibles", () => {
  const source = accreditedSourceRecord("gam-original", "5855");
  const original = structuredClone(source);
  const contaminated = source.specs?.["Dimensiones Cesta"];
  assert.equal(contaminated, "1 1,8 x 0,8 8 8 x 0 metros");
  assert.equal(normalizeSpecsObject({ "Dimensiones Cesta": contaminated }).normalized["Dimensiones cesta (mm)"], undefined);
  assert.deepEqual(source, original);
  for (const raw of [
    "1 1,8 x 0,8 8 8 x 0 metros", "1,2 x 0,1 x 0,04 x 0,02 m",
    "1,2 m x 10 x 40 mm", "1,2 x 10 cm x 40 mm",
    "1,2 x 0,1 x 0,04 kg", "1200x100x0 mm",
    "1200-100-40 mm", "1200x100 mm y 40 mm", "22000x100x40 mm", "1200x100x40"
  ]) {
    const isValidUnitless = raw === "1200x100x40";
    assert.deepEqual(parseDimension(raw), isValidUnitless ? { largo: 1200, ancho: 100, grosor: 40 } : null, raw);
  }
  for (const raw of ["1 76 83X0 metros", "1400x700x1100 metros", "1400x700 metros", "1,83 x 0,76"]) {
    assert.equal(parseDimensionRect(raw), null, raw);
  }
});

test("N08 solo acepta años de fabricación de cuatro cifras y no infiere año de título o URL", () => {
  const source = accreditedSourceRecord("mercaeleva-original", "M547-1056");
  const original = structuredClone(source);
  assert.equal(source.specs?.["Año de fabricación"], "28");
  assert.equal(source.year, null);
  assert.equal(normalizeSpecsObject(source.specs).normalized.Año, undefined);
  assert.equal(normalizeSpecsObject(source.specs).droppedNullLikeKeys.includes("Año"), true);
  assert.equal(parseSpecByRule("Año", "28"), null);
  assert.deepEqual(source, original);
  for (const valid of ["1900", "2000", "2012", "2026", 2025]) {
    assert.equal(parseYear(valid), Number(valid));
    assert.equal(normalizeSpecsObject({ "Año de fabricación": valid }).normalized.Año, Number(valid));
  }
  for (const invalid of ["28", 28, "1899", "2099", String(new Date().getUTCFullYear() + 1), "2012.0", "2012/2013", "S85 2020", "", null]) {
    assert.equal(parseYear(invalid), null, String(invalid));
    assert.equal(normalizeSpecsObject({ "Año de fabricación": invalid }).normalized.Año, undefined, String(invalid));
  }
  assert.equal(normalizeSpecsObject({ Modelo: "S85", "Año de fabricación": "28" }).normalized.Año, undefined);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.product.spec["Año de fabricación"], "2008");
  assert.equal(normalizeSpecsObject(prepared.product.spec).normalized.Año, 2008);
  for (const variant of [
    { ...source, url: `${source.url}?variante=distinta` },
    { ...source, title: `${source.title} AÑO 2025` },
    { ...source, model: `${source.model}-2024` },
    { ...source, specs: { ...source.specs, "Año de fabricación": "2028" } }
  ]) {
    assert.equal(reconcileMercaelevaVerifiedPlatformSourceSpecs(variant), variant);
    assert.equal(normalizeSpecsObject(variant.specs).normalized.Año, undefined);
  }
  assert.equal(parseSpecByRule("Año", "2012"), 2012);
  assert.equal(parseSpecByRule("Año", "2099"), null);
});
