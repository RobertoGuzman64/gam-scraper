import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildManainCensus, reuseManainCompleteCensus } from "../census.js";
import { findReusableManainCensus } from "../../../../infrastructure/filesystem/manain-census-storage.js";
import type { ManainListingResult } from "../listing.js";

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


test("Manain: reutiliza solo el censo completo reciente con todas las URL visibles idénticas", () => {
  const first = "https://manain.com/producto/venta-prueba-1/";
  const second = "https://manain.com/producto/venta-prueba-2/";
  const time = Date.parse("2026-10-28T11:35:00.000Z");
  const visible: ManainListingResult = { urls: [second, first], pagesVisited: 1,
    complete: false, endReason: "unverified-single-page" };
  const saved = { ...buildManainCensus({ urls: [first, second], pagesVisited: 43,
    complete: true, endReason: "control-exhausted" as const }),
    generatedAt: "2026-10-28T10:26:26.249Z" };
  assert.deepEqual(reuseManainCompleteCensus(visible, saved, time), {
    urls: [first, second], pagesVisited: 43, complete: true, endReason: "control-exhausted"
  });
  assert.equal(reuseManainCompleteCensus(visible, { ...saved, urlCount: 387 }, time), null);
  assert.equal(reuseManainCompleteCensus({ ...visible, urls: [first] }, saved, time), null);
  assert.equal(reuseManainCompleteCensus(visible, { ...saved, complete: false, endReason: "page-limit" }, time), null);
  assert.equal(reuseManainCompleteCensus(visible, { ...saved, generatedAt: "2026-10-27T10:26:26.249Z" }, time), null);
  assert.equal(reuseManainCompleteCensus(visible, { ...saved, providerId: "otro" }, time), null);
});

test("Manain: recupera el censo del directorio diagnóstico sin confiar en ficheros incompletos", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "manain-census-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const url = "https://manain.com/producto/venta-prueba-1/";
  const time = Date.parse("2026-10-28T11:35:00.000Z");
  const visible: ManainListingResult = { urls: [url], pagesVisited: 1,
    complete: false, endReason: "unverified-single-page" };
  const good = { ...buildManainCensus({ urls: [url], pagesVisited: 43,
    complete: true, endReason: "control-exhausted" }), generatedAt: "2026-10-28T10:26:26.249Z" };
  await writeFile(join(directory, "censo-2026-10-28T10-26-26-249Z-3e93ec8c.json"), JSON.stringify(good));
  await writeFile(join(directory, "censo-2026-10-28T11-00-00-000Z-aaaaaaaa.json"), "no-json");
  assert.deepEqual(await findReusableManainCensus(visible, directory, time), {
    urls: [url], pagesVisited: 43, complete: true, endReason: "control-exhausted"
  });
  assert.equal(await findReusableManainCensus({ ...visible, urls: ["https://manain.com/producto/venta-otra/"] }, directory, time), null);
});
