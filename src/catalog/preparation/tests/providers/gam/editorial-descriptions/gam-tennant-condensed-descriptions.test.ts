import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { resolveGamVerifiedSourceCondensedGeneral } from "../../../../evidence/providers/gam/editorial/verified-source-condensed-generals.js";
import { createGamCondensedEditorialResolver } from "../../../../mapping/providers/gam/editorial-descriptions/condensed-editorial-resolver.js";
import { tennantEvidence } from "../../../../evidence/providers/gam/editorial/condensed/tennant.js";

const { general: resolveGamTennantCondensedGeneral, short: resolveGamTennantCondensedShort } = createGamCondensedEditorialResolver(tennantEvidence, true);

const expected = new Set([
  "4011", "4010", "4024", "4002", "4001", "4003", "4004", "4022", "4012", "3996",
  "4005", "4039", "3993", "4028", "4036", "4038", "4035", "4037", "5771", "5773"
]);
const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");

const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("condensa veinte textos de limpieza Tennant solo con identidad y evidencia coincidentes", () => {
  const found = new Set<string>();
  for (const record of gam.products) {
    const before = structuredClone(record);
    const general = resolveGamTennantCondensedGeneral(record);
    const short = resolveGamTennantCondensedShort(record);
    if (general !== null) {
      assert.ok(record.reference && record.model && record.longDescription && short);
      found.add(record.reference);
      assert.ok(general.includes(record.model));
      assert.ok(general.split(/\s+/u).length < record.longDescription.split(/\s+/u).length * 0.63);
      const prepared = prepareSourceProduct(record).product;
      assert.equal(prepared.description_general, resolveGamVerifiedSourceCondensedGeneral(record) ?? general);
      if (record.reference === "4024") {
        assert.match(prepared.description_general ?? "", /cepillo principal de 660 mm/u);
        assert.match(prepared.description_general ?? "", /superficie filtrante de 4,9 m²/u);
      }
      assert.equal(prepared.description, short);
      assert.equal(prepared.reference, record.reference);
      assert.equal(prepared.sourceUrl, record.url);
      for (const [key, value] of Object.entries(record.specs ?? {})) {
        assert.equal(prepared.spec[key], value, `${record.reference}:${key}`);
      }
    } else {
      assert.equal(short, null);
    }
    assert.deepEqual(record, before);
  }
  assert.deepEqual(found, expected);
  for (const record of gomariz.products) {
    assert.equal(resolveGamTennantCondensedGeneral(record), null);
    assert.equal(resolveGamTennantCondensedShort(record), null);
  }
});

test("rechaza variantes con identidad, resumen, especificaciones o fuente alterados", () => {
  for (const reference of expected) {
    const original = find(reference);
    const variants: readonly ProductRecord[] = [
      { ...original, providerId: "gomariz" },
      { ...original, condition: "Segunda mano" },
      { ...original, reference: "otra-referencia" },
      { ...original, title: "Otro producto" },
      { ...original, brand: "Otra marca" },
      { ...original, model: "Otro modelo" },
      { ...original, externalReference: "Otro modelo" },
      { ...original, url: `${original.url}?variante=2` },
      { ...original, categoryKey: "otra-categoria" },
      { ...original, shortDescription: "Otro resumen" },
      { ...original, specs: { ...original.specs, Modelo: "Otro modelo" } },
      { ...original, longDescription: `${original.longDescription ?? ""} Otra variante.` }
    ];
    for (const variant of variants) {
      assert.equal(resolveGamTennantCondensedGeneral(variant), null, reference);
      assert.equal(resolveGamTennantCondensedShort(variant), null, reference);
    }
  }
});
