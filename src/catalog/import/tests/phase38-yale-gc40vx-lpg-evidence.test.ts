import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { isGamVerifiedYaleGc40vxLpg, reconcileGamVerifiedYaleGc40vxLpg } from "../mapping/providers/gam/yale-gc40vx-lpg-evidence.js";
import { newCategorySlug } from "../mapping/providers/gam/categories.js";
import { sourceCategoryQualityIssue } from "../mapping/source-category-quality.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const record = source.products.find((product) => product.reference === "2311");
const nextRecovered = source.products.find((product) => product.reference === "2312");
assert.ok(record);
assert.ok(nextRecovered);

test("Fase 38: GC40VX concuerda con la ficha Yale 4t GLP y conserva las lecturas GAM de origen", () => {
  const original = structuredClone(record);
  const corrected = reconcileGamVerifiedYaleGc40vxLpg(record);
  assert.notStrictEqual(corrected, record);
  assert.equal(isGamVerifiedYaleGc40vxLpg(corrected), true);
  assert.equal(corrected.title, "Carretilla elevadora GLP Yale GC40VX");
  assert.equal(corrected.specs?.["Capacidad de carga (kg)"], "4000 KG");
  assert.equal(corrected.specs?.["Peso"], "5795 KG");
  assert.equal(corrected.specs?.["Radio de giro"], "2298");
  assert.equal(corrected.specs?.["Ancho promedio"], "1170 / 1270");
  assert.equal(corrected.specs?.["Motorización"], "GLP");
  assert.equal(corrected.specs?.["Tipo motor"], "Kubota 3.8L LPG");
  assert.match(corrected.shortDescription ?? "", /4 toneladas/);
  assert.doesNotMatch(corrected.longDescription ?? "", /Hyster|[Dd]i[eé]sel|[Ee]l[eé]ctrica/);
  assert.equal(newCategorySlug(corrected), "carretilla-elevadora-glp");
  assert.equal(sourceCategoryQualityIssue(corrected), null);
  assert.strictEqual(reconcileGamVerifiedYaleGc40vxLpg(corrected), corrected);
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.category, "Carretillas Elevadoras GLP");
  assert.deepEqual(prepared.product.spec, original.specs);
  assert.ok(prepared.product.attributes.some((item) => item.value === 4000));
  assert.deepEqual(record, original);
});

test("Fase 38: el cotejo exacto rechaza alteraciones de identidad, descripciones o ficha técnica", () => {
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "mercaeleva" },
    { ...record, reference: "2312" },
    { ...record, categoryKey: "otros-nuevos" },
    { ...record, condition: "Segunda mano" },
    { ...record, url: `${record.url}?cambio=1` },
    { ...record, externalReference: "GC45VX" },
    { ...record, brand: "HYSTER" },
    { ...record, model: "GC45VX" },
    { ...record, title: "Carretilla elevadora GLP Yale GC40VX" },
    { ...record, shortDescription: `${record.shortDescription} alterado` },
    { ...record, longDescription: `${record.longDescription} alterado` },
    { ...record, shortDescription: null },
    { ...record, longDescription: null },
    { ...record, specs: { ...record.specs, Marca: "HYSTER" } },
    { ...record, specs: { ...record.specs, Modelo: "GC45VX" } },
    { ...record, specs: { ...record.specs, "Tipo motor": "Kubota diésel" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "4000 KG" } },
    { ...record, specs: { ...record.specs, Peso: "6000 KG" } },
    { ...record, specs: { ...record.specs, "Motorización": "GLP" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedYaleGc40vxLpg(variant), variant, String(index));
    assert.equal(prepareProduct(variant, catalog).status, "review", String(index));
  }
  assert.equal(isGamVerifiedYaleGc40vxLpg({ ...reconcileGamVerifiedYaleGc40vxLpg(record), specs: { ...record.specs } }), false);
  for (const item of source.products) {
    if (item.reference !== record.reference) assert.strictEqual(reconcileGamVerifiedYaleGc40vxLpg(item), item, item.reference ?? "");
  }
});

test("Fase 38: conserva el estado de GC40VX y los seis conflictos de serie", () => {
  const prepared = prepareImportBatch(source.products, catalog);
  assert.deepEqual(prepared.totals, { ready: 1006, review: 2 });
  assert.equal(prepared.products.length, 1008);
  assert.equal(new Set(prepared.products.map((item) => item.product.reference)).size, 1008);
  assert.equal(prepared.products.find((item) => item.product.reference === "2311")?.status, "ready");
  for (const reference of ["6682", "6703"]) {
    assert.equal(prepared.products.find((item) => item.product.reference === reference)?.status, "review", reference);
  }
  assert.equal(prepareProduct(nextRecovered, catalog).status, "ready");
});
