import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { reconcileMercaelevaVerifiedLindeE16pMast } from "../evidence/providers/mercaeleva/linde-e16p-duplex-evidence.js";
import { prepareImportBatch } from "../batch-identity.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json");
const original = source.products.find((product) => product.reference === "M104-0836");
const unresolved = source.products.find((product) => product.reference === "M827-8304");
const mast = catalog.attributes.find((attribute) => attribute.name === "Tipo de mástil" && attribute.type === "SELECT");
assert.ok(original);
assert.ok(unresolved);
assert.ok(mast);

test("MER0624 corrige el encabezado de mástil con concordancia del vendedor en Mascus y Machineryline", () => {
  const sourceSnapshot = structuredClone(original);
  assert.deepEqual(resolveAttribute(original, mast), { status: "contradiction", value: null });
  const reconciled = reconcileMercaelevaVerifiedLindeE16pMast(original);
  assert.notStrictEqual(reconciled, original);
  assert.equal(reconciled.longDescription, original.longDescription?.replace("MASTIL TRIPLEX", "MASTIL DUPLEX"));
  assert.deepEqual(resolveAttribute(reconciled, mast), { status: "resolved", value: "Dúplex" });
  assert.strictEqual(reconcileMercaelevaVerifiedLindeE16pMast(reconciled), reconciled);
  const prepared = prepareProduct(original, catalog);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.reference, "M104-0836");
  assert.equal(prepared.product.description_general, reconciled.longDescription);
  assert.deepEqual(prepared.product.spec, sourceSnapshot.specs);
  assert.ok(prepared.product.attributes.some((item) => item.attributeID === mast.id && item.value === "Dúplex"));
  assert.deepEqual(original, sourceSnapshot);
});

test("alteraciones del anuncio MER0624 no se reconcilian y mantienen el conflicto si persiste", () => {
  const variants: readonly ProductRecord[] = [
    { ...original, providerId: "gam" },
    { ...original, categoryKey: "otros" },
    { ...original, reference: "M104-0837" },
    { ...original, url: `${original.url}?v=2` },
    { ...original, condition: "Nuevo" },
    { ...original, brand: "Otra" },
    { ...original, model: "E18P-01" },
    { ...original, year: "2010" },
    { ...original, horometer: "16 533" },
    { ...original, serialNumber: "IDENTIFICADOR" },
    { ...original, title: "Linde E16P-01 CARRETILLA ELEVADORA ELECTRICA 1800 KG" },
    { ...original, shortDescription: "Máquina distinta" },
    { ...original, longDescription: `${original.longDescription} dato nuevo` },
    { ...original, longDescription: original.longDescription?.replace("TRIPLEX", "DUPLEX") ?? null },
    { ...original, specs: { ...original.specs, "Artículo No.": "MER0777" } },
    { ...original, specs: { ...original.specs, "Tipo de mástil": "Tríplex" } },
    { ...original, specs: { ...original.specs, "Capacidad máxima de elevación": "1800 kg" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileMercaelevaVerifiedLindeE16pMast(variant), variant, String(index));
  }
  for (const [index, variant] of variants.entries()) {
    if (resolveAttribute(variant, mast).status !== "contradiction") continue;
    assert.ok(prepareProduct(variant, catalog).issues.includes("Atributo contradictorio: Tipo de mástil"), String(index));
  }
});

test("una única ficha Mercaeleva recuperada; M827 conserva ambos bloqueos", () => {
  for (const item of source.products) {
    if (item.reference === "M104-0836") continue;
    assert.strictEqual(reconcileMercaelevaVerifiedLindeE16pMast(item), item, item.reference ?? "");
  }
  const batch = prepareImportBatch(source.products, catalog);
  assert.deepEqual(batch.totals, { ready: source.products.length - 1, review: 1 });
  assert.equal(batch.products.length, source.products.length);
  assert.equal(new Set(batch.products.map((item) => item.product.reference)).size, source.products.length);
  assert.equal(batch.products.find((item) => item.product.reference === "M104-0836")?.status, "ready");
  const remaining = batch.products.find((item) => item.product.reference === "M827-8304");
  assert.ok(remaining);
  assert.equal(remaining.status, "review");
  assert.ok(remaining.issues.includes("Atributo contradictorio: Capacidad de carga"));
  assert.ok(remaining.issues.includes("Atributo contradictorio: Tipo de mástil"));
  assert.deepEqual(resolveAttribute(unresolved, mast), { status: "contradiction", value: null });
});
