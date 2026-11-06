import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { verifiedGamUnitSourceGenerals } from "../../technical/evidence/general-evidence/verified-unit-source-generals.js";
import { resolveGamVerifiedUnitSourceGeneral } from "../mapping/verified-unit-source-general.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const expected = new Set([
  "2185", "6814", "6815", "4814", "6653", "2207", "6623", "2041", "6915", "3802",
  "6823", "6644", "6436", "22", "2173", "2138", "2168", "6122", "6163", "2159"
]);

const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM: acredita veinte descripciones generales propias sin modificar otros campos", () => {
  assert.equal(catalog.products.length, 983);
  assert.deepEqual(new Set(Object.keys(verifiedGamUnitSourceGenerals)), expected);
  for (const record of catalog.products) {
    const before = JSON.stringify(record);
    const result = prepareSourceProduct(record);
    assert.equal(JSON.stringify(record), before);
    if (!expected.has(record.reference ?? "")) continue;
    assert.ok(record.reference);
    const evidenceEntries: Readonly<Record<string, { readonly general: string }>> = verifiedGamUnitSourceGenerals;
    const evidence = evidenceEntries[record.reference];
    assert.ok(evidence);
    assert.equal(result.status, "ready", record.reference);
    assert.equal(result.product.description_general, evidence.general, record.reference);
    assert.ok(result.product.description_general);
    assert.ok(result.product.description_general.split(/\s+/u).length >= 80, record.reference);
    assert.equal(result.product.sourceUrl, record.url);
    assert.ok(result.product.spec);
  }
});

test("GAM: el documento queda vinculado al origen y al texto preparado anterior", () => {
  const record = find("2185");
  const previous = "El recogepedidos contrapesado HYSTER LO1.2C tiene una capacidad de carga publicada de 1200 kg. Su ficha técnica indica una altura de elevación de 4500 mm y un peso de 1650 kg.";
  const value = resolveGamVerifiedUnitSourceGeneral(record, previous);
  assert.equal(value, verifiedGamUnitSourceGenerals["2185"].general);
  assert.equal(resolveGamVerifiedUnitSourceGeneral(record, previous + " Información ajena"), null);
  assert.equal(resolveGamVerifiedUnitSourceGeneral(record, null), null);
  for (const variant of [
    { ...record, providerId: "mercaeleva" },
    { ...record, reference: "2207" },
    { ...record, url: record.url + "?otra=1" },
    { ...record, model: "LO1.2" },
    { ...record, title: record.title + " otro modelo" },
    { ...record, longDescription: "Otro anuncio" },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "1800 KG" } },
    { ...record, specs: { ...record.specs, Peso: "1200 KG" } }
  ] satisfies readonly ProductRecord[]) {
    assert.equal(resolveGamVerifiedUnitSourceGeneral(variant, previous), null);
  }
});

test("GAM: conserva las discrepancias en vez de presentar cifras contradictorias como acreditadas", () => {
  for (const [reference, fragments] of [
    ["4814", ["XT3207K", "3.200 kg", "7 metros"]],
    ["2041", ["MTU", "Mercedes-Benz", "discrepancia"]],
    ["2168", ["8.000 kg", "48 toneladas", "contradictorios"]],
    ["2159", ["1.250 kg", "508 kg", "contradicción"]],
    ["6623", ["2007", "2024", "ITV", "R-5319-BDK"]]
  ] as const) {
    const general = prepareSourceProduct(find(reference)).product.description_general;
    assert.ok(general);
    for (const fragment of fragments) assert.ok(general.includes(fragment), `${reference}:${fragment}`);
  }
});
