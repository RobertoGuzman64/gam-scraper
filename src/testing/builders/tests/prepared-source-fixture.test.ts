import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { createPreparedSourceFixture } from "../prepared-source-fixture.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const original = catalog.products[0];
assert.ok(original);

test("reutiliza la preparación de una fuente original inmutable dentro de la misma suite", () => {
  const prepare = createPreparedSourceFixture();
  const before = structuredClone(original);
  const first = prepare(original);
  assert.strictEqual(prepare(original), first);
  assert.equal(first.product.sourceUrl, original.url);
  assert.deepEqual(original, before);
});

test("las variantes alteradas y las suites independientes mantienen preparaciones distintas", () => {
  const prepare = createPreparedSourceFixture();
  const originalPrepared = prepare(original);
  const changed = { ...original, title: "Título distinto para comprobar la variación" };
  const changedPrepared = prepare(changed);
  assert.notStrictEqual(changedPrepared, originalPrepared);
  assert.strictEqual(prepare(changed), changedPrepared);
  assert.notStrictEqual(createPreparedSourceFixture()(original), originalPrepared);
  assert.equal(changedPrepared.product.sourceUrl, originalPrepared.product.sourceUrl);
});
