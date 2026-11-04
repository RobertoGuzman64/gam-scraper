import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { verifiedUnitSummaryEditorial } from "../evidence/verified-unit-summary-editorial.js";
import { verifiedGomarizUnitSpecificTitles } from "../evidence/providers/gomariz/verified-unit-specific-titles.js";
import { resolveGomarizVerifiedUnitSpecificTitle } from "../mapping/providers/gomariz/verified-unit-specific-title.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const gamByReference = new Map(gam.products.map((item) => [item.reference, item]));
const gomarizByReference = new Map(gomariz.products.map((item) => [item.reference, item]));

const shortReferences = [
  "2231", "2233", "2235", "2236", "2264", "2265", "4626", "5254", "5710", "6217",
  "6623", "6688", "6689", "6690", "6990"
] as const;
const titleReferences = [
  "BA1253", "BA1262", "BA1294", "BT1461", "CAE1207", "GR1113",
  "PV556", "RO1197", "TE1618", "TE1746", "TE1858", "TO1245"
] as const;

const source = (records: ReadonlyMap<string | null, ProductRecord>, reference: string): ProductRecord => {
  const record = records.get(reference);
  assert.ok(record, reference);
  return record;
};

test("La evidencia editorial acredita quince resúmenes GAM sobre unidades exactas", () => {
  const evidence: Readonly<Record<string, { readonly short: string }>> = verifiedUnitSummaryEditorial;
  for (const reference of shortReferences) {
    const record = source(gamByReference, reference);
    const expected = evidence[`gam:${reference}`]?.short;
    assert.ok(expected, reference);
    const original = JSON.stringify(record);
    const product = prepareSourceProduct(record);
    assert.equal(product.status, "ready", reference);
    assert.equal(product.product.description, expected, reference);
    assert.ok(expected.split(/\s+/u).length >= 10, reference);
    assert.notEqual(prepareSourceProduct({ ...record, url: `${record.url}?otra-fuente=1` }).product.description, expected, reference);
    assert.notEqual(prepareSourceProduct({ ...record, specs: { ...record.specs, "Dato de control": "alterado" } }).product.description, expected, reference);
    assert.equal(JSON.stringify(record), original, reference);
  }
});

test("La evidencia editorial acredita doce títulos Gomariz con tipo, variante y datos del origen", () => {
  assert.deepEqual(new Set(Object.keys(verifiedGomarizUnitSpecificTitles)), new Set(titleReferences));
  const evidence: Readonly<Record<string, { readonly title: string }>> = verifiedGomarizUnitSpecificTitles;
  for (const reference of titleReferences) {
    const record = source(gomarizByReference, reference);
    const expected = evidence[reference]?.title;
    assert.ok(expected, reference);
    const original = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.title, expected, reference);
    assert.equal(prepared.product.description_title, expected, reference);
    assert.ok(expected.toLowerCase().includes((record.brand ?? "").toLowerCase()) &&
      expected.toLowerCase().includes((record.model ?? record.title ?? "").toLowerCase()), reference);
    assert.equal(resolveGomarizVerifiedUnitSpecificTitle(record, record.title ?? null), expected, reference);
    assert.equal(resolveGomarizVerifiedUnitSpecificTitle({ ...record, url: `${record.url}?otra-fuente=1` }, record.title ?? null), null, reference);
    assert.equal(resolveGomarizVerifiedUnitSpecificTitle({ ...record, specs: { ...record.specs, "Dato de control": "alterado" } }, record.title ?? null), null, reference);
    assert.equal(resolveGomarizVerifiedUnitSpecificTitle(record, `${record.title} añadido`), null, reference);
    assert.equal(JSON.stringify(record), original, reference);
  }
});

test("Las unidades repetidas del mismo modelo mantienen la identificación por su año", () => {
  const former = prepareSourceProduct(source(gomarizByReference, "BA1253")).product.title;
  const other = prepareSourceProduct(source(gomarizByReference, "BA1262")).product.title;
  assert.ok(former?.includes("2016") && other?.includes("2015"));
  assert.notEqual(former, other);
});
