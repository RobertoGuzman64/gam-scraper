import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamResidualConciseShort } from "../mapping/providers/gam/short-description.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const references = new Set(["6807", "8", "2323", "2311", "5996", "921", "922", "4024", "4026", "911"]);
const words = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length;
const numerics = (text: string): ReadonlySet<string> => new Set(text.match(/\d+(?:[.,]\d+)*/gu) ?? []);
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM sintetiza los resúmenes residuales con identidad y valores conservados", () => {
  for (const record of catalog.products) {
    const original = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    if (references.has(record.reference ?? "")) {
      const short = prepared.product.description;
      const general = prepared.product.description_general;
      assert.ok(short && general, record.reference ?? "");
      assert.ok(words(record.shortDescription ?? "") > 45, record.reference ?? "");
      assert.ok(words(short) >= 12 && words(short) <= 45, record.reference ?? "");
      assert.ok(words(general) >= 60, record.reference ?? "");
      for (const value of numerics(record.shortDescription ?? "")) {
        assert.ok(numerics(`${short} ${general}`).has(value), `${record.reference}: ${value}`);
      }
      assert.equal(prepared.status, "ready", record.reference ?? "");
    }
    assert.equal(JSON.stringify(record), original);
  }
  assert.equal(references.size, 10);
});

test("GAM excluye otras variantes, títulos discordantes y cifras no respaldadas", () => {
  for (const reference of ["5949", "6806", "4778", "2159", "12", "2330", "4029", "2168", "4039"]) {
    const record = find(reference);
    assert.equal(resolveGamResidualConciseShort(record, record.longDescription), null, reference);
  }
  const record = find("4026");
  const rejected: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, brand: "HYSTER" },
    { ...record, model: "BCS S16L" },
    { ...record, url: `${record.url}?variant=1` },
    { ...record, url: record.url.replace("online.gamrentals.com", "example.com") },
    { ...record, specs: { ...record.specs, Marca: "HYSTER" } },
    { ...record, shortDescription: "Texto corto." },
    { ...record, longDescription: "Descripción escasa." }
  ];
  for (const [index, invalid] of rejected.entries()) {
    assert.equal(resolveGamResidualConciseShort(invalid, invalid.longDescription), null, String(index));
  }
});
