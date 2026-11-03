import assert from "node:assert/strict";
import test from "node:test";
import { recommendedTestConcurrency } from "../test-performance.mjs";

test("la concurrencia de tests no supera los procesadores disponibles", () => {
  assert.equal(recommendedTestConcurrency(1), 1);
  assert.equal(recommendedTestConcurrency(4), 4);
  assert.equal(recommendedTestConcurrency(8), 8);
});

test("la concurrencia conserva el límite superior para equipos grandes", () => {
  assert.equal(recommendedTestConcurrency(16), 12);
  assert.equal(recommendedTestConcurrency(32), 12);
});
