import assert from "node:assert/strict";
import test from "node:test";
import { buildManainCensus } from "../census.js";

test("Manain: el censo parcial mantiene explícita la falta de cobertura y no publica fichas", () => {
  const urls = ["https://manain.com/producto/venta-elevacion-tijera-jlg-es1932-11/"];
  const incomplete = buildManainCensus({ urls, pagesVisited: 2, complete: false, endReason: "page-limit" });
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.published, false);
  assert.equal(incomplete.urlCount, 1);
  assert.deepEqual(incomplete.urls, urls);
  const complete = buildManainCensus({ urls, pagesVisited: 3, complete: true, endReason: "control-exhausted" });
  assert.equal(complete.complete, true);
  assert.equal(complete.published, false);
});
