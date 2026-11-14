import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";

const gamForklift = accreditedSourceRecord("gam-original", "6755");
const gamHeavyForklift = accreditedSourceRecord("gam-original", "2057");
const mercaelevaForklift = accreditedSourceRecord("mercaeleva-original", "M722-8895");
const gamArticulated = accreditedSourceRecord("gam-original", "6984");
const gamScissor = accreditedSourceRecord("gam-original", "6911");

const anotherUnit = (source: ProductRecord, specs: NonNullable<ProductRecord["specs"]>): ProductRecord => {
  const reference = `${source.reference}-OTRA`;
  const url = source.providerId === "gam" ? source.url?.replace(`/${source.reference}-`, `/${reference}-`) :
    source.url?.replace(source.reference ?? "", reference);
  return {
    ...source, reference, url: url ?? null, year: null, horometer: null, serialNumber: null,
    shortDescription: null, longDescription: null, specs: { ...source.specs, ...specs }
  };
};

test("RE011 conserva la elevación y el mástil acreditados sin confundir altura del equipo", () => {
  for (const [source, height, mast] of [
    [gamHeavyForklift, 7, null],
    [gamForklift, 4.7, "tríplex"],
    [mercaelevaForklift, 5.4, "tríplex"]
  ] as const) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "carretilla-elevadora");
    assert.equal(facts?.liftingHeightM, height);
    assert.equal(facts?.mastType, mast);
    assert.equal(facts?.workingHeightM, null);
    const general = resolveReusableEditorial(source).general ?? "";
    assert.match(general, new RegExp(`altura de elevación de ${String(height).replace(".", ",")} m`, "u"));
    assert.equal(general.includes("mástil tríplex declarado"), mast === "tríplex");
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.match(prepared.product.description_general ?? "", /altura (?:máxima )?de elevación/u);
    assert.equal(JSON.stringify(source), snapshot);
  }
  assert.notEqual(resolveEditorialFacts(gamHeavyForklift)?.liftingHeightM,
    resolveEditorialFacts(gamHeavyForklift)?.heightM);
});

test("RE011 una nueva carretilla usa su elevación y mástil sin heredar los de la unidad anterior", () => {
  for (const [source, specs, claim, mast] of [
    [gamForklift, { "Altura de elevación (mm)": "5200 mm", "Tipo Mástil": "DUPLEX" }, "5,2 m", "dúplex"],
    [mercaelevaForklift, { "Altura máxima de elevación": "6100 mm", "Tipo de mástil": "DÚPLEX" }, "6,1 m", "dúplex"]
  ] as const) {
    const unit = anotherUnit(source, specs);
    const facts = resolveEditorialFacts(unit);
    assert.equal(facts?.family, "carretilla-elevadora");
    assert.equal(facts?.mastType, mast);
    const composed = resolveReusableEditorial(unit).general ?? "";
    const prepared = prepareSourceProduct(unit);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.reference, unit.reference);
    assert.equal(prepared.product.sourceUrl, unit.url);
    assert.ok(composed.includes(`altura de elevación de ${claim}`));
    assert.ok(composed.includes("mástil dúplex declarado"));
    assert.ok((prepared.product.description_general ?? "").includes(`altura de elevación de ${claim}`));
    assert.doesNotMatch(composed, /mástil tríplex declarado|altura de elevación de 4,7 m|altura de elevación de 5,4 m/u);
  }
});

test("RE011 rechaza elevaciones ambiguas, unidades erróneas y mástiles incompatibles", () => {
  for (const invalidHeight of ["5200 kg", "5200 mm o 6100 mm", "5200", "65000 mm"]) {
    const invalid = { ...gamForklift, specs: { ...gamForklift.specs, "Altura de elevación (mm)": invalidHeight } };
    assert.equal(resolveEditorialFacts(invalid)?.liftingHeightM ?? null, null);
    assert.doesNotMatch(resolveReusableEditorial(invalid).general ?? "", /altura de elevación de /u);
  }
  const incompatibleMast = {
    ...gamForklift, specs: { ...gamForklift.specs, "Tipo Mástil": "TRIPLEX", "Tipo de mástil": "DÚPLEX" }
  };
  assert.equal(resolveEditorialFacts(incompatibleMast)?.mastType, null);
  assert.doesNotMatch(resolveReusableEditorial(incompatibleMast).general ?? "", /mástil (?:tríplex|dúplex) declarado/u);
  const validMast = {
    ...gamForklift, specs: { ...gamForklift.specs, "Tipo Mástil": "TRIPLEX", "Tipo de mástil": "TRÍPLEX" }
  };
  assert.equal(resolveEditorialFacts(validMast)?.mastType, "tríplex");
  const noElevation = { ...gamForklift, specs: { ...gamForklift.specs } };
  delete noElevation.specs["Altura de elevación (mm)"];
  assert.equal(resolveEditorialFacts(noElevation)?.liftingHeightM, null);
  assert.doesNotMatch(resolveReusableEditorial(noElevation).general ?? "", /altura de elevación de /u);
  for (const invalid of [
    { ...gamForklift, providerId: "proveedor-ajeno" },
    { ...gamForklift, url: "https://example.invalid/6755-toyota" },
    { ...gamForklift, model: "MODELO-AJENO" },
    { ...gamForklift, reference: "REFERENCIA-AJENA" }
  ]) assert.equal(resolveEditorialFacts(invalid), null);
});

test("RE024 acredita pendiente superable histórica de unidades GAM en preparación", () => {
  for (const [source, value] of [
    [gamArticulated, 25],
    [gamScissor, 25],
    [accreditedSourceRecord("gam-original", "6901"), 40]
  ] as const) {
    const snapshot = JSON.stringify(source);
    assert.equal(resolveEditorialFacts(source)?.gradeabilityPercent, value);
    assert.match(resolveReusableEditorial(source).general ?? "", new RegExp(`pendiente superable declarada de ${value} %`, "u"));
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.match(prepared.product.description_general ?? "", new RegExp(`pendiente superable declarada de ${value} %`, "u"));
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE024 otra unidad compatible reutiliza su porcentaje sin heredar el del modelo", () => {
  const unit = anotherUnit(gamArticulated, { "Pendiente superable": "30%" });
  assert.equal(resolveEditorialFacts(unit)?.gradeabilityPercent, 30);
  assert.match(resolveReusableEditorial(unit).general ?? "", /pendiente superable declarada de 30 %/u);
  const prepared = prepareSourceProduct(unit);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description_general ?? "", /pendiente superable declarada de 30 %/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /pendiente superable declarada de 25 %/u);
  const withoutSlope = { ...unit, specs: { ...unit.specs } };
  delete withoutSlope.specs["Pendiente superable"];
  assert.equal(resolveEditorialFacts(withoutSlope)?.gradeabilityPercent, null);
  assert.doesNotMatch(resolveReusableEditorial(withoutSlope).general ?? "", /pendiente superable declarada/u);
});

test("RE024 no acepta porcentajes contradictorios, fuera de rango ni procedencias ajenas", () => {
  for (const value of ["30 kg", "25% o 40%", "150%", "30", "25 grados"]) {
    const invalid = { ...gamArticulated, specs: { ...gamArticulated.specs, "Pendiente superable": value } };
    assert.equal(resolveEditorialFacts(invalid)?.gradeabilityPercent ?? null, null);
    assert.doesNotMatch(resolveReusableEditorial(invalid).general ?? "", /pendiente superable declarada/u);
  }
  for (const invalid of [
    { ...gamArticulated, providerId: "proveedor-ajeno" },
    { ...gamArticulated, url: "https://example.invalid/articulada" },
    { ...gamArticulated, brand: "MARCA-AJENA" },
    { ...gamArticulated, model: "MODELO-AJENO" },
    { ...gamArticulated, reference: "REFERENCIA-AJENA" }
  ]) assert.equal(resolveEditorialFacts(invalid), null);
});
