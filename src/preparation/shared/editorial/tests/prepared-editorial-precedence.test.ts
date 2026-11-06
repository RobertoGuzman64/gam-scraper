import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolvePreparedEditorial } from "../mapping/prepared-editorial.js";
import { captureSourceEditorialEvidence } from "../mapping/source-editorial-evidence.js";

const providers = ["gam", "gomariz", "mercaeleva"] as const;
const catalogs = {
  gam: await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  gomariz: await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json"),
  mercaeleva: await readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
};
const digest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const resolve = (record: ProductRecord, sourceUnitRecord: ProductRecord = record) =>
  resolvePreparedEditorial(record, sourceUnitRecord, captureSourceEditorialEvidence(record));
const find = (provider: typeof providers[number], reference: string): ProductRecord => {
  const record = catalogs[provider].products.find((item) => item.reference === reference);
  assert.ok(record, `${provider}:${reference}`);
  return record;
};

test("conserva exactamente las cinco salidas editoriales de los 1.347 originales", () => {
  const expected = {
    gam: { count: 983, sha: "d638e579af604036e72b19f88fa505f5b0a35cd075718b1d460564cb89fe1779" },
    gomariz: { count: 143, sha: "fa10b439a506f6a27af3043c1162f108f167efc9551359b44d156c80569d722c" },
    mercaeleva: { count: 221, sha: "656e2d22e0deb8af302da8e7ac3bf55335c0c3197f7e444ba0e3b72492dda698" }
  };
  for (const provider of providers) {
    const records = catalogs[provider].products;
    const input = digest(records);
    assert.equal(records.length, expected[provider].count);
    const result = records.map((record) => ({
      reference: record.reference,
      sourceUrl: record.url,
      editorial: resolve(record)
    }));
    assert.equal(digest(result), expected[provider].sha, provider);
    assert.equal(digest(records), input, `${provider}: no mutar originales`);
  }
});

test("conserva estados, incidencias, identidad, textos, condición y campos de preparaciones representativas", () => {
  const references = {
    gam: ["6607", "6617", "6218", "2364", "6389", "6805", "6998", "6912", "6814", "2323", "6987", "6682", "6857", "2336"],
    gomariz: ["TE1858", "TE1620", "BT1461", "BA1335", "OR1537", "GR1356", "MT1661", "FR1077", "RO457", "TE1618", "BA1465"],
    mercaeleva: ["M264-2806", "M062-8951", "M119-9334", "M563-8693"]
  };
  const expected = {
    gam: "2e4903a054cadc3429bb04de9f1b25b8dbbb0203f6905ee5a55c87f65dc661b0",
    gomariz: "295b6b4e51882a49a37c097b6a2e09220ae6b8a6e9b6a6727498b0a368112696",
    mercaeleva: "17ddd66426835578a4235f16452a893eecc342297e62d1e9afbf334d3df98b18"
  };
  for (const provider of providers) {
    const records = references[provider].map((reference) => find(provider, reference));
    const input = digest(records);
    const result = records.map((record) => ({
      reference: record.reference,
      sourceUrl: record.url,
      prepared: prepareSourceProduct(record)
    }));
    assert.equal(digest(result), expected[provider], provider);
    assert.equal(digest(records), input, `${provider}: no mutar entradas`);
  }
});

test("mantiene precedencias ante cambios de identidad, fuente, variante y unidad de origen", () => {
  const gam = find("gam", "6218");
  const anotherGam = find("gam", "6478");
  const crossedGam = find("gam", "6998");
  const gomariz = find("gomariz", "TE1620");
  const gomarizOther = find("gomariz", "BA1335");
  const mercaeleva = find("mercaeleva", "M062-8951");
  const otherMercaeleva = find("mercaeleva", "M119-9334");
  const cases: readonly (readonly [ProductRecord, ProductRecord])[] = [
    [gam, gam],
    [{ ...gam, providerId: gomariz.providerId }, gam],
    [{ ...gam, reference: anotherGam.reference }, gam],
    [{ ...gam, model: anotherGam.model }, gam],
    [{ ...gam, url: anotherGam.url }, gam],
    [{ ...gam, longDescription: anotherGam.longDescription }, gam],
    [crossedGam, crossedGam],
    [{ ...crossedGam, reference: gam.reference }, crossedGam],
    [gomariz, gomariz],
    [{ ...gomariz, providerId: gam.providerId }, gomariz],
    [{ ...gomariz, model: gomarizOther.model }, gomariz],
    [{ ...gomariz, url: gomarizOther.url }, gomariz],
    [{ ...gomariz, specs: gomarizOther.specs ?? {} }, gomariz],
    [mercaeleva, mercaeleva],
    [{ ...mercaeleva, providerId: gam.providerId }, mercaeleva],
    [{ ...mercaeleva, model: otherMercaeleva.model }, mercaeleva],
    [{ ...mercaeleva, shortDescription: otherMercaeleva.shortDescription }, mercaeleva],
    [{ ...mercaeleva, longDescription: otherMercaeleva.longDescription }, mercaeleva],
    [{ ...mercaeleva, url: otherMercaeleva.url }, mercaeleva],
    [mercaeleva, otherMercaeleva]
  ];
  const inputs = digest(cases);
  assert.equal(digest(cases.map(([record, sourceUnitRecord]) => resolve(record, sourceUnitRecord))),
    "3ae06a086cb4caace025188a09a955249e3e152b60f69cb291e9fd5029dc95ac");
  assert.equal(digest(cases), inputs);
});
