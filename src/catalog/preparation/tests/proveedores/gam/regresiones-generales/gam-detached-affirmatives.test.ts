import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { removeGamDetachedAffirmatives } from "../../../../mapping/providers/gam/descripciones-editorial/long-description.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const expected = new Set([
  "6874", "6322", "6113", "6114", "6323", "4988", "4989", "6325",
  "4990", "6326", "4991", "6327", "6573", "6574", "2370"
]);

const recordOf = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM: retira respuestas comerciales sueltas de las descripciones acreditadas", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const before = record.longDescription;
    const prepared = prepareSourceProduct(record).product.description_general;
    if (!before || !prepared) continue;
    if (!expected.has(record.reference ?? "")) {
      assert.equal(removeGamDetachedAffirmatives(record, prepared), null, record.reference ?? "sin referencia");
      continue;
    }
    const cleaned = removeGamDetachedAffirmatives(record, before);
    assert.ok(record.reference);
    assert.ok(cleaned);
    changed.add(record.reference);
    assert.equal(cleaned, before.replace(/(?<=\.)\s+Sí\.\s+(?=[A-ZÁÉÍÓÚÑ])/gu, " "));
    assert.equal(prepared.match(/(?<=\.)\s+Sí\.\s+(?=[A-ZÁÉÍÓÚÑ])/gu), null);
  }
  assert.deepEqual(changed, expected);
  for (const record of gomariz.products) {
    assert.equal(removeGamDetachedAffirmatives(record, record.longDescription), null, record.reference ?? "sin referencia");
  }
});

test("GAM: no limpia identidades contradictorias, URLs modificadas ni respuestas con pregunta", () => {
  const record = recordOf("6113");
  const text = record.longDescription;
  assert.ok(text);
  assert.ok(removeGamDetachedAffirmatives(record, text));
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" },
    { ...record, categoryKey: "venta" },
    { ...record, brand: "HYSTER" },
    { ...record, model: "ERP18UXTL" },
    { ...record, externalReference: "ERP18UXTL" },
    { ...record, title: "Carretilla de otra marca" },
    { ...record, specs: { ...record.specs, Modelo: "ERP18UXTL" } },
    { ...record, url: record.url.replace("6113-", "6114-") },
    { ...record, url: `${record.url}?variant=other` },
    { ...record, url: `${record.url}#spec` },
    { ...record, longDescription: text.replace("Sí.", "¿Se puede usar en interior? Sí.") },
    { ...record, longDescription: `${text} Sí. Otro texto.` },
    { ...record, longDescription: text.replace("Sí.", "No.") }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(removeGamDetachedAffirmatives(variant, variant.longDescription), null, String(index));
  }
});

test("GAM: no modifica el texto técnico o las preguntas legítimas", () => {
  for (const reference of ["6323", "6325", "4988"]) {
    const record = recordOf(reference);
    const before = record.longDescription;
    assert.ok(before);
    const cleaned = removeGamDetachedAffirmatives(record, before);
    assert.ok(cleaned);
    const sourceWithoutResidual = before.replace(/(?<=\.)\s+Sí\.\s+(?=[A-ZÁÉÍÓÚÑ])/gu, " ");
    assert.equal(cleaned, sourceWithoutResidual);
    if (before.includes("?")) assert.ok(cleaned.includes("?"));
  }
  for (const reference of ["6324", "5991", "5992", "6002", "6003", "6004", "2373", "4626", "6332"]) {
    const record = recordOf(reference);
    assert.equal(removeGamDetachedAffirmatives(record, record.longDescription), null, reference);
  }
});
