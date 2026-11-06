import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { createGamCondensedEditorialResolver } from "../condensed-editorial-resolver.js";
import { cleaningEvidence } from "./cleaning.js";

const { general: resolveGamCleaningCondensedGeneral, short: resolveGamCleaningCondensedShort } = createGamCondensedEditorialResolver(cleaningEvidence, true);

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const expected = new Set([
  "4032",
  "4033",
  "4034",
  "4030",
  "4027",
  "4025",
  "4015",
  "4016",
  "4013",
  "4014",
  "4017",
  "4019",
  "4020",
  "6332",
  "6149",
  "6150",
  "4009",
  "4008",
  "3997",
  "4000"
]);
const words = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;
const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("condensa veinte descripciones GAM verificadas sin modificar otras propiedades", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const before = JSON.stringify(record);
    const general = resolveGamCleaningCondensedGeneral(record);
    const short = resolveGamCleaningCondensedShort(record);
    if (general !== null) {
      assert.ok(record.reference && record.model && short);
      changed.add(record.reference);
      assert.ok(general.toLowerCase().includes(record.model.toLowerCase()), record.reference);
      assert.ok(words(general) >= 75 && words(general) < words(record.longDescription ?? "") * 0.6, record.reference);
      const prepared = prepareSourceProduct(record).product;
      assert.equal(prepared.description_general,
        record.reference === "6332" ? `${general} El proveedor declara un sistema de detección de obstáculos.` : general,
        record.reference);
      assert.equal(prepared.description, short, record.reference);
      assert.equal(prepared.reference, record.reference);
      assert.equal(prepared.sourceUrl, record.url);
      for (const [key, value] of Object.entries(record.specs ?? {})) {
        assert.equal(prepared.spec[key], value, `${record.reference}:${key}`);
      }
    } else {
      assert.equal(short, null, record.reference ?? "");
    }
    assert.equal(JSON.stringify(record), before, record.reference ?? "");
  }
  assert.deepEqual(changed, expected);
  for (const record of gomariz.products) {
    assert.equal(resolveGamCleaningCondensedGeneral(record), null);
    assert.equal(resolveGamCleaningCondensedShort(record), null);
  }
});

test("descarta variantes con cambios de identidad, textos o especificaciones", () => {
  const original = find("6149");
  assert.ok(resolveGamCleaningCondensedGeneral(original));
  const variants: readonly ProductRecord[] = [
    { ...original, providerId: "gomariz" },
    { ...original, condition: "Segunda mano" },
    { ...original, reference: "6150" },
    { ...original, model: "FCA T360X" },
    { ...original, externalReference: "FCA T360X" },
    { ...original, title: "Otra fregadora" },
    { ...original, url: `${original.url}?otra=1` },
    { ...original, brand: "YALE" },
    { ...original, categoryKey: "otros-nuevos" },
    { ...original, shortDescription: "Otra ficha" },
    { ...original, specs: { ...original.specs, "Peso": "200 KG" } },
    { ...original, longDescription: `${original.longDescription ?? ""} Texto añadido.` }
  ];
  for (const [index, record] of variants.entries()) {
    assert.equal(resolveGamCleaningCondensedGeneral(record), null, String(index));
    assert.equal(resolveGamCleaningCondensedShort(record), null, String(index));
  }
});
