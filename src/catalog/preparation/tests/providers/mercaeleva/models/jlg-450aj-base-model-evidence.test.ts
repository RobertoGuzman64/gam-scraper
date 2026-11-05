import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readMercaelevaSource } from "../../../../../../testing/builders/mercaeleva-source-fixture.js";
import { reconcileMercaelevaVerifiedJlg450AjBaseModel } from "../../../../reconciliation/mercaeleva-jlg-450aj.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { sourceSemanticQualityIssues } from "../../../../source/semantic-quality.js";

const records = await readMercaelevaSource();
const references = ["M838-0666", "M969-4655"] as const;
const find = (reference: string): ProductRecord => {
  const record = records.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("JLG 450AJ: solo se retira la serie contradictoria en las dos unidades acreditadas", () => {
  for (const reference of references) {
    const source = find(reference);
    const original = JSON.stringify(source);
    assert.equal(sourceSemanticQualityIssues(source).length, 1, reference);
    const reconciled = reconcileMercaelevaVerifiedJlg450AjBaseModel(source);
    assert.notStrictEqual(reconciled, source, reference);
    assert.equal(reconciled.model, "450 AJ", reference);
    assert.equal(reconciled.specs?.Modelo, "450 AJ", reference);
    assert.equal(reconciled.reference, source.reference, reference);
    assert.equal(reconciled.url, source.url, reference);
    assert.deepEqual(sourceSemanticQualityIssues(reconciled), [], reference);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.issues, [], reference);
    assert.equal(prepared.product.reference, source.reference, reference);
    assert.equal(prepared.product.sourceUrl, source.url, reference);
    assert.equal(prepared.product.spec?.Modelo, "450 AJ", reference);
    assert.doesNotMatch(`${prepared.product.title} ${prepared.product.description} ${prepared.product.description_general} ${JSON.stringify(prepared.product.spec)}`, /\bSII\b|\bSIII\b/iu, reference);
    assert.equal(JSON.stringify(source), original, reference);
  }
});

test("JLG 450AJ: cambio de identidad, anuncio o ficha impide la conciliación", () => {
  for (const reference of references) {
    const source = find(reference);
    const alterations: readonly ProductRecord[] = [
      { ...source, providerId: "gam" },
      { ...source, reference: "M000-0000" },
      { ...source, url: `${source.url}?test=1` },
      { ...source, model: "450 AJ SII" },
      { ...source, title: "JLG 450 AJ SII PLATAFORMA ARTICULADA DIESEL 16 MT" },
      { ...source, year: "2014" },
      { ...source, horometer: "0" },
      { ...source, longDescription: source.longDescription?.replace("SII", "SIII") ?? null },
      { ...source, specs: { ...source.specs, Modelo: "450 AJ SII" } },
      { ...source, specs: { ...source.specs, "Artículo No.": "0" } }
    ];
    for (const [index, altered] of alterations.entries()) {
      assert.strictEqual(reconcileMercaelevaVerifiedJlg450AjBaseModel(altered), altered, `${reference} / ${index}`);
    }
    const refreshed = { ...source, scrapedAt: "2026-11-05T00:00:00.000Z" };
    assert.notStrictEqual(reconcileMercaelevaVerifiedJlg450AjBaseModel(refreshed), refreshed, reference);
  }
});

test("JLG 450AJ: no se interviene el resto de Mercaeleva", () => {
  const affected = records.filter((record) => reconcileMercaelevaVerifiedJlg450AjBaseModel(record) !== record);
  assert.deepEqual(affected.map((record) => record.reference).sort(), [...references].sort());
});
