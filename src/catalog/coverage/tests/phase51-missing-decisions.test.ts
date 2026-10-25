import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parseCanonicalCatalog } from "../../canonical-catalog.js";
import { createCoverageReview, verifyCoverageReview } from "../review.js";
import { DEFAULT_CATEGORIES } from "../../../scraping/providers/gam/config.js";

const filename = new URL("../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url);
const previous = parseCanonicalCatalog(JSON.parse(await readFile(filename, "utf8")));
const missingReferences = new Set(["6942", "6948", "6366", "6676"]);
const products = previous.products.filter(({ reference }) => !missingReferences.has(reference ?? ""));
const current = parseCanonicalCatalog({ ...previous, productCount: products.length, products });
const expected = createCoverageReview(previous, current, "a".repeat(64), "b".repeat(64));
const listingEvidence = (reference: string): string => {
  const product = previous.products.find((item) => item.reference === reference);
  const category = DEFAULT_CATEGORIES.find((item) => item.key === product?.categoryKey);
  if (!category) throw new Error(`Categoría de referencia desconocida: ${reference}`);
  return category.url;
};
const reason = "Se contrastó manualmente la cobertura del listado español vigente";

const withMissingDecision = (decision: string, evidence: (reference: string, url: string) => readonly string[]) => ({
  ...expected,
  missing: expected.missing.map((item) => ({
    ...item, decision, reason, evidenceUrls: evidence(item.reference, item.url)
  }))
});
const officialListing = (reference: string): readonly string[] => [listingEvidence(reference)];

test("F51: no confunde una ausencia observada con retirada confirmada", () => {
  assert.deepEqual(new Set(expected.missing.map(({ reference }) => reference)), missingReferences);
  assert.ok(expected.missing.every(({ decision }) => decision === null));
  assert.throws(() => verifyCoverageReview(withMissingDecision("no_acreditado", officialListing), expected), /pendiente/);
  assert.throws(() => verifyCoverageReview(withMissingDecision("ausente", officialListing), expected), /pendiente/);
  assert.throws(() => verifyCoverageReview(withMissingDecision("ausencia_listado_acreditada", () => []), expected), /pendiente/);
});

test("F51: no permite acreditar listado con la antigua ficha ni con otra región", () => {
  const formerLinks = {
    ...expected,
    missing: expected.missing.map((item) => ({
      ...item, decision: "ausencia_listado_acreditada", reason, evidenceUrls: [item.url]
    }))
  };
  assert.throws(() => verifyCoverageReview(formerLinks, expected), /pendiente/);
  assert.throws(() => verifyCoverageReview(withMissingDecision("ausencia_listado_acreditada", (reference) => [
    listingEvidence(reference).replace("/es/", "/mx/")
  ]), expected), /pendiente/);
  assert.throws(() => verifyCoverageReview(withMissingDecision("ausencia_listado_acreditada", (reference) => [
    listingEvidence(reference).replace("online.gamrentals.com", "another.example")
  ]), expected), /pendiente/);
});

test("F51: admite ausencia de listado acreditada sin convertirla en retirada", () => {
  const report = withMissingDecision("ausencia_listado_acreditada", officialListing);
  assert.doesNotThrow(() => verifyCoverageReview(report, expected));
  assert.ok(report.missing.every(({ decision }) => decision !== "retirado"));
});

test("F51: mantiene válido el contrato de retirada F50", () => {
  const report = {
    ...expected,
    missing: expected.missing.map((item) => ({
      ...item, decision: "retirado", reason: "Baja acreditada por verificación directa con proveedor", evidenceUrls: [item.url]
    }))
  };
  assert.doesNotThrow(() => verifyCoverageReview(report, expected));
});

test("F51: aun cerrando las ausencias, los cambios pendientes bloquean selección", () => {
  const original = previous.products.find(({ reference }) => reference === "6683");
  assert.ok(original);
  const updated = products.map((product) => product.reference === "6683" ? { ...product, price: "1260" } : product);
  const altered = parseCanonicalCatalog({ ...current, products: updated });
  const expectedWithChange = createCoverageReview(previous, altered, "a".repeat(64), "b".repeat(64));
  assert.equal(expectedWithChange.changed.length, 1);
  const report = {
    ...expectedWithChange,
    missing: expectedWithChange.missing.map((item) => ({
      ...item, decision: "ausencia_listado_acreditada", reason, evidenceUrls: officialListing(item.reference)
    }))
  };
  assert.throws(() => verifyCoverageReview(report, expectedWithChange), /changed:6683/);
});
