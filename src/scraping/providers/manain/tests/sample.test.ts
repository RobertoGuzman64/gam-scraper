import assert from "node:assert/strict";
import test from "node:test";
import { MANAIN_SAMPLE_LIMIT, selectManainDiagnosticSample } from "../sample.js";
import type { ManainListingResult } from "../listing.js";

const urls = Array.from({ length: 12 }, (_, index) =>
  `https://manain.com/producto/venta-elevacion-tijera-modelo-${index + 1}/`
);

test("Manain: la muestra limita el procesamiento sin acreditar cobertura ni publicar resultados", () => {
  const listing: ManainListingResult = { urls, pagesVisited: 2, complete: false, endReason: "page-limit" };
  const selection = selectManainDiagnosticSample(listing);
  assert.equal(selection.urls.length, MANAIN_SAMPLE_LIMIT);
  assert.deepEqual(selection.urls, urls.slice(0, 5));
  assert.equal(selection.discovered, 12);
  assert.equal(selection.endReason, "page-limit");
  assert.equal(selection.complete, false);
  assert.equal(selection.published, false);
  assert.throws(() => selectManainDiagnosticSample({ ...listing, urls: [] }), /no hay fichas/);
});
