import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { analyzeEditorialReuse } from "../editorial-reuse.js";
import type { GapInput } from "../content-gaps-types.js";

const [gomariz, mercaeleva] = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
]);

const get = (records: readonly ProductRecord[], reference: string): ProductRecord => {
  const record = records.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const entry = (source: ProductRecord): GapInput => ({ source, prepared: prepareSourceProduct(source) });
const without = (input: GapInput, field: "description" | "description_general"): GapInput => ({
  ...input, prepared: { ...input.prepared, product: { ...input.prepared.product, [field]: null } }
});

test("diagnóstico: señala la capacidad disponible bloqueada solo si el campo queda vacío y la ficha está ready", () => {
  const platform = entry(get(gomariz.products, "BT1102"));
  const missing = without(platform, "description");
  const report = analyzeEditorialReuse([missing]);
  assert.equal(report.totals.capacidad_disponible_sin_aplicar, 1);
  assert.deepEqual(report.cases.filter((item) => item.cause === "capacidad_disponible_sin_aplicar")
    .map((item) => [item.reference, item.field, item.family]),
  [["BT1102", "description", "plataforma-telescopica"]]);
  const review = analyzeEditorialReuse([{ ...missing, prepared: { ...missing.prepared,
    status: "review", issues: ["Dato técnico contradictorio"] } }]);
  assert.equal(review.totals.capacidad_disponible_sin_aplicar, 0);
  assert.equal(review.totals.preparacion_en_revision, 1);
});

test("diagnóstico: rechaza identidades repetidas y salidas de otra unidad", () => {
  const first = entry(get(gomariz.products, "BT1102"));
  const other = entry(get(gomariz.products, "BT1139"));
  assert.throws(() => analyzeEditorialReuse([first, first]), /duplicada/u);
  assert.throws(() => analyzeEditorialReuse([{ ...first, prepared: other.prepared }]), /discordante/u);
});
