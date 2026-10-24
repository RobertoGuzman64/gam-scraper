import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const hours = catalog.attributes.find((attribute) => attribute.name === "Horas de uso" && attribute.type === "NUMBER");
assert.ok(hours);
const source = await readCanonicalCatalog(fileURLToPath(new URL("../../../../storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json", import.meta.url)));
const record = source.products.find((product) => product.reference === "M119-9334");
assert.ok(record);

test("Mercaeleva: el horómetro -1 publicado se conserva como origen sin convertirlo en una hora", () => {
  assert.equal(record.specs?.["Horas laborales"], "−1 h");
  assert.equal(record.horometer, "1");
  assert.deepEqual(resolveAttribute(record, hours), { status: "not_observed", value: null });
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.issues.length, 0);
  assert.ok(!prepared.issues.includes("Atributo no normalizable: Horas de uso"));
  assert.equal(prepared.product.spec["Horas laborales"], "−1 h");
  assert.ok(!prepared.product.attributes.some((attribute) => attribute.attributeID === hours.id));
});

test("Mercaeleva: no oculta lecturas explícitas ni conflictos de horómetro", () => {
  const base = { ...record, horometer: null };
  assert.deepEqual(resolveAttribute(base, hours), { status: "not_observed", value: null });
  assert.deepEqual(resolveAttribute({ ...base, specs: { ...base.specs, "Horas laborales": "-1 h" } }, hours),
    { status: "not_observed", value: null });
  assert.equal(resolveAttribute({ ...base, specs: { ...base.specs, "Horas laborales": "1 h" } }, hours).value, 1);
  assert.equal(resolveAttribute({ ...base, horometer: "12" }, hours).status, "invalid");
  assert.equal(resolveAttribute({ ...base, specs: { ...base.specs, "Horas laborales": "−2 h" } }, hours).status, "invalid");
  assert.equal(resolveAttribute({ ...base, specs: { ...base.specs, "Horas laborales": ["−1 h", "12 h"] } }, hours).status, "contradiction");
  assert.equal(resolveAttribute({ ...base, specs: { ...base.specs, "Horas (h)": "12 h" } }, hours).status, "invalid");
  assert.equal(resolveAttribute({ ...base, providerId: "gam" }, hours).status, "invalid");
});
