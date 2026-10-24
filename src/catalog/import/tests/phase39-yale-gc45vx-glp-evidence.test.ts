import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { isGamVerifiedYaleGc45vxLpg, reconcileGamVerifiedYaleGc45vxLpg } from "../mapping/providers/gam/yale-gc45vx-lpg-evidence.js";
import { newCategorySlug } from "../mapping/providers/gam/categories.js";
import { sourceCategoryQualityIssue } from "../mapping/source-category-quality.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const record = source.products.find((product) => product.reference === "2312");
assert.ok(record);

test("Fase 39: Yale GC45VX reconcilia motorización, capacidad, peso y medidas acreditadas", () => {
  const original = structuredClone(record);
  const corrected = reconcileGamVerifiedYaleGc45vxLpg(record);
  assert.notStrictEqual(corrected, record);
  assert.equal(isGamVerifiedYaleGc45vxLpg(corrected), true);
  assert.equal(corrected.title, "Carretilla elevadora GLP Yale GC45VX");
  assert.equal(corrected.specs?.["Capacidad de carga (kg)"], "4500 KG");
  assert.equal(corrected.specs?.Peso, "6977 KG");
  assert.equal(corrected.specs?.["Radio de giro"], "2447");
  assert.equal(corrected.specs?.["Ancho promedio"], "1320 / 1420");
  assert.equal(corrected.specs?.Motorización, "GLP");
  assert.equal(corrected.specs?.["Tipo motor"], "Kubota 3.8L LPG");
  assert.match(corrected.shortDescription ?? "", /4\.500 kg/);
  assert.doesNotMatch(`${corrected.title} ${corrected.shortDescription} ${corrected.longDescription}`, /Hyster|di[eé]sel|el[eé]ctrica|\ba pie\b/i);
  assert.equal(newCategorySlug(corrected), "carretilla-elevadora-glp");
  assert.equal(sourceCategoryQualityIssue(corrected), null);
  assert.strictEqual(reconcileGamVerifiedYaleGc45vxLpg(corrected), corrected);
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.category, "Carretillas Elevadoras GLP");
  assert.ok(prepared.product.attributes.some((attribute) => attribute.value === 4500));
  assert.deepEqual(prepared.product.spec, original.specs);
  assert.deepEqual(record, original);
});

test("Fase 39: cotejo de fuente exacta sin extrapolar a identidades o fichas modificadas", () => {
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "mercaeleva" },
    { ...record, reference: "2311" },
    { ...record, categoryKey: "otros-nuevos" },
    { ...record, condition: "Segunda mano" },
    { ...record, url: `${record.url}?actualizado=1` },
    { ...record, externalReference: "GC40VX" },
    { ...record, brand: "HYSTER" },
    { ...record, model: "GC40VX" },
    { ...record, title: "Carretilla elevadora GLP Yale GC45VX" },
    { ...record, shortDescription: `${record.shortDescription} alterado` },
    { ...record, longDescription: `${record.longDescription} alterado` },
    { ...record, shortDescription: null },
    { ...record, longDescription: null },
    { ...record, specs: { ...record.specs, Marca: "HYSTER" } },
    { ...record, specs: { ...record.specs, Modelo: "GC40VX" } },
    { ...record, specs: { ...record.specs, "Tipo motor": "Kubota diésel" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "4500 KG" } },
    { ...record, specs: { ...record.specs, Peso: "6977 KG" } },
    { ...record, specs: { ...record.specs, "Motorización": "GLP" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedYaleGc45vxLpg(variant), variant, String(index));
    assert.equal(prepareProduct(variant, catalog).status, "review", String(index));
  }
  const corrected = reconcileGamVerifiedYaleGc45vxLpg(record);
  assert.equal(isGamVerifiedYaleGc45vxLpg({ ...corrected, specs: { ...record.specs } }), false);
  assert.equal(isGamVerifiedYaleGc45vxLpg({ ...corrected, longDescription: "Descripción distinta" }), false);
  for (const item of source.products) {
    if (item.reference !== record.reference) assert.strictEqual(reconcileGamVerifiedYaleGc45vxLpg(item), item);
  }
});

test("Fase 39: se recupera solo GAM 2312 sin relajar colisiones de número de serie", () => {
  const batch = prepareImportBatch(source.products, catalog);
  assert.deepEqual(batch.totals, { ready: 1006, review: 2 });
  assert.equal(batch.products.length, 1008);
  assert.equal(new Set(batch.products.map((item) => item.product.reference)).size, 1008);
  assert.equal(batch.products.find((item) => item.product.reference === "2312")?.status, "ready");
  for (const reference of ["6682", "6703"]) {
    assert.equal(batch.products.find((item) => item.product.reference === reference)?.status, "review", reference);
  }
});

test("Fase 39: invariantes globales 1369 referencias, 1366 ready y tres reviews", async () => {
  const [gomariz, mercaeleva] = await Promise.all([
    readCanonicalCatalog("storage/scraped/gomariz/scrape-gomariz-catalog.json"),
    readCanonicalCatalog("storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json")
  ]);
  const sources = [source, gomariz, mercaeleva];
  assert.deepEqual(sources.map((item) => prepareImportBatch(item.products, catalog).totals), [
    { ready: 1006, review: 2 },
    { ready: 143, review: 0 },
    { ready: 217, review: 1 }
  ]);
  const identities = sources.flatMap((item) => item.products.map((product) => `${item.providerId}:${product.reference}`));
  assert.equal(identities.length, 1369);
  assert.equal(new Set(identities).size, 1369);
});
