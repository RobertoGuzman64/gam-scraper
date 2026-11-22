import assert from "node:assert/strict";
import test from "node:test";
import { parseManainStocklist } from "../stocklist.js";

const source = {
  archivo: "StocklistNoviembreManain.pdf",
  sha256: "c7c2f88e284c2efa153c1e8ff51d771d9195e0952a57820c1456974f8f2d2fb2",
  paginas: 42,
  tipo: "Stocklist Noviembre",
  proveedor: "Manain",
  registros_declarados: 1
} as const;

const product = {
  referencia: "MA4075",
  familia: "AD-12 ARTICULADA DIESEL",
  marca: "HAULOTTE",
  modelo: "HA 120 PX",
  anio: 2015,
  horas: 2885,
  precio_eur: 24500,
  estado: "Usada",
  observaciones: null,
  foto: "05/26",
  url: "https://manain.com/?sku=MA4075",
  pagina_pdf: 1
} as const;

const original = { fuente: source, productos: [product] };

test("Manain: conserva literalmente los datos comerciales y su procedencia documental", () => {
  assert.deepEqual(parseManainStocklist(original), original);
  const zero = { ...product, anio: null, horas: 0, precio_eur: 0, foto: "NO", estado: "Nueva" };
  const missing = { ...product, precio_eur: null };
  assert.equal(parseManainStocklist({ fuente: source, productos: [zero] }).productos[0]?.precio_eur, 0);
  assert.equal(parseManainStocklist({ fuente: source, productos: [missing] }).productos[0]?.precio_eur, null);
  assert.equal(parseManainStocklist({ fuente: source, productos: [{ ...product, horas: 65356 }] }).productos[0]?.horas, 65356);
});

test("Manain: recuentos, referencias y páginas deben conciliar con la fuente", () => {
  assert.throws(() => parseManainStocklist({ ...original, productos: [] }), /número de filas/);
  assert.throws(() => parseManainStocklist({ fuente: { ...source, registros_declarados: 2 },
    productos: [product, { ...product, referencia: "ma4075", url: "https://manain.com/?sku=ma4075" }] }),
  /referencia duplicada/);
  assert.throws(() => parseManainStocklist({ ...original, productos: [{ ...product, pagina_pdf: 43 }] }), /fila 1/);
  assert.throws(() => parseManainStocklist({ ...original, productos: [{ ...product, pagina_pdf: 0 }] }), /fila 1/);
});

test("Manain: rechaza modificaciones no contempladas por el contrato y datos comerciales inválidos", () => {
  for (const invalid of [
    { ...product, precio_eur: -1 },
    { ...product, horas: -1 },
    { ...product, anio: 0 },
    { ...product, estado: "Pendiente" },
    { ...product, familia: "" },
    { ...product, columna_nueva: "sin tratamiento" },
    { ...product, referencia: "MAN9999" },
    { ...product, url: "https://otro-proveedor.com/?sku=MA4075" },
    { ...product, url: "https://manain.com/?sku=MA4075&sku=MA4075" }
  ]) {
    assert.throws(() => parseManainStocklist({ ...original, productos: [invalid] }), /fila 1/);
  }
});

test("Manain: no acepta procedencia inventada ni metadatos incompatibles", () => {
  for (const invalid of [
    { ...source, sha256: "no-verificado" },
    { ...source, proveedor: "otro" },
    { ...source, paginas: 0 },
    { ...source, archivo: "otro.json" },
    { ...source, campo_extra: "sin tratamiento" }
  ]) {
    assert.throws(() => parseManainStocklist({ ...original, fuente: invalid }), /procedencia declarada inválida/);
  }
  assert.throws(() => parseManainStocklist({ ...original, otra_fuente: [] }), /estructura o procedencia/);
});
