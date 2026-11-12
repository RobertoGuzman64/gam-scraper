import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { resolveReusableEditorial } from "../../../preparation/shared/editorial/domain/editorial-composition.js";
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

test("diagnóstico: distingue capacidad aplicada y precedencia legítima de un campo vacío", () => {
  const platform = entry(get(gomariz.products, "BT1102"));
  const merca = entry(get(mercaeleva.products, "M749-9513"));
  assert.equal(platform.prepared.status, "ready");
  assert.equal(platform.prepared.product.description, resolveReusableEditorial(platform.source).short);
  assert.notEqual(merca.prepared.product.description, resolveReusableEditorial(merca.source).short);
  const input = [platform, merca];
  const before = JSON.stringify(input);
  const report = analyzeEditorialReuse(input);
  assert.ok(report.totals.aplicada >= 1);
  assert.ok(report.totals.precedencia_de_texto_existente >= 1);
  assert.equal(report.totals.capacidad_disponible_sin_aplicar, 0);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(analyzeEditorialReuse([...input].reverse()), report);
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

test("diagnóstico: distingue origen rechazado y familia no compatible sin atribuir falsos bloqueos", () => {
  const telescope = get(gomariz.products, "BT1102");
  const manipulator = get(gomariz.products, "MT1661");
  const alteredSource = { ...telescope, url: telescope.url.replace("gomarizrent.com", "origen-distinto.com") };
  const altered = without(entry(alteredSource), "description");
  const unsupported = without(entry(manipulator), "description");
  const origin = analyzeEditorialReuse([altered]);
  const family = analyzeEditorialReuse([unsupported]);
  assert.equal(origin.totals.origen_no_validado, 1);
  assert.equal(family.totals.familia_o_evidencia_no_compatible, 1);
  assert.equal(origin.totals.capacidad_disponible_sin_aplicar, 0);
  assert.equal(family.totals.capacidad_disponible_sin_aplicar, 0);
  assert.equal(origin.cases.find((item) => item.field === "description")?.family, null);
});

test("diagnóstico: rechaza identidades repetidas y salidas de otra unidad", () => {
  const first = entry(get(gomariz.products, "BT1102"));
  const other = entry(get(gomariz.products, "BT1139"));
  assert.throws(() => analyzeEditorialReuse([first, first]), /duplicada/u);
  assert.throws(() => analyzeEditorialReuse([{ ...first, prepared: other.prepared }]), /discordante/u);
});
