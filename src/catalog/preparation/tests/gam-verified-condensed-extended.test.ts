import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamExtendedCondensedGeneral, resolveGamExtendedCondensedShort } from "../mapping/providers/gam/verified-condensed-extended.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const expected = new Set([
  "2178", "2174", "2149", "2132", "2130", "2097", "2131", "6419", "6420", "6327",
  "6322", "4790", "6364", "3994", "4007", "4006", "2253", "2252", "2206", "6326"
]);
const count = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;
const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("sintetiza solamente veinte referencias GAM con evidencia propia y conserva sus datos", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const before = JSON.stringify(record);
    const general = resolveGamExtendedCondensedGeneral(record);
    const short = resolveGamExtendedCondensedShort(record);
    if (general !== null) {
      assert.ok(record.reference && record.model && short);
      changed.add(record.reference);
      assert.ok(general.toLowerCase().includes(record.model.toLowerCase()), record.reference);
      assert.ok(count(general) >= 75 && count(general) < count(record.longDescription ?? "") * 0.6, record.reference);
      const prepared = prepareSourceProduct(record).product;
      assert.equal(prepared.description_general, general, record.reference);
      assert.equal(prepared.description, short, record.reference);
      assert.equal(prepared.reference, record.reference);
      assert.equal(prepared.sourceUrl, record.url);
      for (const [key, value] of Object.entries(record.specs ?? {})) {
        assert.equal(prepared.spec[key], value, `${record.reference}:${key}`);
      }
    } else {
      assert.equal(short, null, record.reference ?? "");
    }
    assert.equal(JSON.stringify(record), before, record.reference ?? "");
  }
  assert.deepEqual(changed, expected);
  for (const record of gomariz.products) {
    assert.equal(resolveGamExtendedCondensedGeneral(record), null);
    assert.equal(resolveGamExtendedCondensedShort(record), null);
  }
});

test("rechaza variantes que modifiquen identidad, origen o especificaciones", () => {
  const original = find("6322");
  assert.ok(resolveGamExtendedCondensedGeneral(original));
  assert.match(resolveGamExtendedCondensedShort(original) ?? "", /3\.990 mm/u);
  const variants: readonly ProductRecord[] = [
    { ...original, providerId: "gomariz" },
    { ...original, condition: "Segunda mano" },
    { ...original, reference: "6327" },
    { ...original, model: "ERP35UX L" },
    { ...original, externalReference: "ERP35UX L" },
    { ...original, title: "Otra carretilla" },
    { ...original, url: `${original.url}?otra=1` },
    { ...original, brand: "HYSTER" },
    { ...original, categoryKey: "otros-nuevos" },
    { ...original, shortDescription: "Otra versión" },
    { ...original, specs: { ...original.specs, "Altura de elevación (mm)": "3000 mm" } },
    { ...original, longDescription: `${original.longDescription ?? ""} Revisión posterior.` }
  ];
  for (const [index, record] of variants.entries()) {
    assert.equal(resolveGamExtendedCondensedGeneral(record), null, String(index));
    assert.equal(resolveGamExtendedCondensedShort(record), null, String(index));
  }
});
