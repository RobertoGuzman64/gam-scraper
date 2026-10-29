import assert from "node:assert/strict";
import test from "node:test";
import { requireProductReference } from "./require-product-reference.js";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { sourceSignalForIssue } from "../../diagnostics/source-triage.js";
import { classifyQualityIssue } from "../offline-diagnostics.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";
import { SOURCE_CATEGORY_ISSUE } from "../source/category-quality.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));

const reference = (code: string): ProductRecord => requireProductReference(source.products, code);

test("tipo de origen corroborado sin categoría del receptor no es motivo de review", () => {
  for (const code of ["6653", "4778", "4779", "4780", "2159", "220", "221", "227", "2134", "2135"]) {
    const record = reference(code);
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.status, "ready", code);
    assert.deepEqual(prepared.issues, [], code);
    assert.equal(prepared.product.categorySellID, null, code);
    assert.equal(prepared.product.category, null, code);
    assert.deepEqual(prepared.product.spec, record.specs ?? {}, code);
    assert.deepEqual(prepared.product.attributes, [], code);
    assert.ok(prepared.importIssues?.excel.some((issue) => issue.startsWith("Categoría no ")), code);
    assert.ok(prepared.importIssues?.createMany.some((issue) => issue.startsWith("Categoría no ")), code);
  }
});

test("las motorizaciones incompatibles fuera de evidencia conservan revisión", () => {
  const h18xd = reference("2071");
  const preparedH18xd = prepareProduct({ ...h18xd, longDescription: `${h18xd.longDescription} distinta evidencia` }, catalog);
  assert.equal(preparedH18xd.status, "ready");
  assert.ok(!preparedH18xd.issues.includes(SOURCE_CATEGORY_ISSUE));
  assert.equal(preparedH18xd.product.categorySellID, null);
  const mismatch = reference("6653");
  const prepared = prepareProduct({ ...mismatch, url: mismatch.url.replace("/barredoras/", "/fregadoras/") }, catalog);
  assert.equal(prepared.status, "ready");
  assert.ok(!prepared.issues.includes(SOURCE_CATEGORY_ISSUE));
});

test("atributos de fuente se auditan sin categoría del receptor ni IDs inventados", () => {
  const record = reference("6653");
  const valid = prepareProduct({ ...record, specs: { ...record.specs, "Ancho de trabajo": "900 mm" } }, catalog);
  assert.equal(valid.status, "ready");
  assert.deepEqual(valid.product.attributes, []);
  const invalid = prepareProduct({ ...record, specs: { ...record.specs, "Ancho de trabajo": "medida indeterminada" } }, catalog);
  assert.equal(invalid.status, "review");
  assert.ok(invalid.issues.includes("Atributo no normalizable: Ancho de trabajo"));
  assert.deepEqual(invalid.product.attributes, []);
  assert.equal(invalid.product.spec["Ancho de trabajo"], "medida indeterminada");
  const yale = reference("2312");
  const contradiction = prepareProduct({ ...yale, specs: { ...yale.specs, "Capacidad de carga (kg)": "3500 KG" } }, catalog);
  assert.equal(contradiction.status, "review");
  assert.ok(contradiction.issues.includes("Atributo contradictorio: Capacidad de carga"));
});

test("clasificación de origen pendiente queda diferenciada de la importación", () => {
  const unidentified = prepareProduct({ ...reference("6806"), model: "sin confirmar" }, catalog);
  assert.equal(unidentified.status, "review");
  assert.ok(unidentified.issues.includes("Atributo contradictorio: Modelo"));
  assert.ok(!unidentified.issues.includes(SOURCE_CATEGORY_ISSUE));
  assert.equal(classifyQualityIssue(SOURCE_CATEGORY_ISSUE).code, "quality.source_category_unconfirmed");
  assert.equal(classifyQualityIssue(SOURCE_CATEGORY_ISSUE).classification, "origen_por_contrastar");
  assert.equal(sourceSignalForIssue(SOURCE_CATEGORY_ISSUE, { ...reference("6806"), model: "sin confirmar" }), "sin_evidencia_local");
});
