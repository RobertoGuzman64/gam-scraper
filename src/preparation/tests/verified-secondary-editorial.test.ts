import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { verifiedCanonicalBriefEditorial } from "../shared/editorial/evidence/verified-canonical-brief-editorial.js";
import { verifiedUnitSummaryEditorial } from "../shared/editorial/evidence/verified-unit-summary-editorial.js";
import { verifiedGomarizModelGeneral } from "../gomariz/editorial/evidence/verified-model-general.js";
import { resolveGomarizVerifiedModelGeneral } from "../gomariz/editorial/mapping/verified-model-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalogs = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
]);
const records = new Map<string, ProductRecord>();
for (const catalog of catalogs) {
  for (const record of catalog.products) records.set(`${record.providerId}:${record.reference}`, record);
}

const summaryReferences = new Set([
  "gam:1216", "gam:1217", "gam:2012", "gam:2100", "gam:2140", "gam:2144", "gam:2228", "gam:2230",
  "mercaeleva:M017-2019", "mercaeleva:M030-7485", "mercaeleva:M200-9533", "mercaeleva:M239-6301",
  "mercaeleva:M432-1479", "mercaeleva:M570-8735", "mercaeleva:M582-1882", "mercaeleva:M736-5615",
  "mercaeleva:M879-4639", "mercaeleva:M913-0641", "mercaeleva:M928-9933", "mercaeleva:M940-4770"
]);

test("Las veinte descripciones breves acreditadas se aplican solo a sus unidades de origen", () => {
  assert.ok([...summaryReferences].every((identity) => Object.hasOwn(verifiedUnitSummaryEditorial, identity)));
  for (const identity of summaryReferences) {
    const record = records.get(identity);
    assert.ok(record, identity);
    const snapshot = JSON.stringify(record);
    const entry: Readonly<Record<string, { readonly short: string }>> = verifiedUnitSummaryEditorial;
    const evidence = entry[identity];
    assert.ok(evidence, identity);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", identity);
    assert.equal(prepared.product.description, evidence.short, identity);
    assert.notEqual(prepareSourceProduct({ ...record, url: `${record.url}?fuente-distinta=1` }).product.description, evidence.short, identity);
    assert.notEqual(prepareSourceProduct({ ...record, specs: { ...record.specs, "Dato sin acreditar": "distinto" } }).product.description, evidence.short, identity);
    assert.equal(JSON.stringify(record), snapshot, identity);
  }
});

test("Las dos identificaciones comerciales de Gomariz requieren fuente y general previo acreditados", () => {
  assert.deepEqual(new Set(Object.keys(verifiedGomarizModelGeneral)), new Set(["CC1535", "CC1666"]));
  for (const reference of ["CC1535", "CC1666"]) {
    const identity = `gomariz:${reference}`;
    const record = records.get(identity);
    assert.ok(record, identity);
    const snapshot = JSON.stringify(record);
    const signed: Readonly<Record<string, { readonly general: string }>> = verifiedCanonicalBriefEditorial;
    const previous = signed[identity];
    assert.ok(previous, identity);
    const entries: Readonly<Record<string, { readonly general: string }>> = verifiedGomarizModelGeneral;
    const evidence = entries[reference];
    assert.ok(evidence, identity);
    assert.equal(resolveGomarizVerifiedModelGeneral(record, previous.general), evidence.general, identity);
    assert.equal(prepareSourceProduct(record).product.description_general, evidence.general, identity);
    assert.equal(resolveGomarizVerifiedModelGeneral({ ...record, url: `${record.url}?fuente-distinta=1` }, previous.general), null, identity);
    assert.equal(resolveGomarizVerifiedModelGeneral({ ...record, specs: { ...record.specs, "Dato sin acreditar": "distinto" } }, previous.general), null, identity);
    assert.equal(resolveGomarizVerifiedModelGeneral(record, `${previous.general} Texto añadido.`), null, identity);
    assert.equal(JSON.stringify(record), snapshot, identity);
  }
});
