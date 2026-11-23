import assert from "node:assert/strict";
import test from "node:test";
import { controlledGomarizForklift } from "../../../preparation/shared/editorial/tests/editorial-contract-records.js";
import { createPreparedSourceFixture } from "../prepared-source-fixture.js";

test("reutiliza la preparación de una fuente inmutable dentro de la misma suite", () => {
  const original = controlledGomarizForklift();
  const prepare = createPreparedSourceFixture();
  const before = structuredClone(original);
  const first = prepare(original);
  assert.strictEqual(prepare(original), first);
  assert.equal(first.product.sourceUrl, original.url);
  assert.deepEqual(original, before);
});

test("las variantes alteradas y las suites independientes mantienen preparaciones distintas", () => {
  const original = controlledGomarizForklift();
  const prepare = createPreparedSourceFixture();
  const originalPrepared = prepare(original);
  const changed = { ...original, title: "Título distinto para comprobar la variación" };
  const changedPrepared = prepare(changed);
  assert.notStrictEqual(changedPrepared, originalPrepared);
  assert.strictEqual(prepare(changed), changedPrepared);
  assert.notStrictEqual(createPreparedSourceFixture()(original), originalPrepared);
  assert.equal(changedPrepared.product.sourceUrl, originalPrepared.product.sourceUrl);
});
