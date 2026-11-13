import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import { assessCommercialYear, commercialAttributeYear, normalizeCommercialYearDescription } from "../year-consistency.js";
import { accreditedSourceRecord } from "../../../testing/domain-cases/accredited-source-samples.js";
import { gamSourceYear } from "../../../catalog/normalization/gam/year.js";

type Source = Pick<ProductRecord,
  "providerId" | "reference" | "url" | "year" | "yearSource" | "shortDescription" | "longDescription">;

const source = (reference: string, sourceYear: string, urlYear: string, longDescription: string,
  yearSource: "descripcion" | "url" = "descripcion"): Source => ({
  providerId: "gam", reference, year: sourceYear, yearSource,
  url: `https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/${reference}-${urlYear}-modelo`,
  shortDescription: `Plataforma de ocasión. Año ${sourceYear}.`, longDescription
});

const yearProduct = (record: Source, year: number, general: string): Pick<ImportCandidate,
  "providerId" | "reference" | "sourceUrl" | "attributes" | "description_general"> => ({
  providerId: record.providerId, sourceUrl: record.url, reference: record.reference,
  attributes: [{ attributeID: 117, value: year }], description_general: general
});

test("corrige afirmaciones erróneas sobre fabricación sin imponer otro año ni tocar el origen", () => {
  const cases = [
    ["6051", "2012", "2012", "Fabricada en el año 2008, esta plataforma tijera ofrece estabilidad.",
      "Esta plataforma tijera ofrece estabilidad."],
    ["6158", "2014", "2014", "Fabricada en el año 2013, esta plataforma ofrece estabilidad.",
      "Esta plataforma ofrece estabilidad."],
    ["6911", "2008", "2014", "La plataforma JLG, fabricada en 2006 por JLG Industries, ofrece estabilidad.",
      "La plataforma JLG, fabricada por JLG Industries, ofrece estabilidad."],
    ["6930", "2008", "2014", "La plataforma JLG, fabricada en 2014 por JLG Industries, ofrece estabilidad.",
      "La plataforma JLG, fabricada por JLG Industries, ofrece estabilidad."],
    ["6883", "2014", "2014", "Fabricada en el año 2016, esta plataforma ofrece estabilidad.",
      "Esta plataforma ofrece estabilidad."],
    ["6869", "2016", "2008", "La plataforma GENIE, fabricada en 2008, es fiable. La plataforma GENIE de 2008 es versátil.",
      "La plataforma GENIE es fiable. La plataforma GENIE es versátil."],
    ["5855", "2014", "2014", "Unidad con serie registrada y año de fabricación 2022 según su descripción original.",
      "Unidad con serie registrada y año de fabricación pendiente de confirmación."],
    ["6865", "2015", "2015", "La URL sitúa la unidad en 2015 pero la descripción general habla de fabricación en 2018; el año requiere confirmación.",
      "El año de fabricación de esta unidad requiere confirmación."]
  ] as const;
  for (const [reference, sourceYear, urlYear, original, expected] of cases) {
    const record = source(reference, sourceYear, urlYear, original, reference === "5855" ? "url" : "descripcion");
    const before = JSON.stringify(record);
    const normalized = normalizeCommercialYearDescription(record, original);
    assert.equal(normalized, expected, reference);
    assert.equal(normalizeCommercialYearDescription(record, normalized), normalized, reference);
    assert.deepEqual(assessCommercialYear(yearProduct(record, Number(sourceYear), normalized ?? "")).inconsistentClaims, [], reference);
    assert.equal(JSON.stringify(record), before, reference);
  }
});

test("conserva las afirmaciones compatibles, fechas de otra naturaleza y textos sin respaldo", () => {
  const original = "Fabricada en el año 2016, esta plataforma se revisó en 2021 y se matriculó en 2017.";
  const verified = source("7001", "2016", "2016", original);
  assert.equal(normalizeCommercialYearDescription(verified, original), original);
  assert.deepEqual(assessCommercialYear(yearProduct(verified, 2016, original)).inconsistentClaims, []);
  const unavailable = { ...verified, year: null };
  assert.equal(normalizeCommercialYearDescription(unavailable, "Fabricada en el año 2012, esta plataforma es fiable."),
    "Fabricada en el año 2012, esta plataforma es fiable.");
  const noEvidence = { ...verified, shortDescription: "Sin año declarado" };
  assert.equal(normalizeCommercialYearDescription(noEvidence, "Fabricada en el año 2012, esta plataforma es fiable."),
    "Fabricada en el año 2012, esta plataforma es fiable.");
  const nonGam = { ...verified, providerId: "gomariz" };
  assert.equal(normalizeCommercialYearDescription(nonGam, original), original);
});

test("detecta contradicciones reales sin interpretar años de matriculación, referencias o modelos", () => {
  const record = source("6869", "2016", "2008", "Fabricada en el año 2008, la plataforma es fiable.");
  const result = assessCommercialYear(yearProduct(record, 2016,
    "La plataforma GENIE GS-3246, fabricada en 2008, es compacta. Matriculada en 2020."));
  assert.deepEqual(result.inconsistentClaims, [2008]);
  assert.equal(result.attributeYear, 2016);
  assert.equal(result.urlYear, 2008);
  assert.equal(result.urlAttributeDisagreement, true);
  assert.equal(assessCommercialYear(yearProduct(record, 2016,
    "La plataforma modelo 1930ES fue revisada en 2020.")).inconsistentClaims.length, 0);
  assert.equal(assessCommercialYear(yearProduct({ ...record, url: "https://example.com/6869-2008-modelo" }, 2016,
    "Máquina revisada en 2020.")).urlAttributeDisagreement, false);
});

test("el año del propio atributo solo se usa si el contrato proporciona un número válido", () => {
  const record = source("6869", "2016", "2008", "Fabricada en el año 2008, la plataforma es fiable.");
  const input = yearProduct(record, 2016, "Fabricada en el año 2008, la plataforma es fiable.");
  assert.deepEqual(assessCommercialYear({ ...input, attributes: [] }).inconsistentClaims, []);
  assert.equal(assessCommercialYear({ ...input, attributes: [{ attributeID: 117, value: "2016" }] }).attributeYear, null);
});


test("el año de atributo requiere una única asignación válida y preserva los límites del contrato", () => {
  const record = source("6869", "2016", "2008", "");
  const base = yearProduct(record, 2016, "");
  for (const year of [1900, 2099]) {
    const attributes = [{ attributeID: 117, value: year }];
    assert.equal(commercialAttributeYear(attributes), year);
    assert.equal(assessCommercialYear({ ...base, attributes }).attributeYear, year);
  }
  for (const attributes of [
    [],
    [{ attributeID: 117, value: "2016" }],
    [{ attributeID: 117, value: 1899 }],
    [{ attributeID: 117, value: 2100 }],
    [{ attributeID: 117, value: 2016.5 }],
    [{ attributeID: 117, value: 2016 }, { attributeID: 117, value: 2016 }]
  ]) {
    assert.equal(commercialAttributeYear(attributes), null);
    assert.equal(assessCommercialYear({ ...base, attributes }).attributeYear, null);
  }
  assert.equal(commercialAttributeYear([{ attributeID: 50, value: 2016 },
    { attributeID: 117, value: 2015 }]), 2015);
});

test("los once años discordantes conservan la procedencia del origen sin imponer el slug", async () => {
  const cases = [
    ["5961", 2015, 2018, "descripcion"], ["6236", 2018, 2017, "descripcion"],
    ["6588", 2000, 2019, "titulo"], ["6590", 2000, 2019, "titulo"],
    ["6797", 2015, 2016, "descripcion"], ["6869", 2016, 2008, "descripcion"],
    ["6870", 2016, 2008, "descripcion"], ["6909", 2007, 2008, "descripcion"],
    ["6911", 2008, 2014, "descripcion"], ["6921", 2016, 2017, "descripcion"],
    ["6930", 2008, 2014, "descripcion"]
  ] as const;
  for (const [reference, manufacture, url, provenance] of cases) {
    const record = accreditedSourceRecord("gam-original", reference);
    assert.equal(record.year, String(manufacture), reference);
    assert.equal(record.yearSource, provenance, reference);
    const accepted = gamSourceYear(record);
    assert.equal(accepted, provenance === "titulo" ? null : String(manufacture), reference);
    const input = yearProduct(record, manufacture, "");
    const assessment = assessCommercialYear(accepted === null ? { ...input, attributes: [] } : input);
    assert.equal(assessment.urlYear, url, reference);
    assert.equal(assessment.attributeYear, accepted === null ? null : manufacture, reference);
    assert.equal(assessment.urlAttributeDisagreement, accepted !== null, reference);
  }
});

test("los slugs de otra unidad, otros dominios y rutas no representativas no acreditan fechas", () => {
  const base = source("6588", "2000", "2019", "", "url");
  for (const url of [
    base.url.replace("6588-", "6590-"),
    base.url.replace("https://online.gamrentals.com", "https://example.com"),
    base.url.replace("6588-2019-modelo", "6588-preparapedidos-2000-kg"),
    `${base.url}?referencia=6588`,
    `${base.url}#ficha`
  ]) {
    const result = assessCommercialYear(yearProduct({ ...base, url }, 2000, ""));
    assert.equal(result.urlYear, null, url);
    assert.equal(result.urlAttributeDisagreement, false, url);
  }
  assert.deepEqual(assessCommercialYear({ ...yearProduct(base, 2000, ""), attributes: [] }), {
    attributeYear: null, urlYear: 2019, inconsistentClaims: [], urlAttributeDisagreement: false
  });
});
