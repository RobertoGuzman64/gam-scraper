import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGamSourceTechnicalUnits } from "../../../../reconciliation/gam-source-technical-units.js";
import { includeGamSourceSafetyControlsInGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/source-safety-controls-general.js";
import { includeGamSourceBatteryVoltageInGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/source-battery-voltage-general.js";
import { resolveGamVerifiedExtendedGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/verified-extended-general.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const expected = new Map<string, string>([
  ["4845", "2343e00aae743e50b5b7e495fd70d9a8310837fb7aaa904943a02c2ee88dff29"],
  ["2090", "7e28a53c9eca2d64ccde5b9bdad3918fb21304974fd961501bbaa4cd0781b4a6"],
  ["2093", "7fd59076049f70d169ca68a61f9810651217e2eda00bd467d3e21428301ee22a"],
  ["2017", "50807c6bcf0bb1df24cf5df6c22981f6d0ac1d162491d8f94cdbb1c56797752a"],
  ["31", "0ec28ffe9e92b43ccf06f6119eedd629df753d9b12d0a9b255b7e4af15f5d2c3"],
  ["30", "e75fdb1c7f8ea8c713e1d32217cfbc6c882149f2b832bd40de53c294dc6dab74"],
  ["4735", "003d1a0868b8f77bc6f88ccad3c0cbfa9bbc564323d30c41eedb11167410d518"],
  ["4807", "09a65656d7e06e7a0edbc62ffa86e712907b4e46ec284c418c2d36c0f5fdd88c"],
  ["3427", "9324d518ca0c782c076bdfbd90daafeec471608f99324dc94978b2bc50494c4c"],
  ["1144", "71347dcfe4f34e5033e96ed39a252b62ce3ecea5883e203f8a6362bfa9e0ae70"],
  ["1152", "28508b7ba89798369b8df752ea4e8d294cf38fe5d1eb9abbb783a1cd40acf455"],
  ["4765", "bd1d976b9211771afcc80ca82906b4c7ff679fe8014d6f1eafc5eb3a314389ff"],
  ["6020", "7c4b0926a6ffb53760aba1c9f4f2acc2c148a676e7a41e80dd7c283018d3fb3f"],
  ["241", "94ee0ba044bb1548f8b27c95ce95f62d661705152593c639d3a640a608c14b9f"],
  ["214", "9d97a2c536a1e449dbd70f290a565038f99e96eb18534c8c6bba14d3e8735cc2"],
  ["158", "ee2a7589ca767acd8a144b0b9a2fc6992a2989e98630b160d93f0f3af3dc14f7"],
  ["2152", "e37a038806d09a9c299409ff9a4398da7a58bf2a33bf44520bc333f8172b683a"],
  ["2128", "9465d989c4dee9c7a4f551cb188c510af3c238f2fc717af63c896e5a551c9bea"],
  ["240", "9d69b765b76710d0ae79ba6489f527f4530493edef06fd83a172de80864b233f"],
  ["244", "e0e168f6cdf25cbc133b7eca94272116e598a90f5f6e378c468e8945a1e87bce"]
]);
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("veinte descripciones GAM individualizadas sin alterar especificaciones", () => {
  assert.equal(expected.size, 20);
  for (const [reference, hash] of expected) {
    const record = find(reference);
    const original = JSON.stringify(record);
    const prepared = prepareSourceProduct(record).product;
    assert.ok(prepared.description_general, reference);
    const previousGeneral = prepared.description_general
      .replace(/ La ficha del proveedor especifica una tensión de batería de \d+(?:[,.]\d+)? V\.$/u, "")
      .replace(/ El proveedor declara un dispositivo de parada de emergencia\.$/u, "");
    assert.equal(digest(previousGeneral), hash, reference);
    assert.equal(prepared.description_general,
      includeGamSourceBatteryVoltageInGeneral(record,
        includeGamSourceSafetyControlsInGeneral(record, previousGeneral, prepared.spec), prepared.spec), reference);
    assert.ok(prepared.description_general.split(/\s+/u).length >= 65, reference);
    assert.ok(record.longDescription && prepared.description_general.length < record.longDescription.length, reference);
    assert.equal(JSON.stringify(record), original, reference);
    for (const [key, value] of Object.entries(reconcileGamSourceTechnicalUnits(record).specs ?? {})) {
      assert.equal(prepared.spec[key], value, `${reference}: ${key}`);
    }
  }
});

test("bloqueo de variantes y cambios en el texto de partida", () => {
  for (const [reference, hash] of expected) {
    const record = find(reference);
    const prepared = prepareSourceProduct(record).product.description_general;
    assert.ok(prepared, reference);
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
      assert.equal(resolveGamVerifiedExtendedGeneral(variant, prepared), null, reference);
      const general = prepareSourceProduct(variant).product.description_general;
      assert.notEqual(digest(general ?? ""), hash, reference);
    }
  }
});
