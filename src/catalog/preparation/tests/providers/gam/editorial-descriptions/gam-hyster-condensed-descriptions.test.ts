import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamHysterCondensedGeneral, resolveGamHysterCondensedShort } from "../../../../mapping/providers/gam/editorial-descriptions/verified-condensed-hyster.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { resolveVerifiedUnitSummaryEditorial } from "../../../../mapping/verified-unit-summary-editorial.js";
import { includeGamSourceBatteryVoltageInGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/source-battery-voltage-general.js";
import { includeGamSourceSafetyControlsInGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/source-safety-controls-general.js";
import { includeGamRegenerativeBrakingInGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/source-regenerative-braking-general.js";
import { resolveGamVerifiedSourceCondensedGeneral } from "../../../../evidence/providers/gam/editorial/verified-source-condensed-generals.js";
import { includeGamSourceForkliftMeasuresInGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/source-forklift-measures-general.js";

const expected = new Set([
  "4622", "4626", "6480", "2100", "2099", "4623", "2098", "2101", "2151", "2140",
  "2144", "4625", "6481", "1713", "2012", "2013", "2036", "2030", "2011", "6990"
]);
const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");

const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM: condensa las generales y cortas de veinte referencias Hyster acreditadas", () => {
  const found = new Set<string>();
  for (const record of gam.products) {
    const original = structuredClone(record);
    const general = resolveGamHysterCondensedGeneral(record);
    const short = resolveGamHysterCondensedShort(record);
    if (general !== null) {
      assert.ok(record.reference);
      assert.ok(record.longDescription);
      assert.ok(record.model);
      assert.ok(short);
      assert.ok(general.includes(`Hyster ${record.model}`), record.reference);
      assert.ok(general.split(/\s+/u).length < record.longDescription.trim().split(/\s+/u).length);
      const prepared = prepareSourceProduct(record);
      assert.equal(prepared.product.description_general,
        includeGamSourceBatteryVoltageInGeneral(record,
          includeGamSourceForkliftMeasuresInGeneral(record,
            includeGamSourceSafetyControlsInGeneral(record,
              includeGamRegenerativeBrakingInGeneral(record, resolveGamVerifiedSourceCondensedGeneral(record) ?? general, prepared.product.spec),
              prepared.product.spec), prepared.product.spec), prepared.product.spec), record.reference);
      if (record.reference === "6480" || record.reference === "6481") {
        assert.match(prepared.product.description_general ?? "", /freno electromagnético/u, record.reference);
        assert.match(prepared.product.description_general ?? "", /2\.000 (?:a|y) 3\.500 mm/u, record.reference);
      }
      assert.equal(prepared.product.description,
        resolveVerifiedUnitSummaryEditorial(record, short, prepared.product.description_general) ?? short, record.reference);
      assert.deepEqual(prepared.product.spec, prepareSourceProduct(original).product.spec, record.reference);
      found.add(record.reference);
    } else {
      assert.equal(short, null);
    }
    assert.deepEqual(record, original);
  }
  assert.deepEqual(found, expected);
});

test("GAM: no reutiliza textos con otra identidad, URL, evidencia o ficha técnica", () => {
  for (const reference of expected) {
    const record = find(reference);
    assert.ok(record.longDescription);
    const invalid: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, condition: "Segunda mano" },
      { ...record, reference: "otra-referencia" },
      { ...record, model: "OTRO-MODELO" },
      { ...record, externalReference: "OTRO-MODELO" },
      { ...record, brand: "OTRA-MARCA" },
      { ...record, title: "Título sin coincidencia" },
      { ...record, categoryKey: "otra-categoria" },
      { ...record, url: `${record.url}?variante=2` },
      { ...record, specs: { ...record.specs, Modelo: "OTRO-MODELO" } },
      { ...record, shortDescription: "Descripción modificada" },
      { ...record, longDescription: `${record.longDescription} Texto añadido.` }
    ];
    for (const variant of invalid) {
      assert.equal(resolveGamHysterCondensedGeneral(variant), null, `${reference}: general`);
      assert.equal(resolveGamHysterCondensedShort(variant), null, `${reference}: corta`);
    }
  }
});

test("Gomariz y otros productos GAM no reciben la cohorte editorial Hyster", () => {
  for (const record of gomariz.products) {
    assert.equal(resolveGamHysterCondensedGeneral(record), null);
    assert.equal(resolveGamHysterCondensedShort(record), null);
  }
  assert.equal(resolveGamHysterCondensedGeneral(find("5992")), null);
  assert.equal(resolveGamHysterCondensedShort(find("5992")), null);
});
