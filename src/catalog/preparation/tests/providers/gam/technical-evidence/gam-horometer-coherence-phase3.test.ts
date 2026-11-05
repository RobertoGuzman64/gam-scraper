import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { reconcileGamHorometer } from "../../../../reconciliation/gam-horometer.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { prepareProduct } from "../../../../../legacy-export/prepare-product.js";
import { resolveAttribute } from "../../../../mapping/attribute-mapping.js";
import { loadImportCatalog } from "../../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const catalog = await loadImportCatalog();
const usedHours = catalog.attributes.find((attribute) => attribute.name === "Horas de uso");
assert.ok(usedHours);
const usedHourIds = new Set(catalog.attributes.filter((attribute) => attribute.name === "Horas de uso").map((attribute) => attribute.id));

const byReference = (reference: string): ProductRecord => {
  const found = gam.products.find((record) => record.reference === reference);
  assert.ok(found, reference);
  return found;
};

const missing = /^na(?:\s+[a-z]\d{8,20})?\s+horas$/iu;
const replaced = /^hor[oó]metro\s+sustituido\s+horas$/iu;

test("fase 3: 57 lecturas no cuantitativas GAM se representan sin inventar horas ni alterar originales", () => {
  const affected = gam.products.filter((record) =>
    record.horometer !== null && (missing.test(record.horometer) || replaced.test(record.horometer))
  );
  assert.equal(affected.length, 57);
  assert.equal(affected.filter((record) => replaced.test(record.horometer ?? "")).length, 25);
  assert.equal(affected.filter((record) => record.horometer === "NA horas").length, 31);
  assert.equal(affected.filter((record) => record.horometer === "NA V72309090022 horas").length, 1);
  for (const record of affected) {
    const sourceBefore = JSON.stringify(record);
    const reconciled = reconcileGamHorometer(record);
    const prepared = prepareSourceProduct(record);
    const commercial = prepareProduct(record, catalog);
    const isReplacement = replaced.test(record.horometer ?? "");
    assert.equal(reconciled.horometer, null, record.reference ?? "");
    assert.equal(reconciled.specs?.["Horómetro"], isReplacement ? "Horómetro sustituido" : undefined, record.reference ?? "");
    assert.equal(prepared.product.spec["Horómetro"], isReplacement ? "Horómetro sustituido" : undefined, record.reference ?? "");
    assert.equal(prepared.issues.includes("Atributo no normalizable: Horas de uso"), false, record.reference ?? "");
    assert.deepEqual(resolveAttribute(reconciled, usedHours), { status: "not_observed", value: null }, record.reference ?? "");
    assert.ok(commercial.product.attributes.every((attribute) => !usedHourIds.has(attribute.attributeID)), record.reference ?? "");
    assert.deepEqual(reconcileGamHorometer(reconciled), reconciled, record.reference ?? "");
    assert.equal(JSON.stringify(record), sourceBefore, record.reference ?? "");
  }
});

test("fase 3: horas reales, proveedores ajenos y contradicciones no se modifican", () => {
  const numeric = byReference("6854");
  assert.equal(numeric.horometer, "410 horas");
  assert.equal(reconcileGamHorometer(numeric), numeric);
  assert.equal(prepareSourceProduct(numeric).product.spec["Horómetro"], "410 horas");
  assert.deepEqual(resolveAttribute(numeric, usedHours), { status: "resolved", value: 410 });

  const replacedRecord = byReference("6607");
  const conflicting = { ...replacedRecord, specs: { ...replacedRecord.specs, "Horómetro": "300 horas" } };
  assert.equal(reconcileGamHorometer(conflicting), conflicting);
  assert.equal(prepareSourceProduct(conflicting).product.spec["Horómetro"], "300 horas");

  const ambiguous = { ...numeric, horometer: "Horómetro sustituido 300 horas", specs: { ...numeric.specs, "Horómetro": "Horómetro sustituido 300 horas" } };
  assert.equal(reconcileGamHorometer(ambiguous), ambiguous);
  assert.equal(resolveAttribute(ambiguous, usedHours).status, "invalid");

  const otherProvider = { ...replacedRecord, providerId: "gomariz" };
  assert.equal(reconcileGamHorometer(otherProvider), otherProvider);
});

test("fase 3: preparación mantiene evidencia editorial de sustitución y lectura desconocida", () => {
  const original = byReference("6126");
  const prepared = prepareSourceProduct(original);
  assert.match(prepared.product.description_general ?? "", /horómetro sustituido/iu);
  assert.equal(prepared.product.spec["Horómetro"], "Horómetro sustituido");
  const unknown = byReference("6775");
  assert.equal(prepareSourceProduct(unknown).product.spec["Horómetro"], undefined);
  assert.equal(unknown.specs?.["Horómetro"], "NA V72309090022 horas");
});
