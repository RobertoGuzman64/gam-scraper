import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGamSourceTechnicalUnits } from "../../../../reconciliation/gam-source-technical-units.js";
import { resolveGamVerifiedExtendedGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/verified-extended-general.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const expected = new Map<string, string>([
  ["3445", "2b05ddd2ba3202f237d7dc351d5c0737047f567fa94d6c038a47a1c632d34bc1"],
  ["3442", "631d941e3b8cdcc879fe6b0253637a5e07710a26506796b2851a0a36cd31062f"],
  ["3432", "6612e5d6ed9257250e2c101cb883aa517c79549653aa1d8eab03632ac2f49dc4"],
  ["3433", "e20146eb354bbd0779c8d67ec09bbeb22c591c3437b66c9feb353100237d6746"],
  ["3434", "498c9ca1515a3f564d44b9a03be8198d014bd6151531cde07d6a92ab7be4c913"],
  ["3435", "70b3c3b4e7f70d272bda4578bd3a191afdda747155214eb6672dc62cf98f1f7f"],
  ["3436", "4cfe48dbe7c2129c5f455c2ffe2c7afcafcfccecbc52e77fed3cdb4ef11934ce"],
  ["2121", "28868a758e1904cdc7f1c2437a728b63a83de1850f070f7f5fc726a6afe5d302"],
  ["2123", "ce37500b376ed5d198ddea176691d0ff59b12153838f5b42690ae414bf67b09a"],
  ["2125", "9c136c6deb461e82385f9296cb2eb23dda6a9b7b8a5fc01ab7d7e36f355169c1"],
  ["2215", "f1c2055b1ffcdcba9f592e1a0767b8c87107c380747733457aae2450282da671"],
  ["2217", "d2e2696fb18dd108ce0aadbbc153cd08944cd9a48e36f35cd50fd5cc47514a6e"],
  ["2141", "7dfd071e244ec6a36094da126e5a044b3834bae7608d27c23bce54df8891f397"],
  ["159", "b78a54b8e04b22a05e60e4d515c15344ce1da97ef048d1fda96cf7b3e4ab98bc"],
  ["2127", "3b65f4493787399001603b638751e453340bbc3dd7e99a05306f58e640dfb245"],
  ["2133", "6463ad3b9fca00984d6c2d8a7c2f4252314a0e2733d5c847ea6196f927ea5442"],
  ["3311", "ea23fd3994d20788d998fc44b99835fdba4d4f9f29440a1fec4e05d5b7c3331e"],
  ["2088", "0b920f67e2e6c4125214877f7e65a242869e90a0295879c3b2f780e7de37a7d8"],
  ["2063", "b88e2e432ea336691942ece9bb1cbbd06f84961b49bbb1c3cedfb1a7c9e02817"],
  ["2091", "5577b480fe492bb107e2fb10d2399d8005bd9edaf12c91118069e50b5174e9bc"]
]);
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("veinte fichas GAM con redacción individual y sin pérdida de especificaciones", () => {
  assert.equal(expected.size, 20);
  for (const [reference, hash] of expected) {
    const record = find(reference);
    const original = JSON.stringify(record);
    const prepared = prepareSourceProduct(record).product;
    assert.ok(prepared.description_general, reference);
    assert.equal(digest(prepared.description_general), hash, reference);
    assert.ok(prepared.description_general.split(/\s+/u).length >= 65, reference);
    assert.ok(record.longDescription && prepared.description_general.length < record.longDescription.length, reference);
    assert.equal(JSON.stringify(record), original, reference);
    for (const [key, value] of Object.entries(reconcileGamSourceTechnicalUnits(record).specs ?? {})) {
      assert.equal(prepared.spec[key], value, `${reference}: ${key}`);
    }
  }
});

test("protección de identidad y procedencia de los veinte textos", () => {
  for (const [reference, hash] of expected) {
    const record = find(reference);
    const previous = prepareSourceProduct(record).product.description_general;
    assert.ok(previous, reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: "OTRA" },
      { ...record, url: `${record.url}?revision=nueva` },
      { ...record, title: `${record.title} variante` },
      { ...record, brand: "OTRA" },
      { ...record, model: "OTRO MODELO" },
      { ...record, shortDescription: `${record.shortDescription} nuevo` },
      { ...record, longDescription: `${record.longDescription} nueva` },
      { ...record, specs: { ...record.specs, Modelo: "OTRO MODELO" } }
    ];
    for (const variant of variants) {
      assert.equal(resolveGamVerifiedExtendedGeneral(variant, previous), null, reference);
      const general = prepareSourceProduct(variant).product.description_general;
      assert.notEqual(digest(general ?? ""), hash, reference);
    }
  }
});
