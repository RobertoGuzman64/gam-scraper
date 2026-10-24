import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parseCanonicalCatalog } from "../../canonical-catalog.js";
import { compareCanonicalCoverage } from "../compare.js";
import { createCoverageReview, verifyCoverageReview } from "../review.js";

const filename = new URL("../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url);
const prior = parseCanonicalCatalog(JSON.parse(await readFile(filename, "utf8")));
const lost = new Set(["6942", "6948", "6366", "6676"]);
const currentProducts = prior.products.filter(({ reference }) => !lost.has(reference ?? ""))
  .map((product) => product.reference === "6683" ? {
    ...product, price: "1260", scrapedAt: "2026-10-25T00:00:00Z"
  } : product);
const current = parseCanonicalCatalog({ ...prior, productCount: currentProducts.length, products: currentProducts });

const reviewed = () => {
  const report = createCoverageReview(prior, current, "a".repeat(64), "b".repeat(64));
  return {
    ...report,
    missing: report.missing.map((item) => ({
      ...item, decision: "retirado", reason: "Confirmado manualmente por el proveedor", evidenceUrls: [item.url]
    })),
    changed: report.changed.map((item) => ({
      ...item, decision: "aceptado", reason: "Cambio de precio contrastado en el anuncio", evidenceUrls: [item.url]
    }))
  };
};

test("F50: identifica cuatro ausencias y cambios de campo sin confundir fecha de scraping", () => {
  const delta = compareCanonicalCoverage(prior, current);
  assert.equal(delta.missing.length, 4);
  assert.equal(delta.changed, 1);
  assert.deepEqual(delta.changedDetails.map(({ reference, fields }) => ({ reference, fields })), [
    { reference: "6683", fields: ["price"] }
  ]);
});

test("F50: impide aprobar reportes pendientes", () => {
  const report = createCoverageReview(prior, current, "a".repeat(64), "b".repeat(64));
  assert.equal(report.missing.length, 4);
  assert.equal(report.changed.length, 1);
  assert.throws(() => verifyCoverageReview(report, report), /pendiente/);
});

test("F50: revisión manual completa y trazable", () => {
  const report = createCoverageReview(prior, current, "a".repeat(64), "b".repeat(64));
  assert.doesNotThrow(() => verifyCoverageReview(reviewed(), report));
});

test("F50: bloquea hashes caducados, campos falsificados y referencias repetidas", () => {
  const report = createCoverageReview(prior, current, "a".repeat(64), "b".repeat(64));
  const decision = reviewed();
  assert.throws(() => verifyCoverageReview({ ...decision, currentSha256: "c".repeat(64) }, report), /caducada/);
  assert.throws(() => verifyCoverageReview({ ...decision, changed: decision.changed.map((item) => ({
    ...item, fields: ["model"]
  })) }, report), /incoherente/);
  assert.throws(() => verifyCoverageReview({ ...decision, missing: [decision.missing[0], decision.missing[0],
    decision.missing[2], decision.missing[3]] }, report), /duplicadas/);
});

test("F50: deniega decisiones sin evidencia, motivos vacíos y referencias extras", () => {
  const report = createCoverageReview(prior, current, "a".repeat(64), "b".repeat(64));
  const decision = reviewed();
  assert.throws(() => verifyCoverageReview({ ...decision, changed: decision.changed.map((item) => ({
    ...item, evidenceUrls: []
  })) }, report), /pendiente/);
  assert.throws(() => verifyCoverageReview({ ...decision, missing: decision.missing.map((item) => ({
    ...item, reason: "OK"
  })) }, report), /pendiente/);
  assert.throws(() => verifyCoverageReview({ ...decision, missing: decision.missing.slice(1) }, report), /incompleta/);
});
