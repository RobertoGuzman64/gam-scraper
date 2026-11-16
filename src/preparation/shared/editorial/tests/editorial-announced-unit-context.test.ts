import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { corroboratedAnnouncedUnitSummary } from "../domain/editorial-source-announced-unit.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { formatEditorialQuantity } from "../domain/editorial-measurements.js";

const original = (reference: string): ProductRecord => accreditedSourceRecord("mercaeleva-original", reference);

const summary = (record: ProductRecord, source: ProductRecord = record): string | null => {
  const facts = resolveEditorialFacts(record);
  return facts ? corroboratedAnnouncedUnitSummary(record, source, facts) : null;
};

test("distingue con horas anunciadas dos unidades reales del mismo modelo y año", () => {
  for (const [firstRef, secondRef, year, firstHours, secondHours] of [
    ["M131-5855", "M281-3486", 2018, 464, 484],
    ["M572-8190", "M205-2951", 2017, 3018, 3355]
  ] as const) {
    const first = original(firstRef);
    const second = original(secondRef);
    const snapshots = [JSON.stringify(first), JSON.stringify(second)];
    assert.equal(first.brand, second.brand);
    assert.equal(first.model, second.model);
    assert.equal(summary(first), `año de fabricación ${year} y ${formatEditorialQuantity(firstHours)} horas anunciadas`);
    assert.equal(summary(second), `año de fabricación ${year} y ${formatEditorialQuantity(secondHours)} horas anunciadas`);
    const preparedFirst = prepareSourceProduct(first);
    const preparedSecond = prepareSourceProduct(second);
    assert.equal(preparedFirst.status, "ready");
    assert.equal(preparedSecond.status, "ready");
    assert.notEqual(preparedFirst.product.description, preparedSecond.product.description);
    assert.match(preparedFirst.product.description ?? "", new RegExp(`${formatEditorialQuantity(firstHours).replace(".", "\\.")} horas anunciadas`));
    assert.match(preparedSecond.product.description ?? "", new RegExp(`${formatEditorialQuantity(secondHours).replace(".", "\\.")} horas anunciadas`));
    assert.equal(preparedFirst.product.sourceUrl, first.url);
    assert.equal(preparedSecond.product.sourceUrl, second.url);
    assert.equal(JSON.stringify(first), snapshots[0]);
    assert.equal(JSON.stringify(second), snapshots[1]);
  }
});

test("reutiliza la misma capacidad en familias diferentes con datos individuales", () => {
  for (const reference of ["M940-4770", "M200-9533", "M095-5362"]) {
    const source = original(reference);
    const fact = resolveEditorialFacts(source);
    assert.ok(fact);
    assert.ok(summary(source));
    assert.match(resolveReusableEditorial(source).short ?? "", /año de fabricación \d{4} y [\d.]+ horas anunciadas/u);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.reference, source.reference);
    assert.equal(prepared.product.sourceUrl, source.url);
  }
});

test("rechaza discrepancias de horas, ausencia de anuncio y cero no estructurado", () => {
  for (const reference of ["M840-8278", "M011-3720", "M005-4474"]) {
    const source = original(reference);
    assert.equal(summary(source), null, reference);
    assert.doesNotMatch(resolveReusableEditorial(source).short ?? "", /horas anunciadas/u);
  }
});

test("no transmite horas o años entre unidades, modelos, fuentes ni configuraciones", () => {
  const source = original("M131-5855");
  const originalSnapshot = JSON.stringify(source);
  const other = original("M281-3486");
  const negatives: ProductRecord[] = [
    { ...source, model: "OTRO MODELO" },
    { ...source, url: "https://example.invalid/maquina/M131-5855" },
    { ...source, providerId: "gam" },
    { ...source, year: "2019", specs: { ...source.specs, "Año de fabricación": "2019" } },
    { ...source, horometer: "999", specs: { ...source.specs, "Horas laborales": "999 h" } },
    { ...source, specs: { ...source.specs, "Horas laborales": "999 h" } },
    { ...source, specs: { ...source.specs, "Año de fabricación": "2019" } },
    { ...source, shortDescription: "Descripción individual del proveedor" },
    { ...source, longDescription: source.longDescription?.replace("HORAS 464", "HORAS 999") ?? null },
    { ...source, longDescription: source.longDescription?.replace("2018", "2019") ?? null },
    { ...source, longDescription: `${source.longDescription} HORAS 999` },
    { ...source, longDescription: `${source.longDescription} opción de uso: HORAS 464` },
    { ...source, longDescription: null }
  ];
  for (const altered of negatives) {
    assert.equal(summary(altered), null);
    assert.doesNotMatch(resolveReusableEditorial(altered).short ?? "", /horas anunciadas/u);
  }
  assert.equal(summary({ ...source, reference: other.reference, url: other.url }, source), null);
  assert.equal(summary(source, other), null);
  assert.equal(summary(other, source), null);
  assert.equal(JSON.stringify(source), originalSnapshot);
});
