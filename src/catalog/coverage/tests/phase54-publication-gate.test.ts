import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parseCanonicalCatalog } from "../../canonical-catalog.js";
import { DEFAULT_CATEGORIES } from "../../../scraping/providers/gam/config.js";
import { assessNewGamCoverage } from "../gam-review-gate.js";

const filename = new URL("../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url);
const previous = parseCanonicalCatalog(JSON.parse(await readFile(filename, "utf8")));
const missing = new Set(["6942", "6948", "6366", "6676"]);
const remaining = previous.products.filter(({ reference }) => !missing.has(reference ?? ""));
const changed = new Set(remaining.slice(0, 23).map(({ reference }) => reference));
changed.add("4989");
assert.equal(changed.size, 24);
const products = remaining.map((product) => {
  if (!changed.has(product.reference)) return product;
  if (product.reference === "4989") return {
    ...product,
    images: product.images?.slice(0, 1),
    longDescription: `${product.longDescription ?? ""} Información adicional de la publicación`
  };
  return { ...product, price: product.price === "9900" ? "9901" : "9900" };
});
const current = parseCanonicalCatalog({ ...previous, productCount: products.length, products });
const baselineSha = "a".repeat(64);
const currentSha = "b".repeat(64);
const report = assessNewGamCoverage(previous, current, baselineSha, currentSha, undefined);
const reason = "Contrastado individualmente con el catálogo de origen";
const approved = () => ({
  ...report,
  missing: report.missing.map((entry) => {
    const source = previous.products.find((item) => item.reference === entry.reference);
    const category = DEFAULT_CATEGORIES.find((item) => item.key === source?.categoryKey);
    assert.ok(category);
    return { ...entry, decision: "ausencia_listado_acreditada", reason, evidenceUrls: [category.url] };
  }),
  changed: report.changed.map((entry) => ({
    ...entry, decision: "aceptado", reason, evidenceUrls: [entry.url],
    fieldChecks: entry.fieldChecks.map((check) => ({
      ...check, decision: "aceptado", reason, evidenceUrls: [entry.url]
    }))
  }))
});

test("F54: exige las cuatro ausencias exactas y los 24 cambios de la cohorte", () => {
  assert.deepEqual(new Set(report.missing.map(({ reference }) => reference)), missing);
  assert.equal(report.changed.length, 24);
  assert.deepEqual(report.changed.find(({ reference }) => reference === "4989")?.fieldChecks.map(({ field }) => field), [
    "images", "longDescription"
  ]);
  assert.throws(() => assessNewGamCoverage(previous, previous, baselineSha, currentSha, undefined), /cuatro ausencias/);
  const restored = previous.products.find(({ reference }) => reference === "6942");
  assert.ok(restored);
  const unexpected = parseCanonicalCatalog({ ...previous, productCount: products.length + 1, products: [...products, restored] });
  assert.throws(() => assessNewGamCoverage(previous, unexpected, baselineSha, currentSha, undefined), /cuatro ausencias/);
});

test("F54: no transforma un expediente pendiente en autorización editorial", () => {
  assert.throws(() => assessNewGamCoverage(previous, current, baselineSha, currentSha, report), /pendiente/);
  const unverified = { ...approved(), missing: approved().missing.map((entry) => ({ ...entry, decision: "no_acreditado" })) };
  assert.throws(() => assessNewGamCoverage(previous, current, baselineSha, currentSha, unverified), /pendiente/);
  const partial = approved();
  const omitImage = {
    ...partial,
    changed: partial.changed.map((entry) => entry.reference === "4989"
      ? { ...entry, fieldChecks: entry.fieldChecks.slice(1) } : entry)
  };
  assert.throws(() => assessNewGamCoverage(previous, current, baselineSha, currentSha, omitImage), /changed:4989/);
});

test("F54: una revisión completa corresponde exactamente al origen auditado", () => {
  assert.doesNotThrow(() => assessNewGamCoverage(previous, current, baselineSha, currentSha, approved()));
  assert.throws(() => assessNewGamCoverage(previous, current, baselineSha, "c".repeat(64), approved()), /caducada/);
  const tampered = {
    ...approved(), changed: approved().changed.map((entry) => entry.reference === "4989"
      ? { ...entry, audit: { ...entry.audit, descriptions: [] } } : entry)
  };
  assert.throws(() => assessNewGamCoverage(previous, current, baselineSha, currentSha, tampered), /changed:4989/);
});
