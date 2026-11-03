import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamResidualCleaningGeneral, resolveGamResidualCleaningShort } from "../../../../mapping/providers/gam/editorial-descriptions/residual-cleaning-editorial.js";
import { rebalanceGamTechnicalShort } from "../../../../mapping/providers/gam/editorial-descriptions/rebalance-technical-short.js";
import { resolveGamCleaningCondensedGeneral, resolveGamCleaningCondensedShort } from "../../../../mapping/providers/gam/editorial-descriptions/verified-condensed-cleaning.js";
import { resolveGamTennantCondensedGeneral, resolveGamTennantCondensedShort } from "../../../../mapping/providers/gam/editorial-descriptions/verified-condensed-tennant.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const affected = new Set(["4030", "4039", "4018", "4778", "2110", "6806", "12", "912"]);
const words = (value: string): number => value.split(/\s+/u).filter(Boolean).length;
const numbers = (value: string): ReadonlySet<string> => new Set(value.match(/\d+(?:[.,]\d+)*/gu) ?? []);
const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM: reequilibra ocho cortas y preserva cifras acreditadas sin trasladar fragmentos truncados", () => {
  const found = new Set<string>();
  for (const record of gam.products) {
    const source = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    const general = prepared.product.description_general;
    const rewritten = rebalanceGamTechnicalShort(record, record.longDescription);
    if (rewritten !== null) {
      assert.ok(record.reference);
      found.add(record.reference);
      assert.ok(record.shortDescription);
      assert.ok(prepared.product.description_general);
      const previousShort = resolveGamCleaningCondensedShort(record) ?? resolveGamTennantCondensedShort(record) ?? rewritten.short;
      assert.equal(prepared.product.description, resolveGamResidualCleaningShort(record, previousShort) ?? previousShort);
      assert.ok(words(rewritten.short) <= 45);
      assert.ok(words(rewritten.short) >= 12);
      assert.ok(words(prepared.product.description_general) <= 800);
      const sentences = record.shortDescription.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u);
      const complete = sentences.filter((sentence, index) => index === 0 || /[.!?]$/u.test(sentence));
      for (const number of numbers(complete.join(" "))) {
        assert.ok(numbers(`${rewritten.short} ${general ?? ""}`).has(number), `${record.reference}: ${number}`);
      }
      const previousGeneral = resolveGamCleaningCondensedGeneral(record) ?? resolveGamTennantCondensedGeneral(record) ?? rewritten.general;
      const legacyGeneral = resolveGamResidualCleaningGeneral(record, previousGeneral) ?? previousGeneral;
      const suffix = record.year ? ` Año de fabricación de esta unidad: ${record.year}.` : "";
      const underlying = suffix && general?.endsWith(suffix) ? general.slice(0, -suffix.length) : general;
      if (underlying !== legacyGeneral) {
        assert.ok(prepared.product.description_general?.includes(record.model ?? "INVALID"), record.reference);
        assert.ok(prepared.product.description_general?.includes("kg") || prepared.product.description_general?.includes("mm"), record.reference);
      }
      assert.ok(!/[a-z] (?:p|con un bajo co|rendi)$/iu.test(rewritten.general));
    }
    assert.equal(JSON.stringify(record), source);
  }
  assert.deepEqual(found, affected);
});

test("GAM: no permite identidad, fuente o mediciones distintas para trasvasar el resumen", () => {
  const record = find("4039");
  const prepared = prepareSourceProduct(record);
  const general = prepared.product.description_general;
  assert.ok(general);
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "4030" },
    { ...record, condition: "Segunda mano" },
    { ...record, url: record.url.replace("online.gamrentals.com", "example.com") },
    { ...record, url: `${record.url}?utm_source=other` },
    { ...record, title: "Aspiradora TENNANT APL V-WD-72" },
    { ...record, model: "APL V-WD-72" },
    { ...record, brand: "Otra marca" },
    { ...record, specs: { ...record.specs, Modelo: "APL V-WD-72" } },
    { ...record, specs: { ...record.specs, Marca: "OTRA MARCA" } },
    { ...record, shortDescription: "Descripción sin respaldo de origen." },
    { ...record, shortDescription: record.shortDescription?.replace("18,5 kg", "28,5 kg") ?? null }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(rebalanceGamTechnicalShort(variant, general), null, String(index));
  }
  for (const record of gomariz.products) {
    assert.equal(rebalanceGamTechnicalShort(record, record.longDescription), null);
  }
});
