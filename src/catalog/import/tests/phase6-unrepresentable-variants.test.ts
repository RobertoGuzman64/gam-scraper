import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const mercaeleva = await readCanonicalCatalog("storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json");
const find = (provider: "gam" | "mercaeleva", reference: string): ProductRecord => {
  const products = provider === "gam" ? gam.products : mercaeleva.products;
  const result = products.find((product) => product.reference === reference);
  assert.ok(result, reference);
  return result;
};
const attribute = (name: string) => {
  const result = catalog.attributes.find((item) => item.name === name);
  assert.ok(result, name);
  return result;
};

test("Fase 6: tres capacidades publicadas por variantes quedan sin escalar, pero conservadas en spec", () => {
  const capacity = attribute("Capacidad de carga");
  for (const reference of ["235", "237", "239"]) {
    const source = find("gam", reference);
    assert.deepEqual(resolveAttribute(source, capacity), { status: "not_observed", value: null });
    const prepared = prepareProduct(source, catalog);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.product.spec, source.specs);
    assert.equal(prepared.product.attributes.some((item) => item.attributeID === capacity.id), false);
  }
});

test("Fase 6: capacidad distinta en texto, modelo ajeno o cantidad escalar no se omiten", () => {
  const capacity = attribute("Capacidad de carga");
  const source = find("gam", "235");
  const variants: ProductRecord[] = [
    { ...source, shortDescription: `${source.shortDescription ?? ""} Capacidad de carga de 500 kg` },
    { ...source, model: "Panther Flex" },
    { ...source, specs: { ...source.specs, "Capacidad de carga": "1600 KG" } },
    { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "1600/1600/3000 KG" } }
  ];
  for (const changed of variants) {
    assert.notEqual(resolveAttribute(changed, capacity).status, "not_observed");
    assert.equal(prepareProduct(changed, catalog).status, "review");
  }
});

test("Fase 6: mástil opcional Mercaeleva no elige Dúplex ni Tríplex", () => {
  const source = find("mercaeleva", "M818-7811");
  const mast = attribute("Tipo de mástil");
  assert.deepEqual(resolveAttribute(source, mast), { status: "not_observed", value: null });
  const prepared = prepareProduct(source, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.product.spec, source.specs);
  assert.equal(prepared.product.attributes.some((item) => item.attributeID === mast.id), false);
  for (const reference of ["M827-8304", "M104-0836"]) {
    assert.equal(resolveAttribute(find("mercaeleva", reference), mast).status, "contradiction");
    assert.equal(prepareProduct(find("mercaeleva", reference), catalog).status, reference === "M827-8304" ? "review" : "ready");
  }
});

test("Fase 6: no ocultar mástiles contradictorios o identidad alterada", () => {
  const source = find("mercaeleva", "M818-7811");
  const mast = attribute("Tipo de mástil");
  for (const changed of [
    { ...source, longDescription: source.longDescription?.replace("DUPLEX TRIPLEX", "MASTIL TRIPLEX") ?? null },
    { ...source, specs: { ...source.specs, "Tipo de mástil": "Simple" } },
    { ...source, model: "E25-01" }
  ]) {
    assert.notEqual(resolveAttribute(changed, mast).status, "not_observed");
  }
});

test("Fase 6: 14 m de altura nominal y 16 m de trabajo son magnitudes compatibles con fuente explícita", () => {
  const source = find("mercaeleva", "M486-0114");
  assert.equal(prepareProduct(source, catalog).status, "ready");
  for (const changed of [
    { ...source, title: source.title?.replace("14 MT", "ALTURA DE TRABAJO 14 MT") ?? null },
    { ...source, specs: { ...source.specs, "Altura de trabajo": "14 m" } },
    { ...source, longDescription: source.longDescription?.replace("16 MT", "18 MT") ?? null }
  ]) {
    assert.equal(prepareProduct(changed, catalog).status, "review");
  }
});

test("Fase 6: preparación por lote conserva las identidades y los choques de serie", () => {
  const prepared = prepareImportBatch(gam.products, catalog);
  assert.deepEqual(prepared.totals, { ready: 1006, review: 2 });
  assert.equal(new Set(prepared.products.map((item) => item.product.reference)).size, 1008);
  for (const reference of ["6682", "6703"]) {
    const original = prepared.products.find((item) => item.product.reference === reference);
    assert.ok(original, reference);
    assert.equal(original.status, "review");
  }
});
