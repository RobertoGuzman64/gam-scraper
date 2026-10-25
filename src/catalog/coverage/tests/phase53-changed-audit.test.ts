import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parseCanonicalCatalog } from "../../canonical-catalog.js";
import { createCoverageReview, verifyCoverageReview } from "../review.js";

const file = new URL("../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url);
const previous = parseCanonicalCatalog(JSON.parse(await readFile(file, "utf8")));
const current = parseCanonicalCatalog({
  ...previous,
  products: previous.products.map((product) => {
    if (product.reference === "4989") return {
      ...product,
      longDescription: `${product.longDescription ?? ""} ${product.longDescription ?? ""}`,
      images: [product.images?.[0], product.images?.[1]].filter((url): url is string => Boolean(url))
    };
    if (product.reference === "5989") return {
      ...product, images: product.images?.slice(0, 1)
    };
    if (product.reference === "5996") return {
      ...product, shortDescription: `${product.shortDescription ?? ""} Revisión de origen`
    };
    if (product.reference === "5912") return { ...product, price: "8050" };
    return product;
  })
});
const report = createCoverageReview(previous, current, "a".repeat(64), "b".repeat(64));
const approved = () => ({
  ...report,
  changed: report.changed.map((entry) => ({
    ...entry,
    decision: "aceptado", reason: "Contraste individual documentado con el proveedor", evidenceUrls: [entry.url],
    fieldChecks: entry.fieldChecks.map((check) => ({
      ...check, decision: "aceptado", reason: "Campo comprobado sobre la publicación de origen", evidenceUrls: [entry.url]
    }))
  }))
});

test("F53: audita los cambios sensibles sin aprobar por defecto imágenes ni textos", () => {
  assert.deepEqual(new Set(report.changed.map((item) => item.reference)), new Set(["4989", "5989", "5996", "5912"]));
  const hyster = report.changed.find((item) => item.reference === "4989");
  const yale = report.changed.find((item) => item.reference === "5989");
  const short = report.changed.find((item) => item.reference === "5996");
  const price = report.changed.find((item) => item.reference === "5912");
  assert.ok(hyster && yale && short && price);
  assert.deepEqual(hyster.fieldChecks.map(({ field }) => field), ["images", "longDescription"]);
  assert.equal(hyster.audit.images?.primaryRetained, true);
  assert.equal(hyster.audit.images?.removed.length, (previous.products.find((item) => item.reference === "4989")?.images?.length ?? 0) - 2);
  assert.equal(hyster.audit.descriptions[0]?.currentLength, (current.products.find((item) => item.reference === "4989")?.longDescription?.length ?? 0));
  assert.notEqual(hyster.audit.descriptions[0]?.previousSha256, hyster.audit.descriptions[0]?.currentSha256);
  assert.deepEqual(yale.fieldChecks.map(({ field }) => field), ["images"]);
  assert.equal(yale.audit.images?.currentCount, 1);
  assert.deepEqual(short.fieldChecks.map(({ field }) => field), ["shortDescription"]);
  assert.deepEqual(price.fieldChecks, []);
  assert.deepEqual(price.audit.otherFields, [
    { field: "price", previousValue: null, currentValue: "8050" }
  ]);
  assert.throws(() => verifyCoverageReview(report, report), /changed:/);
});

test("F53: exige evidencias separadas de cada cambio sensible y mantiene compatibilidad de precio", () => {
  assert.doesNotThrow(() => verifyCoverageReview(approved(), report));
  const full = approved();
  const omit = { ...full, changed: full.changed.map((item) => item.reference !== "4989"
    ? item : { ...item, fieldChecks: item.fieldChecks.slice(1) }) };
  assert.throws(() => verifyCoverageReview(omit, report), /changed:4989/);
  const reject = { ...full, changed: full.changed.map((item) => item.reference !== "5989"
    ? item : { ...item, fieldChecks: item.fieldChecks.map((check) => ({ ...check, decision: "rechazado" })) }) };
  assert.throws(() => verifyCoverageReview(reject, report), /changed:5989/);
  const duplicate = { ...full, changed: full.changed.map((item) => item.reference !== "4989"
    ? item : { ...item, fieldChecks: [item.fieldChecks[0], item.fieldChecks[0]] }) };
  assert.throws(() => verifyCoverageReview(duplicate, report), /changed:4989/);
  const withoutEvidence = { ...full, changed: full.changed.map((item) => item.reference !== "5996"
    ? item : { ...item, fieldChecks: item.fieldChecks.map((check) => ({ ...check, evidenceUrls: [] })) }) };
  assert.throws(() => verifyCoverageReview(withoutEvidence, report), /changed:5996/);
});

test("F53: no permite falsear conteos, fotos añadidas, ni hashes de los textos", () => {
  const full = approved();
  const manipulated = { ...full, changed: full.changed.map((item) => item.reference !== "4989"
    ? item : { ...item, audit: { ...item.audit, images: { ...item.audit.images, currentCount: 5 } } }) };
  assert.throws(() => verifyCoverageReview(manipulated, report), /changed:4989/);
  const descriptions = { ...full, changed: full.changed.map((item) => item.reference !== "4989"
    ? item : { ...item, audit: { ...item.audit, descriptions: item.audit.descriptions.map((description) => ({
      ...description, currentSha256: "0".repeat(64)
    })) } }) };
  assert.throws(() => verifyCoverageReview(descriptions, report), /changed:4989/);
  assert.throws(() => verifyCoverageReview({ ...full, baselineSha256: "0".repeat(64) }, report), /caducada/);
});
