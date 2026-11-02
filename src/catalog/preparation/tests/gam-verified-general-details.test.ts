import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamGeneralDescription } from "../mapping/providers/gam/general-description.js";
import { resolveGamVerifiedSourceCondensedGeneral } from "../evidence/providers/gam/verified-source-condensed-generals.js";
import { resolveGamVerifiedBriefGeneral } from "../mapping/providers/gam/brief-technical-general.js";
import { resolveGamSourceIdentifiedModel } from "../mapping/providers/gam/model-identified-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const verifiedBrief = new Set(["2620", "2621", "2622", "2623", "2624", "2625", "2626", "2627", "2297", "2229", "2334", "2202", "4774"]);
const identified = new Set(["6634", "3314"]);
const numbers = (value: string): string[] => [...new Set(value.match(/\d+(?:[.,]\d+)*/gu) ?? [])].sort();
const count = (value: string): number => value.split(/\s+/u).filter(Boolean).length;
const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("completa solo trece generales breves con datos de su propia ficha", () => {
  const modified = new Set<string>();
  for (const record of gam.products) {
    const original = JSON.stringify(record);
    const base = resolveGamGeneralDescription(record);
    const enriched = resolveGamVerifiedBriefGeneral(record, base);
    if (enriched) {
      assert.ok(record.reference);
      modified.add(record.reference);
      assert.ok(base);
      assert.ok(count(base) < 60 && count(enriched) >= 60, record.reference);
      assert.ok(enriched.startsWith(`${base} `), record.reference);
      assert.ok(numbers(base).every((value) => numbers(enriched).includes(value)), record.reference);
      assert.equal(prepareSourceProduct(record).product.description_general, enriched, record.reference);
    }
    assert.equal(JSON.stringify(record), original, record.reference ?? "sin referencia");
  }
  assert.deepEqual(modified, verifiedBrief);
});

test("identifica dos modelos sin modificar la narración acreditada", () => {
  const modified = new Set<string>();
  for (const record of gam.products) {
    const general = record.longDescription?.trim() ?? null;
    const identifiedGeneral = resolveGamSourceIdentifiedModel(record, general);
    if (identifiedGeneral) {
      assert.ok(record.reference);
      modified.add(record.reference);
      assert.ok(identifiedGeneral.endsWith(general ?? ""));
      assert.ok(identifiedGeneral.startsWith(`Modelo identificado en la ficha: ${record.brand} ${record.model}.`));
      const condensed = resolveGamVerifiedSourceCondensedGeneral(record);
      const prepared = prepareSourceProduct(record).product.description_general;
      assert.equal(prepared, condensed ?? identifiedGeneral);
      if (condensed) {
        assert.match(prepared ?? "", /Logitrans Logiq 200/u);
        assert.match(prepared ?? "", /212H04217979/u);
        assert.match(prepared ?? "", /sin lectura válida/u);
      }
    }
  }
  assert.deepEqual(modified, identified);
});

test("rechaza identidad, procedencia o evidencia alterada", () => {
  for (const reference of verifiedBrief) {
    const record = find(reference);
    const base = resolveGamGeneralDescription(record);
    assert.ok(base && resolveGamVerifiedBriefGeneral(record, base));
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: "0" },
      { ...record, url: "https://example.com/otro-modelo" },
      { ...record, model: "Otro modelo" },
      { ...record, title: "Modelo distinto" },
      { ...record, categoryKey: "otros" },
      { ...record, specs: { ...record.specs, Modelo: "Otro modelo" } },
      { ...record, longDescription: "Origen sustituido" },
      { ...record, specs: { ...record.specs, "Peso": "10 KG", "Capacidad de la batería": "otra", "Dimensiones Cesta": "indefinida", "Altura de elevación (mm)": "-" } }
    ];
    for (const [index, variant] of variants.entries()) {
      assert.equal(resolveGamVerifiedBriefGeneral(variant, base), null, `${reference}:${index}`);
    }
    assert.equal(resolveGamVerifiedBriefGeneral(record, `${base} Texto cambiado.`), null, reference);
  }
  for (const reference of identified) {
    const record = find(reference);
    const base = record.longDescription?.trim() ?? null;
    assert.ok(resolveGamSourceIdentifiedModel(record, base));
    for (const variant of [
      { ...record, providerId: "gomariz" },
      { ...record, url: "https://example.com/otro-modelo" },
      { ...record, model: "OTRO" },
      { ...record, specs: { ...record.specs, Modelo: "OTRO" } },
      { ...record, shortDescription: "Modelo distinto" },
      { ...record, longDescription: "Otro texto" }
    ]) assert.equal(resolveGamSourceIdentifiedModel(variant, base), null, reference);
  }
});

test("los resolutores GAM no intervienen en Gomariz", () => {
  for (const record of gomariz.products) {
    const general = record.longDescription?.trim() ?? null;
    assert.equal(resolveGamSourceIdentifiedModel(record, general), null);
    assert.equal(resolveGamVerifiedBriefGeneral(record, general), null);
  }
});
