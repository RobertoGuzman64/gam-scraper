import assert from "node:assert/strict";
import test from "node:test";
import { buildReviewCensus } from "../diagnostics/review-census.js";
import { sourceSignalForIssue } from "../diagnostics/source-triage.js";
import { classifyQualityIssue } from "../import/preparation/offline-diagnostics.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/canonical-catalog.js";
import { readOfflinePreparation } from "../../infrastructure/filesystem/offline-preparation.js";

const provider = "gam";
const prefix = "scrape-gam-marzo-2026";
const catalog = await readCanonicalCatalog(`src/testing/fixtures/census/${provider}/${prefix}-catalog.json`);
const preparation = await readOfflinePreparation(
  `src/testing/fixtures/census/preparations/${provider}/${prefix}-census-preparation.json`, provider
);

const narrowed = (count: number) => ({
  catalog: { ...catalog, productCount: count, products: catalog.products.slice(0, count) },
  preparation: {
    ...preparation, source: { ...preparation.source, productCount: count },
    identities: preparation.identities.slice(0, count), products: preparation.products.slice(0, count),
    totals: {
      ready: preparation.products.slice(0, count).filter((item) => item.status === "ready").length,
      review: preparation.products.slice(0, count).filter((item) => item.status === "review").length
    }
  }
});

test("el censo reproduce las review sin duplicarlas ni mezclar receptor con evidencia de origen", () => {
  const entries = buildReviewCensus(catalog, preparation);
  assert.equal(entries.length, preparation.totals.review);
  assert.equal(entries.length + preparation.totals.ready, catalog.productCount);
  assert.equal(new Set(entries.map((entry) => entry.identity)).size, entries.length);
  assert.ok(entries.some((entry) => entry.issues.some((item) => item.classification === "dato_presente_no_mapeado")));
  assert.ok(entries.some((entry) => entry.issues.some((item) => item.classification === "identidad")));
  for (const entry of entries) {
    assert.equal(entry.prepared.status, "review");
    assert.equal(entry.issues.length, new Set(entry.prepared.issues).size);
    assert.equal(entry.prepared.product.sourceUrl, entry.source.url);
    assert.ok(entry.issues.every((issue) => issue.classification !== "no_determinado"));
    for (const issue of entry.issues) {
      if (issue.code === "mapping.category") {
        assert.equal(issue.classification, "dato_presente_no_mapeado");
        assert.equal(issue.signal, "equivalencia_pendiente");
      }
    }
  }
});

test("el censo protege la identidad, el universo y los motivos sin alterar las reviews", () => {
  const sample = narrowed(12);
  assert.doesNotThrow(() => buildReviewCensus(sample.catalog, sample.preparation));
  assert.throws(() => buildReviewCensus(sample.catalog, {
    ...sample.preparation, identities: ["gam:ref:otra", ...sample.preparation.identities.slice(1)]
  }), /identidad u origen incoherente/);
  assert.throws(() => buildReviewCensus(sample.catalog, {
    ...sample.preparation, totals: { ...sample.preparation.totals, review: sample.preparation.totals.review + 1 }
  }), /universo/);
  const index = sample.preparation.products.findIndex((item) => item.status === "review");
  assert.notEqual(index, -1);
  const reviews = sample.preparation.products.map((entry, at) => at === index ? { ...entry, issues: ["Motivo desconocido"] } : entry);
  assert.throws(() => buildReviewCensus(sample.catalog, { ...sample.preparation, products: reviews }), /sin clasificación/);
});

test("las incidencias de importación no cambian la condición ni los motivos del censo", () => {
  const sample = narrowed(12);
  const original = buildReviewCensus(sample.catalog, sample.preparation);
  const altered = sample.preparation.products.map((entry) => ({
    ...entry, importIssues: { excel: ["Precio ausente o inválido"], createMany: ["Categoría no válida para create/many"] }
  }));
  const next = buildReviewCensus(sample.catalog, { ...sample.preparation, products: altered });
  assert.deepEqual(next.map((entry) => ({ identity: entry.identity, issues: entry.issues })),
    original.map((entry) => ({ identity: entry.identity, issues: entry.issues })));
});

test("la contradicción de identidad GAM tiene una clasificación concreta y no se ignora", () => {
  const reason = "Identidad GAM contradictoria entre título, resumen y ficha técnica";
  assert.deepEqual(classifyQualityIssue(reason), { code: "identity.gam_source_conflict", classification: "identidad" });
  const source = catalog.products[0];
  assert.ok(source);
  assert.equal(sourceSignalForIssue(reason, source), "identidad");
  assert.deepEqual(classifyQualityIssue("Condición comercial contradictoria entre la ficha y el origen"), {
    code: "condition.contradictory", classification: "contradiccion"
  });
});
