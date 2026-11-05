import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamVerifiedConciseGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/verified-concise-long.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const refs = [
  "5994", "5989", "5990", "4662", "6166", "4844", "4657", "6172", "6164", "4656",
  "4723", "4655", "4653", "4724", "4813", "5903", "2251", "2259", "2249", "2136"
] as const;

const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

test("condensa 20 descripciones generales con modelo acreditado y sin mutar el origen", () => {
  assert.equal(new Set(refs).size, 20);
  for (const reference of refs) {
    const original = find(reference);
    const originalJson = JSON.stringify(original);
    const prepared = prepareSourceProduct(original);
    const general = prepared.product.description_general;
    assert.ok(general, reference);
    assert.ok(general.length >= 250 && general.length <= 800, reference);
    assert.ok(original.longDescription && original.longDescription.length > 2000, reference);
    assert.ok(general.length < original.longDescription.length * 0.45, reference);
    assert.notEqual(general, original.longDescription, reference);
    assert.ok(original.model && normalize(general).includes(normalize(original.model)), reference);
    assert.ok(original.brand && normalize(general).includes(normalize(original.brand)), reference);
    assert.doesNotMatch(general, /soluci[oó]n perfecta|excelente relaci[oó]n calidad|venta de|comprar ahora/iu, reference);
    assert.equal(JSON.stringify(original), originalJson, reference);
  }
});

test("elimina traslados de otros modelos y diferencia motorizaciones de una misma familia", () => {
  const mp20 = prepareSourceProduct(find("2251")).product.description_general;
  const mp16ux = prepareSourceProduct(find("2259")).product.description_general;
  assert.match(mp20 ?? "", /MP20XUX/iu);
  assert.match(mp16ux ?? "", /MP16UX/iu);
  assert.match(prepareSourceProduct(find("4656")).product.description_general ?? "", /gasolina/iu);
  assert.match(prepareSourceProduct(find("4723")).product.description_general ?? "", /di[eé]sel/iu);
  assert.match(prepareSourceProduct(find("4655")).product.description_general ?? "", /di[eé]sel/iu);
  assert.match(prepareSourceProduct(find("4724")).product.description_general ?? "", /gasolina/iu);
  assert.match(prepareSourceProduct(find("2249")).product.description_general ?? "", /configuraci[oó]n de bater[ií]a no queda identificada/iu);
  assert.match(prepareSourceProduct(find("2136")).product.description_general ?? "", /no debe confundirse con la de un apilador/iu);
});

test("no aplica la edición cuando cambia la identidad, la fuente o la versión preparada", () => {
  for (const reference of refs) {
    const record = find(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: "OTRA" },
      { ...record, url: `${record.url}?different=1` },
      { ...record, title: "Otra máquina" },
      { ...record, brand: "OTRA" },
      { ...record, model: "OTRO" },
      { ...record, externalReference: "OTRO" },
      { ...record, condition: "Segunda mano" },
      { ...record, categoryKey: "otra" },
      { ...record, shortDescription: "Descripción original actualizada" },
      { ...record, longDescription: "Descripción general de origen actualizada" },
      { ...record, specs: { ...record.specs, Modelo: "OTRO" } }
    ];
    for (const variant of variants) {
      assert.equal(resolveGamVerifiedConciseGeneral(variant, record.longDescription), null, reference);
    }
    assert.equal(resolveGamVerifiedConciseGeneral(record, "Descripción preparada revisada"), null, reference);
  }
});

test("preserva las fichas no seleccionadas", () => {
  const record = find("6004");
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.description_general, record.longDescription);
  assert.equal(resolveGamVerifiedConciseGeneral(record, prepared.product.description_general), null);
});

const unitEditorialRefs = [
  "6666", "5258", "6665", "6863", "6146", "6865", "6841", "6588", "6590", "6652",
  "6852", "5895", "6103", "6584", "6687", "6706", "6816", "6820", "6502"
] as const;

test("reconcilia 19 textos de unidades usadas con evidencia técnica propia y sin alterar el registro", () => {
  assert.equal(new Set(unitEditorialRefs).size, 19);
  for (const reference of unitEditorialRefs) {
    const record = find(reference);
    const originalJson = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    const general = prepared.product.description_general;
    assert.ok(record.longDescription && general, reference);
    if (["6863", "6852", "6103"].includes(reference)) {
      assert.equal(prepared.status, "ready", reference);
      const model = prepared.product.spec.Modelo;
      const brand = prepared.product.spec.Marca;
      assert.ok(typeof model === "string" && typeof brand === "string", reference);
      assert.ok(normalize(general).includes(normalize(model)), reference);
      assert.ok(normalize(general).includes(normalize(brand)), reference);
    } else {
      assert.ok(general.length > 300 && general.length < 700, reference);
      assert.notEqual(general, record.longDescription, reference);
      assert.ok(general.length < record.longDescription.length * 0.75, reference);
    }
    assert.deepEqual(prepared.product.spec, prepareSourceProduct({ ...record }).product.spec, reference);
    assert.equal(JSON.stringify(record), originalJson, reference);
    assert.equal(resolveGamVerifiedConciseGeneral({ ...record, reference: "OTRO" }, general), null, reference);
    assert.equal(resolveGamVerifiedConciseGeneral({ ...record, url: `${record.url}?changed=1` }, general), null, reference);
    assert.equal(resolveGamVerifiedConciseGeneral({ ...record, longDescription: "Fuente actualizada" }, general), null, reference);
    assert.equal(resolveGamVerifiedConciseGeneral({ ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "OTRA" } }, general), null, reference);
    assert.equal(resolveGamVerifiedConciseGeneral(record, "Otra edición preparada"), null, reference);
  }
});

test("evita publicar el año, la marca, la motorización o el mástil de otra variante", () => {
  const general = (reference: string): string => prepareSourceProduct(find(reference)).product.description_general ?? "";
  assert.match(general("6666"), /H4\.5FTS5.*H4\.5FTS6.*H4\.5FT6/su);
  assert.match(general("6665"), /GLP.*2022.*6\.000 mm.*d[uú]plex/su);
  assert.match(general("6863"), /ERP16VT MWB/su);
  assert.doesNotMatch(general("6863"), /ERP16VF \(MWB\)/su);
  assert.match(general("6146"), /2015.*2018/su);
  assert.match(general("6652"), /2021.*2013/su);
  assert.match(general("6852"), /Yale.*S1\.2/isu);
  assert.doesNotMatch(general("6852"), /Hyster/isu);
  assert.match(general("5895"), /Hyster.*1\.800 kg.*Yale.*1\.600 kg/su);
  assert.match(general("6588"), /2000.*2019/su);
  assert.match(general("6816"), /4\.500 mm.*tr[ií]plex/su);
  assert.match(general("6820"), /3\.300 mm.*d[uú]plex/su);
  assert.match(general("6502"), /5\.500 kg.*15 metros.*2022/su);
});
