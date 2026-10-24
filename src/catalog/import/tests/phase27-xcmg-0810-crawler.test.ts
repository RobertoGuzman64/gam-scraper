import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { reconcileGamVerifiedXcmg0810Crawler } from "../mapping/providers/gam/xcmg-0810-crawler-evidence.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));
const record = source.products.find((product) => product.reference === "4737");
assert.ok(record);

test("Fase 27: reconcilia solo la XCMG de orugas con identidad y evidencia completas", () => {
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.reference, "4737");
  assert.deepEqual(prepared.product.spec, record.specs);
  assert.equal(prepared.product.attributes.some((attribute) => attribute.value === "XG0810C"), true);
  assert.equal(prepared.product.description_general?.includes("orugas de goma"), true);
  assert.equal(prepared.product.description_general?.includes("hasta un 30%"), true);
  assert.equal(prepared.product.description_general?.includes("hasta un 25%"), false);
  assert.equal(record.specs?.["Modelo"], "XG0807ACW-LI");
  assert.equal(record.longDescription?.includes("hasta un 25%"), true);
});

test("Fase 27: bloquea variaciones de identidad y técnica sin intervención editorial", () => {
  const variants: ProductRecord[] = [
    { ...record, providerId: "mercaeleva" },
    { ...record, reference: "4736" },
    { ...record, condition: "Segunda mano" },
    { ...record, externalReference: "XG0807ACW-LI" },
    { ...record, model: "XG0810C" },
    { ...record, specs: { ...record.specs, Modelo: "XG0810C" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "230 KG" } },
    { ...record, specs: { ...record.specs, "Pendiente superable": "25%" } },
    { ...record, url: `${record.url}?variant=1` },
    { ...record, title: record.title?.replace("orugas", "ruedas") ?? null },
    { ...record, shortDescription: record.shortDescription?.replace("250 kg", "230 kg") ?? null },
    { ...record, longDescription: record.longDescription?.replace("250 kg", "230 kg") ?? null },
    { ...record, longDescription: null }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedXcmg0810Crawler(variant), variant, String(index));
  }
});

test("Fase 27: conserva la cohorte completa y no altera otras referencias", () => {
  const prepared = prepareImportBatch(source.products, catalog);
  assert.deepEqual(prepared.totals, { ready: 1006, review: 2 });
  assert.equal(new Set(prepared.products.map((product) => product.product.reference)).size, 1008);
  for (const other of source.products) {
    if (other.reference === "4737") continue;
    assert.strictEqual(reconcileGamVerifiedXcmg0810Crawler(other), other, other.reference ?? "");
  }
  for (const reference of ["6682", "6703"]) {
    assert.equal(prepared.products.find((product) => product.product.reference === reference)?.status, "review", reference);
  }
});
