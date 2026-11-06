import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { discoverAccreditedPublications, readAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { loadImportCatalog } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { projectCommercialCategory } from "../../commercial/projection/category-projection.js";
import { planCommercialExport } from "../../commercial/projection/export-projection.js";
import { accreditCommercialPlan } from "../../commercial/diagnostics/commercial-accreditation.js";
import { prepareImportBatch } from "../batch-identity.js";
import { prepareSourceProduct } from "../prepare-product.js";

const root = process.cwd();
const catalog = await loadImportCatalog();
const publications = await Promise.all(
  (await discoverAccreditedPublications(root)).map((file) => readAccreditedPublication(file))
);

const datasets = await Promise.all(publications.map(async (published) => {
  const original = await readCanonicalCatalog(
    `catalogs/providers/${published.providerId}/original/scrape-${published.providerId}-catalog.json`
  );
  const byReference = new Map(original.products.map((product) => [product.reference, product]));
  const selected = published.products.map((product) => {
    const source = byReference.get(product.reference);
    assert.ok(source, `${published.providerId}:${product.reference} sin original`);
    assert.equal(source.url, product.sourceUrl, `${published.providerId}:${product.reference} sin trazabilidad`);
    return source;
  });
  return { published, original, selected };
}));

test("el catálogo acreditado tiene identidad completa y la preparación no altera los originales", () => {
  assert.ok(datasets.length > 0);
  const identities = new Set<string>();
  for (const { published, original, selected } of datasets) {
    assert.ok(original.products.length >= selected.length, published.providerId);
    const previous = JSON.stringify(selected);
    const prepared = prepareImportBatch(selected);
    assert.equal(prepared.products.length, published.products.length, published.providerId);
    assert.equal(prepared.totals.ready + prepared.totals.review, selected.length, published.providerId);
    assert.equal(JSON.stringify(selected), previous, published.providerId);
    for (const [index, result] of prepared.products.entries()) {
      const current = published.products[index];
      assert.ok(current);
      const key = JSON.stringify([result.product.providerId, result.product.reference, result.product.sourceUrl]);
      assert.ok(!identities.has(key), `Identidad duplicada ${key}`);
      identities.add(key);
      assert.equal(result.product.providerId, current.providerId);
      assert.equal(result.product.reference, current.reference);
      assert.equal(result.product.sourceUrl, current.sourceUrl);
      assert.ok(result.product.title?.trim(), key);
      assert.ok(result.product.description?.trim(), key);
      assert.ok(result.product.description_general?.trim(), key);
      assert.ok(result.product.image && result.product.images.includes(result.product.image), key);
      assert.equal(result.status === "review", result.issues.length > 0, key);
    }
  }
  assert.equal(identities.size, publications.reduce((total, item) => total + item.products.length, 0));
});

test("la futura proyección comercial conserva los datos técnicos recalculados y no introduce bloqueos", () => {
  for (const { published, selected } of datasets) {
    const before = JSON.stringify(selected);
    const mapped = prepareImportBatch(selected, catalog);
    const entries = selected.map((source, index) => {
      const technical = prepareSourceProduct(source);
      const commercial = mapped.products[index];
      assert.ok(commercial);
      for (const field of ["title", "description_title", "description", "description_general", "spec", "image", "images"] as const) {
        assert.deepEqual(commercial.product[field], technical.product[field], `${source.providerId}:${source.reference}:${field}`);
      }
      return { source, published: technical.product, mapped: projectCommercialCategory(source, commercial, catalog) };
    });
    const plan = planCommercialExport(entries, published.providerId, published.sha256, catalog, [], null, null);
    const accreditation = accreditCommercialPlan(entries, plan, catalog, [], null);
    assert.equal(plan.products.length + plan.excluded.length, published.products.length);
    assert.equal(accreditation.summary.blocking, 0, published.providerId);
    assert.equal(accreditation.summary.lostFields, 0, published.providerId);
    assert.equal(accreditation.summary.changedFields, 0, published.providerId);
    assert.equal(JSON.stringify(selected), before, published.providerId);
  }
});
