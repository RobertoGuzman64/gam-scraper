import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGamSourceTechnicalUnits } from "../../../../reconciliation/gam-source-technical-units.js";
import { verifiedUnitContextEditorial } from "../../../../evidence/verified-unit-context-editorial.js";
import { includeGamRegenerativeBrakingInGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/source-regenerative-braking-general.js";
import { includeGamSourceSafetyControlsInGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/source-safety-controls-general.js";
import { createGamCondensedEditorialResolver } from "../../../../mapping/providers/gam/editorial-descriptions/condensed-editorial-resolver.js";
import { multiSectorSecondaryEvidence } from "../../../../evidence/providers/gam/editorial/condensed/multi-sector-secondary.js";

const { general: resolveGamAdditionalCondensedGeneral, short: resolveGamAdditionalCondensedShort } = createGamCondensedEditorialResolver(multiSectorSecondaryEvidence);

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const expected = new Set([
  "1210", "1211", "1212", "1213", "1214", "6185", "6188", "6874", "6953", "6168",
  "4659", "4651", "6547", "6148", "2239", "5993", "6425", "6368", "6325", "2146"
]);

const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const wordCount = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length;

test("aplica síntesis editorial contrastada únicamente a veinte fichas GAM", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const source = JSON.stringify(record);
    const general = resolveGamAdditionalCondensedGeneral(record);
    if (general !== null) {
      assert.ok(record.reference && record.model);
      changed.add(record.reference);
      assert.ok(general.includes(record.model) || record.reference === "6168", record.reference);
      assert.ok(wordCount(general) >= 70 && wordCount(general) < wordCount(record.longDescription ?? "") / 2);
      const prepared = prepareSourceProduct(record).product;
      assert.equal(prepared.description_general,
        includeGamSourceSafetyControlsInGeneral(record,
          includeGamRegenerativeBrakingInGeneral(record, general, prepared.spec), prepared.spec), record.reference);
      const unitContextEvidence: Readonly<Record<string, { readonly sourceDigest: string; readonly short?: string }>> = verifiedUnitContextEditorial;
      assert.equal(prepared.description, unitContextEvidence[`gam:${record.reference}`]?.short ?? resolveGamAdditionalCondensedShort(record) ?? record.shortDescription?.trim(), record.reference);
      assert.equal(prepared.reference, record.reference);
      assert.equal(prepared.sourceUrl, record.url);
      for (const [key, value] of Object.entries(reconcileGamSourceTechnicalUnits(record).specs ?? {})) {
        const expectedValue: unknown = key === "Dimensiones Cesta" && ["6874", "6185", "6188", "6168"].includes(record.reference ?? "")
          ? "1,4 x 0,7 x 1,1 m" : value;
        assert.equal(prepared.spec[key], expectedValue, `${record.reference}: ${key}`);
      }
    }
    assert.equal(JSON.stringify(record), source, record.reference ?? "");
  }
  assert.deepEqual(changed, expected);
  for (const record of gomariz.products) {
    assert.equal(resolveGamAdditionalCondensedGeneral(record), null);
    assert.equal(resolveGamAdditionalCondensedShort(record), null);
  }
});

test("bloquea referencias cruzadas, variantes y textos de origen cambiados", () => {
  const original = find("6547");
  assert.match(resolveGamAdditionalCondensedShort(original) ?? "", /230 kg/u);
  const invalid: readonly ProductRecord[] = [
    { ...original, providerId: "gomariz" },
    { ...original, condition: "Segunda mano" },
    { ...original, reference: "4659" },
    { ...original, model: "TRACCESS 230" },
    { ...original, externalReference: "TRACCESS 230" },
    { ...original, title: "CTE TRACCESS 230" },
    { ...original, brand: "Otra" },
    { ...original, categoryKey: "manutencion" },
    { ...original, url: `${original.url}?variant=1` },
    { ...original, specs: { ...original.specs, "Capacidad de carga (kg)": "200 KG" } },
    { ...original, longDescription: `${original.longDescription ?? ""} Nueva versión.` }
  ];
  for (const [index, item] of invalid.entries()) {
    assert.equal(resolveGamAdditionalCondensedGeneral(item), null, String(index));
    assert.equal(resolveGamAdditionalCondensedShort(item), null, String(index));
  }
});
