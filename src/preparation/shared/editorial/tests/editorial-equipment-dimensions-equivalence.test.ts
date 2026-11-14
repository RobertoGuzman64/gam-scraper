import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveVerifiedTechnicalBrief } from "../domain/editorial-technical-brief.js";

const gamPlatform = accreditedSourceRecord("gam-original", "6901");
const gomarizPlatform = accreditedSourceRecord("gomariz-original", "TE1591");
const gamForklift = accreditedSourceRecord("gam-original", "2057");
const gamMast = accreditedSourceRecord("gam-original", "6755");
const mercaelevaMast = accreditedSourceRecord("mercaeleva-original", "M722-8895");

const anotherUnit = (source: ProductRecord, specs: NonNullable<ProductRecord["specs"]>): ProductRecord => {
  const reference = `${source.reference}-OTRA`;
  const url = source.providerId === "gam" ? source.url?.replace(`/${source.reference}-`, `/${reference}-`) :
    source.providerId === "gomariz" ? `${source.url?.replace(/\/$/u, "")}-otra/` :
      source.url?.replace(source.reference ?? "", reference);
  return {
    ...source, reference, url: url ?? null, year: null, horometer: null, serialNumber: null,
    shortDescription: null, longDescription: null, specs: { ...source.specs, ...specs }
  };
};

test("RE015 conserva dimensiones físicas acreditadas de GAM y Gomariz sin confundir conceptos de altura", () => {
  for (const [source, expected] of [
    [gamPlatform, { length: 5.7, width: 2.1, height: 2.16 }],
    [gomarizPlatform, { length: 2.42, width: 1.18, height: null }],
    [gamForklift, { length: 7.424, width: 2.541, height: 4.193 }]
  ] as const) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.lengthM, expected.length, source.reference ?? "");
    assert.equal(facts?.widthM, expected.width, source.reference ?? "");
    assert.equal(facts?.heightM, expected.height, source.reference ?? "");
    const general = resolveReusableEditorial(source).general ?? "";
    assert.match(general, /longitud de /u);
    assert.match(general, /anchura de /u);
    assert.equal(general.includes("altura del equipo de "), expected.height !== null);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.match(prepared.product.description_general ?? "", /longitud de /u);
    assert.equal(JSON.stringify(source), snapshot);
  }
  assert.equal(resolveEditorialFacts(gomarizPlatform)?.workingHeightM, 10);
  assert.equal(resolveEditorialFacts(gamForklift)?.liftingHeightM, 7);
  assert.notEqual(resolveEditorialFacts(gamForklift)?.liftingHeightM, resolveEditorialFacts(gamForklift)?.heightM);
});

test("RE015 una unidad compatible reutiliza conversiones sin arrastrar las dimensiones del original", () => {
  for (const [source, specs, expected, old] of [
    [gamPlatform, { Longitud: "6.2 m", Anchura: "2.3 m", Altura: "2.4 m" },
      ["longitud de 6,2 m", "anchura de 2,3 m", "altura del equipo de 2,4 m"],
      ["longitud de 5,7 m", "anchura de 2,1 m", "altura del equipo de 2,16 m"]],
    [gomarizPlatform, { Longitud: "2.55 m", Anchura: "1.25 m" },
      ["longitud de 2,55 m", "anchura de 1,25 m"],
      ["longitud de 2,42 m", "anchura de 1,18 m"]]
  ] as const) {
    const next = anotherUnit(source, specs);
    const snapshot = JSON.stringify([source, next]);
    const composed = resolveReusableEditorial(next).general ?? "";
    const prepared = prepareSourceProduct(next);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.reference, next.reference);
    assert.equal(prepared.product.sourceUrl, next.url);
    for (const text of expected) {
      assert.ok(composed.includes(text), `${next.reference}: ${text}`);
      assert.ok((prepared.product.description_general ?? "").includes(text), `${next.reference}: ${text}`);
    }
    for (const text of old) assert.ok(!composed.includes(text), `${next.reference}: ${text}`);
    assert.equal(resolveVerifiedTechnicalBrief(source, next), null);
    assert.equal(JSON.stringify([source, next]), snapshot);
  }
});

test("RE015 no interpreta dimensiones ausentes, contradictorias, sin unidad o fuera de concepto", () => {
  const source = gamPlatform;
  for (const [spec, value, property, claim] of [
    ["Longitud", "6200 kg", "lengthM", /longitud de /u],
    ["Longitud", "6.2 m o 6.5 m", "lengthM", /longitud de /u],
    ["Anchura", "2300", "widthM", /anchura de /u],
    ["Altura", "2400 kg", "heightM", /altura del equipo de /u]
  ] as const) {
    const invalid = { ...source, specs: { ...source.specs, [spec]: value } };
    assert.equal(resolveEditorialFacts(invalid)?.[property], null);
    assert.doesNotMatch(resolveReusableEditorial(invalid).general ?? "", claim);
  }
  const withoutLength = { ...source.specs };
  delete withoutLength.Longitud;
  assert.equal(resolveEditorialFacts({ ...source, specs: withoutLength })?.lengthM, null);
  for (const invalid of [
    { ...source, providerId: "proveedor-ajeno" },
    { ...source, url: "https://example.invalid/es/maquinaria/6901-plataforma" },
    { ...source, model: "OTRA-VARIANTE" },
    { ...source, reference: "OTRA-UNIDAD" }
  ]) assert.equal(resolveEditorialFacts(invalid), null);
});

test("RE016 centro de carga, radio de giro y mástil histórico tienen concepto y unidad propios", () => {
  const facts = resolveEditorialFacts(gamForklift);
  assert.equal(facts?.loadCenterMm, 1200);
  assert.equal(facts?.turningRadiusM, 4.637);
  assert.equal(facts?.liftingHeightM, 7);
  const text = resolveReusableEditorial(gamForklift).general ?? "";
  assert.match(text, /centro de carga declarado de 1\.200 mm/u);
  assert.match(text, /radio de giro declarado de 4,637 m/u);
  for (const source of [gamMast, mercaelevaMast]) {
    assert.equal(resolveEditorialFacts(source)?.mastType, "tríplex");
    assert.match(resolveReusableEditorial(source).general ?? "", /mástil tríplex declarado/u);
    assert.match(prepareSourceProduct(source).product.description_general ?? "", /mástil tríplex/u);
  }
});

test("RE016 la unidad nueva usa sus medidas propias y no hereda las originales", () => {
  const next = anotherUnit(gamForklift, { "Centro de carga": "1400 mm", "Radio de giro": "4.9 m" });
  const facts = resolveEditorialFacts(next);
  assert.equal(facts?.loadCenterMm, 1400);
  assert.equal(facts?.turningRadiusM, 4.9);
  const result = resolveReusableEditorial(next).general ?? "";
  const prepared = prepareSourceProduct(next);
  assert.equal(prepared.status, "ready");
  assert.match(result, /centro de carga declarado de 1\.400 mm/u);
  assert.match(result, /radio de giro declarado de 4,9 m/u);
  assert.match(prepared.product.description_general ?? "", /centro de carga declarado de 1\.400 mm/u);
  assert.doesNotMatch(result, /centro de carga declarado de 1\.200 mm|radio de giro declarado de 4,637 m/u);
  const crossUnit = resolveReusableEditorial(next, null, gamForklift).general ?? "";
  assert.doesNotMatch(crossUnit, /centro de carga declarado|radio de giro declarado/u);
  const mast = anotherUnit(mercaelevaMast, { "Tipo de mástil": "DÚPLEX" });
  assert.equal(resolveEditorialFacts(mast)?.mastType, "dúplex");
  assert.match(resolveReusableEditorial(mast).general ?? "", /mástil dúplex declarado/u);
  assert.doesNotMatch(resolveReusableEditorial(mast).general ?? "", /mástil tríplex/u);
});

test("RE016 rechaza magnitudes incompatibles, mástiles no acreditados y unidades ajenas", () => {
  for (const [spec, value, property, claim] of [
    ["Centro de carga", "1200 kg", "loadCenterMm", /centro de carga declarado/u],
    ["Centro de carga", "1200 mm o 1400 mm", "loadCenterMm", /centro de carga declarado/u],
    ["Radio de giro", "4637 kg", "turningRadiusM", /radio de giro declarado/u],
    ["Radio de giro", "4.637 m o 5 m", "turningRadiusM", /radio de giro declarado/u]
  ] as const) {
    const invalid = { ...gamForklift, specs: { ...gamForklift.specs, [spec]: value } };
    assert.equal(resolveEditorialFacts(invalid)?.[property], null);
    assert.doesNotMatch(resolveReusableEditorial(invalid).general ?? "", claim);
  }
  const optional = { ...gamMast, specs: { ...gamMast.specs, "Tipo Mástil": "Opcional" } };
  assert.equal(resolveEditorialFacts(optional)?.mastType, null);
  assert.doesNotMatch(resolveReusableEditorial(optional).general ?? "", /mástil tríplex/u);
  const wrongProvider = { ...mercaelevaMast, providerId: "gam" };
  assert.equal(resolveEditorialFacts(wrongProvider), null);
});
