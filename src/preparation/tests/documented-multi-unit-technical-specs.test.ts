import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { analyzeTechnicalDensity } from "../../catalog/diagnostics/technical-density.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { recoverGamDocumentedMultiUnitLotSpecs } from "../gam/technical/evidence/verified-models/documented-multi-unit-lot-specs.js";
import { recoverMercaelevaDocumentedJlgSl203204Specs } from "../mercaeleva/technical/evidence/documented-jlg-sl203-204-specs.js";

const expected: Readonly<Record<string, Readonly<Record<string, SpecsMap>>>> = {
  "gam": {
    "6971": {
      "UniCarriers 1Q2L25Q · Capacidad de carga": "2.500 kg",
      "UniCarriers 1Q2L25Q · Altura de elevación": "4.750 mm",
      "UniCarriers A1N1L18Q · Capacidad de carga": "1.800 kg",
      "UniCarriers A1N1L18Q · Altura de elevación": "4.750 mm"
    },
    "6987": {
      "Yale MP20 · Capacidad de carga": "2.000 kg",
      "Yale MP20 · Longitud de horquillas": "1.156 mm",
      "Hyster P2.0SD · Capacidad de carga": "2.000 kg",
      "Hyster P2.0SD · Altura de elevación": "1.600 mm"
    },
    "6988": {
      "Hyster P2.0 · Capacidad de carga": "2.000 kg",
      "Hyster P2.0 · Altura de elevación": "220 mm",
      "Still RX 60-35 · Capacidad de carga": "3.500 kg",
      "Still RX 60-35 · Altura de elevación": "4.500 mm"
    },
    "6989": {
      "Toyota LPE200 · Capacidad de carga": "2.000 kg",
      "Toyota LPE200 · Longitud de horquillas": "1.150 mm",
      "Yale ERP35VL · Capacidad de carga": "3.500 kg",
      "Yale ERP35VL · Altura de elevación": "4.100 mm"
    },
    "6993": {
      "JLG E300AJP · Altura de elevación anunciada": "11 m",
      "JLG E300AJP · Capacidad de cesta": "230 kg",
      "Haulotte Optimum 8 · Altura de elevación anunciada": "8 m",
      "Haulotte Optimum 8 · Capacidad de plataforma": "230 kg"
    },
    "6994": {
      "Yale ERP16VT MWB · Capacidad de carga": "1.600 kg",
      "Yale ERP16VT MWB · Altura de elevación anunciada": "5.500 mm",
      "Yale MP16 · Ancho exterior de horquillas": "680 mm",
      "Yale MP16 · Accionamiento": "Eléctrico"
    },
    "6995": {
      "Hyster S1.2 · Capacidad de carga": "1.200 kg",
      "Hyster S1.2 · Altura de elevación anunciada": "3.500 mm",
      "Yale ERP18VT MWB · Capacidad de carga": "1.800 kg",
      "Yale ERP18VT MWB · Tipo de carretilla": "Eléctrica triciclo"
    }
  },
  "mercaeleva": {
    "M198-7237": {
      "Altura de plataforma según catálogo técnico": "20,30 m",
      "Capacidad de carga de plataforma según catálogo técnico": "750 kg",
      "Longitud según catálogo técnico": "4,80 m",
      "Anchura según catálogo técnico": "2,40 m",
      "Dimensiones de plataforma según catálogo técnico": "4,35 x 2,30 m"
    }
  }
};
const recover = {
  gam: recoverGamDocumentedMultiUnitLotSpecs,
  mercaeleva: recoverMercaelevaDocumentedJlgSl203204Specs
};
const catalogs = await Promise.all((["gam", "mercaeleva"] as const).map(async (providerId) => ({
  providerId,
  products: (await readCanonicalCatalog(`catalogs/providers/${providerId}/original/scrape-${providerId}-catalog.json`)).products
})));

const getTarget = (providerId: "gam" | "mercaeleva", reference: string): ProductRecord => {
  const catalog = catalogs.find((candidate) => candidate.providerId === providerId);
  assert.ok(catalog);
  const record = catalog.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, `${providerId}:${reference}`);
  return record;
};

test("fichas multiunidad: ocho fichas documentadas y 33 prestaciones sin modificar originales", () => {
  let improved = 0;
  let added = 0;
  const before = [];
  const after = [];
  for (const { providerId, products } of catalogs) {
    for (const record of products) {
      const original = record.specs ?? {};
      const specs = expected[providerId]?.[record.reference ?? ""];
      const previous = JSON.stringify(record);
      const preparedSpecs = recover[providerId](record, original);
      if (!specs) {
        assert.strictEqual(preparedSpecs, original, `${providerId}:${record.reference}`);
        continue;
      }
      assert.deepEqual(preparedSpecs, { ...original, ...specs }, `${providerId}:${record.reference}`);
      const prepared = prepareSourceProduct(record);
      assert.equal(prepared.status, "ready", `${providerId}:${record.reference}`);
      for (const [key, value] of Object.entries(specs)) {
        assert.ok(!(key in original), `${providerId}:${record.reference}:${key}`);
        assert.equal(prepared.product.spec[key], value, `${providerId}:${record.reference}:${key}`);
        added++;
      }
      const priorSpecs = Object.fromEntries(Object.entries(prepared.product.spec).filter(([key]) => !(key in specs)));
      before.push({ ...prepared.product, spec: priorSpecs });
      after.push(prepared.product);
      assert.equal(JSON.stringify(record), previous);
      improved++;
    }
  }
  assert.equal(improved, 8);
  assert.equal(added, 33);
  assert.deepEqual(analyzeTechnicalDensity(before).totals, { products: 8, sparse: 8, medium: 0 });
  assert.deepEqual(analyzeTechnicalDensity(after).totals, { products: 8, sparse: 0, medium: 0 });
});

test("fichas multiunidad: sin aplicar prestaciones a otras variantes, fuentes o fichas cambiadas", () => {
  for (const providerId of ["gam", "mercaeleva"] as const) {
    for (const [reference, specs] of Object.entries(expected[providerId] ?? {})) {
      const record = getTarget(providerId, reference);
      const original = record.specs ?? {};
      const first = Object.keys(specs)[0];
      assert.ok(first);
      const variants: readonly ProductRecord[] = [
        { ...record, providerId: providerId === "gam" ? "mercaeleva" : "gam" },
        { ...record, reference: `${reference}-otra` },
        { ...record, categoryKey: "otra-categoria" },
        { ...record, url: `${record.url}?version=otra` },
        { ...record, title: `${record.title} variante` },
        { ...record, brand: "Otra marca" },
        { ...record, model: "Otra variante" },
        { ...record, year: "2099" },
        { ...record, longDescription: `${record.longDescription} variante` },
        { ...record, specs: { ...original, "Dato adicional": "No acreditado" } }
      ];
      for (const [index, variant] of variants.entries()) {
        const input = variant.specs ?? {};
        assert.strictEqual(recover[providerId](variant, input), input, `${reference}:${index}`);
      }
      const occupied = { ...original, [first]: "Prestación existente" };
      assert.strictEqual(recover[providerId](record, occupied), occupied);
    }
  }
});
