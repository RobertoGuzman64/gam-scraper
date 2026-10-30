import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamLongDescription } from "../mapping/providers/gam/long-description.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const changedReferences = new Set([
  "6963", "4988", "5988", "4989", "5989", "4990", "5990", "4991", "5998", "5993",
  "5999", "6000", "5994", "6001", "5995", "5996", "5997", "6480", "6481", "6990", "6991"
]);

const sourceSentences = (text: string): string[] => text.trim()
  .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿])/u).map((sentence) => sentence.trim()).filter(Boolean);
const numbers = (text: string): string[] => [...new Set(text.match(/\d+(?:[.,]\d+)*/gu) ?? [])].sort();
const wordCount = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length;

test("GAM: las generales extensas se organizan sin perder cifras, frases técnicas ni orden", () => {
  const changed: string[] = [];
  let trimmed = 0;
  let removedWords = 0;
  for (const record of gam.products) {
    const snapshot = JSON.stringify(record);
    const general = resolveGamLongDescription(record);
    if (general) {
      assert.ok(record.reference);
      changed.push(record.reference);
      assert.ok(record.longDescription);
      assert.ok(general.includes("\n\n"));
      assert.deepEqual(numbers(general), numbers(record.longDescription), record.reference);
      const originalSentences = sourceSentences(record.longDescription);
      let previousIndex = -1;
      for (const sentence of sourceSentences(general)) {
        const index = originalSentences.findIndex((candidate, at) => at > previousIndex && candidate === sentence);
        assert.ok(index > previousIndex, `${record.reference}: frase nueva o desordenada`);
        previousIndex = index;
      }
      const difference = wordCount(record.longDescription) - wordCount(general);
      assert.ok(difference >= 0);
      if (difference > 0) trimmed++;
      removedWords += difference;
      const prepared = prepareSourceProduct(record);
      assert.equal(prepared.product.description_general, general);
      assert.equal(prepared.product.description, record.shortDescription?.trim() ?? null);
      assert.deepEqual(prepared.product.spec, record.specs);
      assert.equal(prepared.product.reference, record.reference);
      assert.equal(prepared.product.sourceUrl, record.url);
    }
    assert.equal(JSON.stringify(record), snapshot);
  }
  assert.equal(gam.products.length, 983);
  assert.deepEqual(new Set(changed), changedReferences);
  assert.equal(trimmed, 19);
  assert.equal(removedWords, 1768);
});

test("GAM: los dos extremos mantienen identidad, medidas, capacidades y datos energéticos", () => {
  for (const reference of ["5996", "5997"]) {
    const original = find(reference);
    const result = resolveGamLongDescription(original);
    assert.ok(result);
    assert.ok(original.longDescription);
    for (const fragment of [original.model ?? "", "80,8 kWh", "354,2 V", "228 Ah", "IPX4", "3.000 mm", "600 mm"]) {
      assert.ok(result.includes(fragment), `${reference}: ${fragment}`);
    }
    assert.ok(wordCount(result) < wordCount(original.longDescription));
  }
});

test("GAM: bloquea identidad ajena, referencias y fichas técnicas contradictorias", () => {
  const record = find("5996");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" },
    { ...record, categoryKey: "otros" },
    { ...record, reference: "5997" },
    { ...record, url: record.url.replace("online.gamrentals.com", "example.com") },
    { ...record, url: `${record.url}?tracking=1` },
    { ...record, title: "Carretilla elevadora eléctrica 6000KG Hyster ERP6.0MXLG6" },
    { ...record, model: "ERP7.0MXLG6" },
    { ...record, brand: "HYSTER" },
    { ...record, externalReference: "ERP7.0MXLG6" },
    { ...record, specs: { ...record.specs, Modelo: "ERP7.0MXLG6" } },
    { ...record, specs: { ...record.specs, Marca: "HYSTER" } },
    { ...record, specs: { ...record.specs, Marca: ["YALE"] } },
    { ...record, longDescription: "Descripción general correcta y breve." }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveGamLongDescription(variant), null, String(index));
  }
  for (const reference of ["5991", "5992", "6002", "6003", "6004"]) {
    assert.equal(resolveGamLongDescription(find(reference)), null, reference);
  }
});

test("GAM: protege una prestación no repetida aunque aparezca dentro de un cierre comercial", () => {
  const record = find("5996");
  assert.ok(record.longDescription);
  const source = record.longDescription.replace(
    "Por todo ello, la Yale ERP6.0MXLG6 constituye una alternativa",
    "Por todo ello, la Yale ERP6.0MXLG6 con frenado regenerativo certificado constituye una alternativa"
  );
  assert.notEqual(source, record.longDescription);
  const result = resolveGamLongDescription({ ...record, longDescription: source });
  assert.ok(result);
  assert.ok(result.includes("frenado regenerativo certificado"));
});

test("GAM: la regla no interviene en el catálogo Gomariz", async () => {
  const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
  assert.equal(gomariz.products.length, 143);
  for (const record of gomariz.products) assert.equal(resolveGamLongDescription(record), null);
});
