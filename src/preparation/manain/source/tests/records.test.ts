import assert from "node:assert/strict";
import test from "node:test";
import { manainStocklistProductRecord, manainStocklistRecords } from "../records.js";
import { parseManainStocklist } from "../stocklist.js";
import { parseManainHistoricalTechnicalEvidence } from "../../technical/evidence/historical.js";

const product = {
  referencia: "MA4102", familia: "APIL-E APILADOR ELECTRICO", marca: "STILL", modelo: "EXV",
  anio: null, horas: 0, precio_eur: 0, estado: "Usada", observaciones: null,
  foto: "NO", url: "https://manain.com/?sku=MA4102", pagina_pdf: 12
} as const;

const stocklist = parseManainStocklist({
  fuente: {
    archivo: "StocklistNoviembreManain.pdf", sha256: "c7c2f88e284c2efa153c1e8ff51d771d9195e0952a57820c1456974f8f2d2fb2",
    paginas: 42, tipo: "Stocklist Noviembre", proveedor: "Manain", registros_declarados: 2
  },
  productos: [product, { ...product, referencia: "MAN7777", url: "https://manain.com/?sku=MAN7777",
    precio_eur: null, estado: "Nueva", anio: 2026, horas: 120 }]
});

test("Manain: el original documental se adapta al contrato existente sin inventar atributos", () => {
  const [first, second] = manainStocklistRecords(stocklist);
  assert.equal(first?.price, "0 €");
  assert.equal(first?.year, null);
  assert.equal(first?.horometer, "0");
  assert.equal(first?.condition, "Segunda mano");
  assert.equal(first?.categoryName, product.familia);
  assert.equal(first?.image, null);
  assert.equal(first?.shortDescription, null);
  assert.equal(first?.longDescription, null);
  assert.equal(first?.specs, undefined);
  assert.equal(second?.price, null);
  assert.equal(second?.condition, "Nuevo");
  assert.equal(second?.year, "2026");
  assert.equal(second?.horometer, "120");
  assert.deepEqual(manainStocklistProductRecord(product), first);
});


test("Manain: la evidencia histórica no altera el censo, las horas ni los precios documentales", () => {
  const linked = {
    brand: "STILL", model: "EXV", year: "2026",
    sourceUrl: "https://manain.com/producto/venta-manipulacion-apilador-still-exv/",
    technicalSheetUrl: "https://manain.com/ficha-tecnica/venta-manipulacion-apilador-still-exv/",
    scrapedAt: "2026-10-28T10:47:17.791Z", specs: { Motor: "Eléctrico" }
  };
  const historical = parseManainHistoricalTechnicalEvidence({
    version: 1, providerId: "manain", legacyRecordSha256: "a".repeat(64), entries: [
      { ...linked, reference: "MAN7777" }, { ...linked, reference: "MAN8888" }
    ]
  });
  const records = manainStocklistRecords(stocklist, historical);
  assert.equal(records.length, 2);
  assert.equal(records[0]?.reference, "MA4102");
  assert.equal(records[0]?.price, "0 €");
  assert.equal(records[0]?.horometer, "0");
  assert.equal(records[0]?.specs, undefined);
  assert.equal(records[1]?.reference, "MAN7777");
  assert.equal(records[1]?.price, null);
  assert.equal(records[1]?.horometer, "120");
  assert.deepEqual(records[1]?.specs, { Motor: "Eléctrico" });
});
