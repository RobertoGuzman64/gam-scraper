import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamVerifiedIndustrialCleaningGeneral, resolveGamVerifiedIndustrialCleaningShort } from "../../../../mapping/providers/gam/editorial-descriptions/verified-industrial-cleaning-editorial.js";
import { reconcileGamForPreparation, reconcileGamInitialIdentity } from "../../../../reconciliation/gam.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const references = ["4031", "4018", "4021", "4023", "3999", "4026", "171", "4040"] as const;

const original = (reference: string): ProductRecord => {
  const product = catalog.products.find((record) => record.reference === reference);
  assert.ok(product, reference);
  return product;
};

const reconciled = (record: ProductRecord): ProductRecord => reconcileGamForPreparation(reconcileGamInitialIdentity(record));

test("GAM: elimina propaganda y textos truncados en ocho fichas industriales acreditadas", () => {
  for (const reference of references) {
    const record = original(reference);
    const source = JSON.stringify(record);
    const product = prepareSourceProduct(record).product;
    const general = product.description_general;
    assert.ok(general, reference);
    assert.ok(general.length >= 350 && general.length <= 750, reference);
    assert.ok(record.longDescription && general.length < record.longDescription.length, reference);
    assert.ok(general.toLocaleLowerCase("es").includes("tennant"), reference);
    assert.doesNotMatch(general, /soluci[oó]n perfecta|rendimiento excepcional|potente y vers[aá]til|paraLa aspiradora/iu, reference);
    assert.equal(product.sourceUrl, record.url, reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.equal(product.spec[key], value, `${reference}:${key}`);
    }
    assert.equal(JSON.stringify(record), source, reference);
  }
  assert.match(prepareSourceProduct(original("4023")).product.description_general ?? "", /BCA S7/u);
  assert.doesNotMatch(prepareSourceProduct(original("4023")).product.description ?? "", /I-MOP/u);
  assert.doesNotMatch(prepareSourceProduct(original("4018")).product.description_general ?? "", /T20 D/u);
  assert.match(prepareSourceProduct(original("4021")).product.description_general ?? "", /gasolina, GLP o di[eé]sel/u);
});

test("GAM: rechaza cambios de ficha o preparación sin extender la edición a otra variante", () => {
  for (const reference of references) {
    const record = reconciled(original(reference));
    const prepared = prepareSourceProduct(original(reference)).product;
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: "OTRA" },
      { ...record, url: `${record.url}?revision=2` },
      { ...record, title: "Otra máquina" },
      { ...record, model: "OTRO" },
      { ...record, externalReference: "OTRO" },
      { ...record, categoryKey: "otros" },
      { ...record, shortDescription: "Resumen nuevo" },
      { ...record, longDescription: "Información actualizada" },
      { ...record, specs: { ...record.specs, Modelo: "OTRO" } }
    ];
    for (const variant of variants) {
      assert.equal(resolveGamVerifiedIndustrialCleaningGeneral(variant, prepared.description_general), null, reference);
      assert.equal(resolveGamVerifiedIndustrialCleaningShort(variant, prepared.description), null, reference);
    }
    assert.equal(resolveGamVerifiedIndustrialCleaningGeneral(record, "Texto editado por otro resolutor"), null, reference);
  }
});
