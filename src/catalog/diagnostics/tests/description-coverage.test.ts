import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDescriptionCoverage } from "../description-coverage.js";
import type { DescriptionCoverageInput } from "../description-coverage.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../legacy-export/contracts.js";

const source = (reference: string): ProductRecord => ({
  providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria de ocasión",
  url: `https://www.gomarizrent.com/venta/maquinas/${reference}`, title: "Máquina de prueba",
  shortDescription: null, longDescription: null, price: null,
  reference, brand: null, model: null, year: null, location: null, country: null, horometer: null,
  serialNumber: null, image: null, specs: {}
});
const published = (record: ProductRecord, description: string | null, general: string | null): ImportCandidate => ({
  providerId: record.providerId, sourceUrl: record.url, reference: record.reference,
  title: record.title, categorySellID: null, category: record.categoryName,
  condition: null, price: null, description_title: record.title,
  description, description_general: general, image: null, images: [], spec: {}, attributes: []
});
const pair = (reference: string, initial: [string | null, string | null], current: [string | null, string | null]): DescriptionCoverageInput => {
  const record = source(reference);
  const original = published(record, ...initial);
  return { source: record, published: original, origin: "original_canonico", prepared: {
    product: published(record, ...current), status: "ready", issues: []
  } };
};

test("comparación distingue recuperados, dos vacíos pendientes y pérdida de texto", () => {
  const result = analyzeDescriptionCoverage([
    pair("1", [null, null], [null, null]),
    pair("2", [null, null], ["Corta recuperada", "General recuperada"]),
    pair("3", ["Corta publicada", "General publicada"], [null, "General publicada"])
  ]);
  assert.equal(result.totals.products, 3);
  assert.deepEqual(result.totals.publishedMissing, { description: 2, description_general: 2 });
  assert.deepEqual(result.totals.recovered, { description: 1, description_general: 1 });
  assert.deepEqual(result.totals.pending, { description: 1, description_general: 1 });
  assert.deepEqual(result.totals.lost, { description: 1, description_general: 0 });
  assert.equal(result.totals.bothPending, 1);
  assert.equal(result.pendingCases[0]?.reference, "1");
  assert.equal(result.lostCases[0]?.reference, "3");
  assert.deepEqual(result, analyzeDescriptionCoverage([
    pair("3", ["Corta publicada", "General publicada"], [null, "General publicada"]),
    pair("2", [null, null], ["Corta recuperada", "General recuperada"]),
    pair("1", [null, null], [null, null])
  ]));
});

test("comparación impide mezclar proveedores e identidades duplicadas", () => {
  const record = pair("1", [null, null], [null, null]);
  assert.throws(() => analyzeDescriptionCoverage([record, record]), /duplicada/);
  const other = { ...record, prepared: { ...record.prepared, product: { ...record.prepared.product, providerId: "gam" } } };
  assert.throws(() => analyzeDescriptionCoverage([other]), /Identidad o URL discordante/);
});
