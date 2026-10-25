import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { reconcileGamVerifiedXcmg0807acwLithium } from "../mapping/providers/gam/xcmg-0807acw-lithium-evidence.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));
const record = source.products.find((product) => product.reference === "4736");
assert.ok(record);

test("Fase 28: reconcilia XG0807ACW-LI y dimensiones verificadas sin alterar origen", () => {
  const reconciled = reconcileGamVerifiedXcmg0807acwLithium(record);
  assert.notStrictEqual(reconciled, record);
  assert.equal(reconciled.model, "XG0807ACW-LI");
  assert.equal(reconciled.specs?.["Modelo"], "XG0807ACW-LI");
  assert.equal(reconciled.specs?.["Anchura"], "810 mm");
  assert.equal(reconciled.specs?.["Longitud"], "1900 mm");
  assert.equal(reconciled.specs?.["Altura"], "2160 mm");
  assert.equal(reconciled.specs?.["Peso"], "1580 KG");
  assert.equal(reconciled.specs?.["Altura de elevación (m)"], "7,8 metros");
  assert.equal(reconciled.specs?.["Dimensiones Cesta"], "1,67X0,74 metros");
  assert.equal(record.specs?.["Modelo"], "XG0807AC-LI");
  assert.equal(record.specs?.["Anchura"], "760 mm");
  assert.equal(record.specs?.["Dimensiones Cesta"], "1,54X0,7 metros");
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.deepEqual(prepared.product.spec, record.specs);
  assert.equal(prepared.product.attributes.some((attribute) => attribute.value === "XG0807ACW-LI"), true);
  assert.equal(prepared.product.attributes.some((attribute) => attribute.value === "1,67 x 0,74 m"), true);
  assert.equal(prepared.product.attributes.some((attribute) => attribute.value === "XG0807AC-LI"), false);
});

test("Fase 28: no interviene si la fuente o la identidad cambian", () => {
  const variants: ProductRecord[] = [
    { ...record, providerId: "mercaeleva" },
    { ...record, reference: "4737" },
    { ...record, condition: "Segunda mano" },
    { ...record, categoryKey: "elevacion" },
    { ...record, brand: "Otro" },
    { ...record, externalReference: "XG0807AC-LI" },
    { ...record, model: "XG0807ACW-LI" },
    { ...record, specs: { ...record.specs, Modelo: "XG0807ACW-LI" } },
    { ...record, specs: { ...record.specs, Anchura: "810 mm" } },
    { ...record, specs: { ...record.specs, "Dimensiones Cesta": "1,67X0,74 metros" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "250 KG" } },
    { ...record, url: `${record.url}?variant=1` },
    { ...record, title: record.title?.replace("XG0807ACW", "XG0807AC") ?? null },
    { ...record, shortDescription: record.shortDescription?.replace("230 kg", "250 kg") ?? null },
    { ...record, longDescription: record.longDescription?.replace("7,8 metros", "8 metros") ?? null },
    { ...record, longDescription: null }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedXcmg0807acwLithium(variant), variant, String(index));
  }
});

test("Fase 28: la corrección de litio no altera otras fichas", () => {
  for (const other of source.products) {
    if (other.reference === "4736") continue;
    assert.strictEqual(reconcileGamVerifiedXcmg0807acwLithium(other), other, other.reference ?? "");
  }

});
