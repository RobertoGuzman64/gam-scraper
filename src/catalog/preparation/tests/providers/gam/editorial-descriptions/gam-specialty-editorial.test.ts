import { reconcileGamHorometer } from "../../../../reconciliation/gam-horometer.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamSpecialtyEditorial } from "../../../../mapping/providers/gam/editorial-descriptions/specialty-editorial.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const references = new Set([
  "6606", "6608", "6775", "6978", "6207", "6559", "6560", "1884", "1885", "1886",
  "1887", "1888", "3309", "5079", "6182", "1217", "1216", "211", "213", "215"
]);
const changedShort = new Set(["6606", "6608", "6775", "6978", "6207", "6182", "1217", "1216"]);

const find = (reference: string): ProductRecord => {
  const result = gam.products.find((product) => product.reference === reference);
  assert.ok(result, reference);
  return result;
};

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

test("reescribe 20 descripciones de maquinaria especializada sin perder la identidad ni datos técnicos", () => {
  let changed = 0;
  for (const record of gam.products) {
    const original = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    if (!record.reference || !references.has(record.reference)) {
      assert.equal(resolveGamSpecialtyEditorial(record, record.shortDescription, record.longDescription), null);
      continue;
    }
    const general = prepared.product.description_general;
    assert.ok(general && record.longDescription && record.model && record.brand, record.reference);
    assert.ok(general.length >= 250 && general.length <= 800, record.reference);
    assert.ok(general.length < record.longDescription.length * 0.85, record.reference);
    assert.ok(normalize(general).includes(normalize(record.brand)), record.reference);
    assert.ok(normalize(general).includes(normalize(record.model)), record.reference);
    assert.notEqual(general, record.longDescription, record.reference);
    if (changedShort.has(record.reference)) {
      assert.notEqual(prepared.product.description, record.shortDescription, record.reference);
    }
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    for (const [key, value] of Object.entries(reconcileGamHorometer(record).specs ?? {})) {
      assert.equal(prepared.product.spec[key], value, `${record.reference}:${key}`);
    }
    assert.equal(JSON.stringify(record), original, record.reference);
    changed++;
  }
  assert.equal(changed, 20);
  for (const record of gomariz.products) {
    assert.equal(resolveGamSpecialtyEditorial(record, record.shortDescription, record.longDescription), null);
  }
});

test("bloquea la edición cuando cambia la referencia, la fuente o la preparación anterior", () => {
  const record = find("6606");
  assert.ok(record.shortDescription && record.longDescription);
  const prepared = resolveGamSpecialtyEditorial(record, record.shortDescription, record.longDescription);
  assert.ok(prepared);
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "6608" },
    { ...record, url: `${record.url}?nueva-version=1` },
    { ...record, title: "Otro rodillo" },
    { ...record, brand: "OTRA" },
    { ...record, model: "OTRO" },
    { ...record, externalReference: "OTRO" },
    { ...record, categoryKey: "otro" },
    { ...record, condition: "Nuevo" },
    { ...record, shortDescription: "Texto cambiado" },
    { ...record, longDescription: "Texto cambiado" },
    { ...record, specs: { ...record.specs, Peso: "800 KG" } }
  ];
  for (const variant of variants) {
    assert.equal(resolveGamSpecialtyEditorial(variant, record.shortDescription, record.longDescription), null);
  }
  assert.equal(resolveGamSpecialtyEditorial(record, "Otra descripción", record.longDescription), null);
  assert.equal(resolveGamSpecialtyEditorial(record, record.shortDescription, "Otra descripción general"), null);
});

test("diferencia motores de dos minidumpers y corrige los pesos comerciales sin confundir carga", () => {
  const general = (reference: string): string => prepareSourceProduct(find(reference)).product.description_general ?? "";
  assert.match(general("6559"), /Briggs & Stratton/);
  assert.doesNotMatch(general("6559"), /Rato/i);
  assert.match(general("6560"), /Rato/);
  assert.doesNotMatch(general("6560"), /Briggs/i);
  assert.match(general("6606"), /720 kg.*700 kg/s);
  assert.match(general("6608"), /680 kg.*600 kg/s);
  assert.match(general("6978"), /10\.000 kg.*capacidad.*5\.150 kg.*peso/s);
  assert.match(general("6182"), /11\.000 kg.*m[aá]quina.*2\.300 kg/s);
  assert.match(general("1216"), /no coincide con el t[ií]tulo/);
  assert.match(general("1217"), /no coinciden en el valor de kVA/);
});
