import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../../../../shared/classification/mapping/attribute-mapping.js";
import { prepareProduct } from "../../../../../commercial/legacy-export/prepare-product.js";
import { reconcileMercaelevaNonUsableSentinels } from "../../reconciliation/mercaeleva.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = await loadImportCatalog();
const hours = catalog.attributes.find((attribute) => attribute.name === "Horas de uso" && attribute.type === "NUMBER");
assert.ok(hours);
const source = await readCanonicalCatalog(fileURLToPath(new URL("../../../../../../src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json", import.meta.url)));
const record = source.products.find((product) => product.reference === "M119-9334");
assert.ok(record);

test("Mercaeleva: descarta el centinela técnico y conserva intacto el original sin inventar horas", () => {
  assert.equal(record.specs?.["Horas laborales"], "−1 h");
  assert.equal(record.horometer, "1");
  assert.deepEqual(resolveAttribute(record, hours), { status: "not_observed", value: null });
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.issues.length, 0);
  assert.ok(!prepared.issues.includes("Atributo no normalizable: Horas de uso"));
  assert.equal(prepared.product.spec["Horas laborales"], undefined);
  assert.equal(prepareSourceProduct(record).product.spec["Horas laborales"], undefined);
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


test("Mercaeleva: descarta únicamente centinelas identificados, sin eliminar lecturas válidas", () => {
  const original = structuredClone(record);
  const cases = [
    ["−1 h", false], ["-1 h", false], ["–1 h", false], ["-1.0 h", false],
    ["1 h", true], ["−2 h", true], ["12 h", true], ["-1 horas", true]
  ] as const;
  for (const [value, retained] of cases) {
    const item: typeof record = { ...record, specs: { ...record.specs, "Horas laborales": value } };
    const result = reconcileMercaelevaNonUsableSentinels(item);
    assert.equal(result.specs?.["Horas laborales"], retained ? value : undefined, value);
    assert.equal(item.specs?.["Horas laborales"], value);
    assert.deepEqual(reconcileMercaelevaNonUsableSentinels(result), result);
  }
  const mixed = { ...record, specs: { ...record.specs, "Horas laborales": ["−1 h", "12 h"] } };
  assert.deepEqual(reconcileMercaelevaNonUsableSentinels(mixed), mixed);
  const differentProvider = { ...record, providerId: "gam" };
  assert.deepEqual(reconcileMercaelevaNonUsableSentinels(differentProvider), differentProvider);
  assert.deepEqual(record, original);
});

test("Mercaeleva: el centro de gravedad centinela no se convierte en centro de carga", () => {
  const item = source.products.find((product) => product.reference === "M062-8951");
  assert.ok(item);
  assert.equal(item.specs?.["Distancia del centro de gravedad"], "−1 mm");
  const snapshot = structuredClone(item);
  const prepared = prepareProduct(item, catalog);
  assert.equal(prepared.product.spec["Distancia del centro de gravedad"], undefined);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(item, snapshot);
  const valid = { ...item, specs: { ...item.specs, "Distancia del centro de gravedad": "540 mm" } };
  assert.equal(prepareSourceProduct(valid).product.spec["Distancia del centro de gravedad"], "540 mm");
});
