import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { analyzeTechnicalDensity } from "../../diagnostics/technical-density.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { recoverGamDocumentedElectricMobilityAndTruckAccessSpecs } from "../evidence/providers/gam/verified-models/documented-electric-mobility-and-truck-access-specs.js";
import { recoverMercaelevaDocumentedToyotaForkliftSpecs } from "../evidence/providers/mercaeleva/documented-toyota-forklift-specs.js";

const expected: Readonly<Record<string, Readonly<Record<string, SpecsMap>>>> = {
  gam: {
    "6806": {
      "Potencia de motor publicada para la unidad": "15,6 kW",
      "Velocidad máxima anunciada": "45 km/h",
      "Tipo de motor anunciado": "Eléctrico sin escobillas",
      "Batería anunciada": "Litio extraíble",
      "Sistema de frenos anunciado": "Disco delantero y tambor trasero"
    },
    "6193": {
      "Alcance lateral máximo declarado": "12 m",
      "Rotación de torreta": "±320°",
      "Dimensiones de cesta de fibra": "1400 x 700 x 1100 mm",
      "Rotación hidráulica de cesta": "90° a cada lado",
      "Número de estabilizadores hidráulicos": "4",
      "Toma eléctrica de cesta": "230 V"
    }
  },
  mercaeleva: {
    "M433-5206": {
      "Capacidad nominal según texto comercial": "1.800 kg",
      "Altura de elevación según texto comercial": "4.700 mm",
      "Combustible anunciado": "Diésel"
    }
  }
};
const recover = {
  gam: recoverGamDocumentedElectricMobilityAndTruckAccessSpecs,
  mercaeleva: recoverMercaelevaDocumentedToyotaForkliftSpecs
};
const catalogs = await Promise.all((["gam", "mercaeleva"] as const).map(async (providerId) => ({
  providerId,
  products: (await readCanonicalCatalog(`catalogs/providers/${providerId}/original/scrape-${providerId}-catalog.json`)).products
})));

const getTarget = (providerId: "gam" | "mercaeleva", reference: string): ProductRecord => {
  const source = catalogs.find((catalog) => catalog.providerId === providerId);
  assert.ok(source);
  const record = source.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, `${providerId}:${reference}`);
  return record;
};

test("evidencia técnica de unidades identificadas: acreditar tres unidades y catorce prestaciones nuevas", () => {
  let count = 0;
  let additions = 0;
  const before = [];
  const after = [];
  for (const { providerId, products } of catalogs) {
    for (const record of products) {
      const original = record.specs ?? {};
      const snapshot = JSON.stringify(record);
      const specs = expected[providerId]?.[record.reference ?? ""];
      const actual = recover[providerId](record, original);
      if (!specs) {
        assert.strictEqual(actual, original, `${providerId}:${record.reference}`);
        continue;
      }
      assert.deepEqual(actual, { ...original, ...specs }, `${providerId}:${record.reference}`);
      const prepared = prepareSourceProduct(record);
      assert.equal(prepared.status, "ready", `${providerId}:${record.reference}`);
      for (const [key, value] of Object.entries(specs)) {
        assert.ok(!(key in original), `${providerId}:${record.reference}:${key}`);
        assert.equal(prepared.product.spec[key], value, `${providerId}:${record.reference}:${key}`);
        additions++;
      }
      before.push({ ...prepared.product, spec: Object.fromEntries(Object.entries(prepared.product.spec).filter(([key]) => !(key in specs))) });
      after.push(prepared.product);
      assert.equal(JSON.stringify(record), snapshot);
      count++;
    }
  }
  assert.equal(count, 3);
  assert.equal(additions, 14);
  assert.deepEqual([analyzeTechnicalDensity(before).totals.sparse, analyzeTechnicalDensity(before).totals.medium], [3, 0]);
  assert.deepEqual([analyzeTechnicalDensity(after).totals.sparse, analyzeTechnicalDensity(after).totals.medium], [0, 0]);
});

test("evidencia técnica de unidades identificadas: no propagar a variantes ni sobrescribir especificaciones previas", () => {
  for (const providerId of ["gam", "mercaeleva"] as const) {
    for (const [reference, specs] of Object.entries(expected[providerId] ?? {})) {
      const record = getTarget(providerId, reference);
      const original = record.specs ?? {};
      const first = Object.keys(specs)[0];
      assert.ok(first);
      const variants: readonly ProductRecord[] = [
        { ...record, providerId: providerId === "gam" ? "mercaeleva" : "gam" },
        { ...record, reference: `${reference}-otro` },
        { ...record, categoryKey: "otra-categoria" },
        { ...record, url: `${record.url}?version=otra` },
        { ...record, title: `${record.title} variante` },
        { ...record, brand: "Otra marca" },
        { ...record, model: "Otra variante" },
        { ...record, year: "2099" },
        { ...record, longDescription: `${record.longDescription} variante` },
        { ...record, specs: { ...original, "Otra prestación": "No acreditada" } }
      ];
      for (const [index, variant] of variants.entries()) {
        const input = variant.specs ?? {};
        assert.strictEqual(recover[providerId](variant, input), input, `${reference}:${index}`);
      }
      const occupied = { ...original, [first]: "Dato previamente acreditado" };
      assert.strictEqual(recover[providerId](record, occupied), occupied);
    }
  }
});

test("evidencia técnica de unidades identificadas: los lotes sin desglose y la JLG sin variante acreditada no se modifican", () => {
  for (const reference of ["6971", "6987", "6988", "6989", "6993", "6994", "6995"]) {
    const record = getTarget("gam", reference);
    const input = record.specs ?? {};
    assert.strictEqual(recover.gam(record, input), input, reference);
  }
  const jlg = getTarget("mercaeleva", "M198-7237");
  const specs = jlg.specs ?? {};
  assert.strictEqual(recover.mercaeleva(jlg, specs), specs);
});
