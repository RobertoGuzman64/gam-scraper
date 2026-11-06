import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { verifiedMercaelevaSourceEditorial } from "../evidence/verified-source-editorial.js";
import { resolveMercaelevaVerifiedSourceEditorial } from "../mapping/verified-source-editorial.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { normalizeMercaelevaAusaHeightText } from "../../technical/reconciliation/mercaeleva-ausa-height.js";

const catalog = await readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json");
const expected = new Set([
  "M928-9933", "M017-2019", "M476-1722", "M722-8895", "M402-2703",
  "M816-3394", "M940-4770", "M288-9739", "M141-6536", "M035-8084",
  "M346-8712", "M855-6850", "M640-1938", "M121-6486", "M005-5167",
  "M011-3720", "M209-3306", "M567-8260", "M620-2142", "M106-1389"
]);

const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Mercaeleva: veinte generales propios quedan vinculados al original canónico", () => {
  assert.equal(catalog.products.length, 221);
  assert.deepEqual(new Set(Object.keys(verifiedMercaelevaSourceEditorial)), expected);
  const entries: Readonly<Record<string, { readonly general: string; readonly sourceUrl: string }>> = verifiedMercaelevaSourceEditorial;
  for (const record of catalog.products) {
    if (!expected.has(record.reference ?? "")) continue;
    const before = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(JSON.stringify(record), before);
    assert.ok(record.reference);
    const evidence = entries[record.reference];
    assert.ok(evidence);
    assert.equal(prepared.status, "ready", record.reference);
    assert.equal(prepared.product.description_general, normalizeMercaelevaAusaHeightText(record, evidence.general), record.reference);
    assert.ok(prepared.product.description_general);
    assert.ok(prepared.product.description_general.trim().split(/\s+/u).length >= 65);
    assert.equal(prepared.product.sourceUrl, evidence.sourceUrl);
    assert.ok(prepared.product.spec);
  }
});

test("Mercaeleva: cualquier cambio de identidad, procedencia, horómetro o preparación invalida la evidencia", () => {
  const record = find("M017-2019");
  const previous = "La Linde E16P-02 es una carretilla elevadora eléctrica de segunda mano, fabricada en 2006, con capacidad máxima de 1.600 kg. La ficha individual identifica una batería de plomo-ácido, cuatro ruedas y cabina con protección superior. El vendedor registra 16.939 horas y la referencia MER0685.";
  assert.equal(resolveMercaelevaVerifiedSourceEditorial(record, previous), verifiedMercaelevaSourceEditorial["M017-2019"].general);
  assert.equal(resolveMercaelevaVerifiedSourceEditorial(record, previous + " Texto adicional"), null);
  assert.equal(resolveMercaelevaVerifiedSourceEditorial(record, null), null);
  for (const modified of [
    { ...record, providerId: "gam" },
    { ...record, reference: "M476-1722" },
    { ...record, url: record.url + "?otra=1" },
    { ...record, model: "E16P-01" },
    { ...record, year: "2015" },
    { ...record, horometer: "15000" },
    { ...record, condition: "Nuevo" },
    { ...record, longDescription: "Otro anuncio" },
    { ...record, specs: { ...record.specs, "Horas laborales": "600 h" } },
    { ...record, specs: { ...record.specs, "Capacidad máxima de elevación": "2000 kg" } }
  ] satisfies readonly ProductRecord[]) {
    assert.equal(resolveMercaelevaVerifiedSourceEditorial(modified, previous), null);
  }
});

test("Mercaeleva: preserva horas, referencias y variantes contradictorias", () => {
  for (const [reference, fragments] of [
    ["M121-6486", ["13.760", "16.169", "discrepancia"]],
    ["M005-5167", ["6.964", "6.813", "3E2"]],
    ["M011-3720", ["MER0825", "MER0525", "discrepancia"]],
    ["M209-3306", ["875", "3.457", "repintada"]],
    ["M567-8260", ["722", "747", "ambas cifras"]],
    ["M106-1389", ["686", "689", "diferencia"]],
    ["M816-3394", ["4.653", "horómetro"]]
  ] as const) {
    const general = prepareSourceProduct(find(reference)).product.description_general;
    assert.ok(general);
    for (const fragment of fragments) assert.ok(general.includes(fragment), `${reference}:${fragment}`);
  }
});
