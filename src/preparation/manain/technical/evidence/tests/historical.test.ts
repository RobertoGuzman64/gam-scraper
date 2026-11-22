import assert from "node:assert/strict";
import test from "node:test";
import { matchingManainHistoricalSpecs, parseManainHistoricalTechnicalEvidence } from "../historical.js";
import type { ManainStocklistProduct } from "../../../source/stocklist.js";

const product: ManainStocklistProduct = {
  referencia: "MA4075", familia: "AD-12 ARTICULADA DIESEL", marca: "HAULOTTE", modelo: "HA 120 PX",
  anio: 2015, horas: 2885, precio_eur: 24500, estado: "Usada", observaciones: null,
  foto: "NO", url: "https://manain.com/?sku=MA4075", pagina_pdf: 1
};

const entry = {
  reference: "MA4075", brand: "HAULOTTE", model: "HA 120 PX", year: "2015",
  sourceUrl: "https://manain.com/producto/venta-elevacion-brazo-articulado-haulotte-ha-120-px/",
  technicalSheetUrl: "https://manain.com/ficha-tecnica/venta-elevacion-brazo-articulado-haulotte-ha-120-px/",
  scrapedAt: "2026-10-28T10:47:17.791Z",
  specs: { Motor: "Diésel", "Altura trabajo": "12 m", "Capacidad carga": "230 kg" }
};

const pack = (entries: readonly unknown[]): unknown => ({
  version: 1, providerId: "manain", legacyRecordSha256: "a".repeat(64), entries
});

test("Manain: el enriquecimiento solo recupera specs técnicas con identidad íntegra", () => {
  const parsed = parseManainHistoricalTechnicalEvidence(pack([entry]));
  assert.deepEqual(matchingManainHistoricalSpecs(product, parsed.entries[0]), entry.specs);
  assert.equal(matchingManainHistoricalSpecs({ ...product, referencia: "MA4076" }, parsed.entries[0]), null);
  assert.equal(matchingManainHistoricalSpecs({ ...product, modelo: "OTRO" }, parsed.entries[0]), null);
  assert.equal(matchingManainHistoricalSpecs({ ...product, anio: 2016 }, parsed.entries[0]), null);
  assert.equal(matchingManainHistoricalSpecs(product, { ...entry, specs: { Motor: "Eléctrico" } }), null);
});

test("Manain: la evidencia rechaza inventario histórico, campos de unidad y suplantación", () => {
  assert.throws(() => parseManainHistoricalTechnicalEvidence(pack([entry, entry])), /duplicadas/);
  assert.throws(() => parseManainHistoricalTechnicalEvidence(pack([{ ...entry, specs: { Horas: "2000" } }])), /inválida/);
  assert.throws(() => parseManainHistoricalTechnicalEvidence(pack([{ ...entry, specs: { Precio: "1 €" } }])), /inválida/);
  assert.throws(() => parseManainHistoricalTechnicalEvidence(pack([{ ...entry, technicalSheetUrl: "https://otro.test/ficha-tecnica/falso/" }])), /inválida/);
  assert.throws(() => parseManainHistoricalTechnicalEvidence(pack([{ ...entry, image: "https://otro.test/foto.jpg" }])), /inválida/);
});
