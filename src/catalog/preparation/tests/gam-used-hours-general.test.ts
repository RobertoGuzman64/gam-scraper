import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamUsedHoursGeneral } from "../mapping/providers/gam/used-hours-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const expected = new Set([
  "6901", "6979", "6985", "6077", "6202", "5730", "6998", "6614", "6616", "6615",
  "6854", "6855", "6856", "6864", "5979", "6362", "6063", "6064", "6065", "6109", "6204"
]);

const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM individualiza 21 unidades usadas con horómetros propios acreditados", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    const text = prepared.product.description_general;
    const prefix = /^El horómetro de esta unidad registra (\d+ horas), según la ficha del proveedor\.\n\n/u.exec(text ?? "");
    if (prefix) {
      assert.ok(record.reference && record.horometer && text);
      assert.equal(prefix[1], record.horometer, record.reference);
      assert.equal(record.specs?.["Horómetro"], record.horometer);
      assert.ok(expected.has(record.reference), record.reference);
      assert.equal(prepared.product.description_general, resolveGamUsedHoursGeneral(record, text.slice(prefix[0].length)));
      assert.equal(record.condition, "Segunda mano");
      assert.equal(prepared.product.spec["Horómetro"], record.horometer);
      changed.add(record.reference);
    }
    assert.deepEqual(record, original);
  }
  assert.deepEqual(changed, expected);
});

test("GAM rechaza identidades ajenas, horas discordantes, cambios de fuente y valores no numéricos", () => {
  const record = find("6854");
  const prepared = prepareSourceProduct(record);
  const general = prepared.product.description_general;
  assert.ok(general);
  const sourceGeneral = general.replace(/^El horómetro de esta unidad registra 410 horas, según la ficha del proveedor\.\n\n/u, "");
  assert.notEqual(sourceGeneral, general);
  const invalid: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, categoryKey: "manutencion" },
    { ...record, condition: "Nuevo" },
    { ...record, reference: "6855" },
    { ...record, model: "S3220E" },
    { ...record, brand: "GENIE" },
    { ...record, title: "Plataforma SNORKEL S3220E" },
    { ...record, year: "2017" },
    { ...record, horometer: "NA horas" },
    { ...record, horometer: "Horometro sustituido horas" },
    { ...record, horometer: "4100 horas" },
    { ...record, specs: { ...record.specs, "Horómetro": "234 horas" } },
    { ...record, specs: { ...record.specs, "Horómetro": "4100 horas" }, horometer: "4100 horas" },
    { ...record, longDescription: `${record.longDescription ?? ""} Fabricada en 2017.` },
    { ...record, url: record.url.replace("6854-", "6855-") },
    { ...record, url: record.url.replace("online.gamrentals.com", "example.net") },
    { ...record, url: `${record.url}?variant=2` }
  ];
  for (const [index, variant] of invalid.entries()) {
    assert.equal(resolveGamUsedHoursGeneral(variant, sourceGeneral), null, String(index));
  }
  assert.equal(resolveGamUsedHoursGeneral(record, general), null);
  assert.equal(resolveGamUsedHoursGeneral(record, sourceGeneral.replace("S3219E", "S3220E")), null);
  assert.equal(resolveGamUsedHoursGeneral(find("6778"), sourceGeneral), null);
  assert.equal(resolveGamUsedHoursGeneral(find("6126"), sourceGeneral), null);
});

test("Gomariz y otras cohortes quedan fuera de la recuperación GAM", () => {
  for (const record of gomariz.products) {
    const general = prepareSourceProduct(record).product.description_general;
    assert.equal(resolveGamUsedHoursGeneral(record, general), null);
  }
  assert.equal(resolveGamUsedHoursGeneral(find("6820"), "La carretilla CESAB B318LII registra 2084 horas."), null);
});

test("GAM distingue unidades del mismo modelo sin copiar horas entre referencias", () => {
  for (const references of [
    ["6979", "6985"], ["6077", "6202"], ["6614", "6616", "6615"],
    ["6854", "6855", "6856", "6864"], ["6063", "6064", "6065", "6109", "6204"]
  ]) {
    const descriptions = references.map((reference) => {
      const record = find(reference);
      const text = prepareSourceProduct(record).product.description_general;
      assert.ok(text);
      assert.ok(record.horometer);
      assert.ok(text.startsWith(`El horómetro de esta unidad registra ${record.horometer},`));
      return text;
    });
    assert.equal(new Set(descriptions).size, descriptions.length);
  }
});
