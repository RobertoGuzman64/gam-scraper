import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverGamDocumentedWarehouseCleaningAndLiftingSpecs } from "../models/documented-warehouse-cleaning-and-lifting-specs.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { analyzeTechnicalDensity } from "../../../../catalog/diagnostics/technical-density.js";

const originals = (await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json")).products;
const expectedByReference: Readonly<Record<string, SpecsMap>> = {
  "1894": { "Control de tracción": "TCS", "Sistema antivuelco": "ACS" },
  "2185": { "Velocidad máxima de desplazamiento": "9,6 km/h", "Dirección": "Eléctrica" },
  "2266": { "Rotación del cabezal trilateral": "180°" },
  "2738": { "Alimentación": "Batería" },
  "4013": { "Depósito de recuperación": "225 l", "Alimentación": "Batería" },
  "4014": { "Depósito de recuperación": "225 l", "Alimentación": "Batería" },
  "4018": { "Depósito de solución": "303 l" },
  "4028": { "Capacidad volumétrica de tolva": "85 l", "Longitud del cepillo principal": "560 mm" },
  "4657": { "Alcance horizontal": "7,5 m", "Rotación de torreta": "330°" },
  "4659": { "Alcance horizontal": "12 m", "Anchura en transporte": "780 mm" },
  "4661": { "Alcance horizontal": "10 m" },
  "4845": { "Alcance horizontal": "12,5 m", "Aislamiento eléctrico del brazo": "Hasta 1000 V" },
  "6189": { "Altura sobre obstáculos": "10,5 m" },
  "6190": { "Altura de plataforma": "25 m" },
  "6423": { "Tecnología de batería": "Iones de litio" },
  "6953": { "Masa máxima autorizada del vehículo": "3500 kg" },
  "6954": { "Masa máxima autorizada del vehículo": "3500 kg", "Material de cesta": "Fibra" },
  "72": { "Configuración de ruedas": "3 ruedas", "Tensión nominal de batería": "48 V" },
  "73": { "Configuración de ruedas": "4 ruedas", "Tensión nominal de batería": "48 V" },
  "214": { "Diámetro admitido de bobina": "120–1270 mm", "Apertura máxima de brazos": "1300 mm", "Superficie de agarre": "Goma" },
  "215": { "Diámetro admitido de bobina": "120–1270 mm", "Apertura máxima de brazos": "1300 mm", "Superficie de agarre": "Goma" },
  "216": { "Diámetro máximo de bobina": "1270 mm", "Anchura máxima de bobina": "520 mm", "Recorrido de elevación": "800 mm" },
  "217": { "Rotación de bidón": "360°", "Diámetro admitido de bidón": "300–600 mm", "Material de bidón admitido": "Acero y plástico" },
};

const references = new Set(Object.keys(expectedByReference));

test("GAM: la evidencia por unidad acredita 23 máquinas distintas y 42 prestaciones sin alterar originales", () => {
  const improved = new Set<string>();
  let added = 0;
  for (const record of originals) {
    const snapshot = JSON.stringify(record);
    const originalSpecs = record.specs ?? {};
    const recovered = recoverGamDocumentedWarehouseCleaningAndLiftingSpecs(record, originalSpecs);
    const expected = record.reference ? expectedByReference[record.reference] : undefined;
    if (!expected) {
      assert.equal(recovered, originalSpecs, record.reference ?? record.url);
      continue;
    }
    assert.deepEqual(recovered, { ...originalSpecs, ...expected }, record.reference ?? record.url);
    assert.deepEqual(Object.keys(recovered).filter((key) => !(key in originalSpecs)).sort(), Object.keys(expected).sort());
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", record.reference ?? record.url);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(prepared.product.spec[key], value, `${record.reference}:${key}`);
    }
    assert.equal(JSON.stringify(record), snapshot);
    if (record.reference) improved.add(record.reference);
    added += Object.keys(expected).length;
  }
  assert.deepEqual(improved, references);
  assert.equal(added, 42);
});

test("GAM: la evidencia no se propaga a variantes, referencias ni originales modificados", () => {
  for (const record of originals) {
    if (!record.reference || !references.has(record.reference)) continue;
    const input = record.specs ?? {};
    const key = Object.keys(expectedByReference[record.reference] ?? {})[0];
    assert.ok(key, record.reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "mercaeleva" },
      { ...record, categoryKey: "otra-categoria" },
      { ...record, reference: `${record.reference}-otra` },
      { ...record, url: `${record.url}?variante=1` },
      { ...record, title: `${record.title} distinta` },
      { ...record, brand: "Otra marca" },
      { ...record, model: "Otro modelo" },
      { ...record, condition: "Segunda mano" },
      { ...record, year: "2000" },
      { ...record, shortDescription: "Otra descripción" },
      { ...record, longDescription: `${record.longDescription} variante` },
      { ...record, specs: { ...input, "Año de fabricación": "2001" } },
      { ...record, specs: { ...input, [key]: "Valor preexistente" } }
    ];
    for (const [index, variant] of variants.entries()) {
      assert.equal(recoverGamDocumentedWarehouseCleaningAndLiftingSpecs(variant, variant.specs ?? {}), variant.specs ?? {}, `${record.reference}:${index}`);
    }
    const preexisting = { ...input, [key]: "Valor acreditado previamente" };
    assert.equal(recoverGamDocumentedWarehouseCleaningAndLiftingSpecs(record, preexisting), preexisting);
  }
});


test("GAM: 19 avisos medios y 4 altos desaparecen sin modificar los umbrales", () => {
  const selected = originals.filter((record) => record.reference && references.has(record.reference));
  assert.equal(selected.length, 23);
  const prepared = selected.map((record) => prepareSourceProduct(record).product);
  const previous = prepared.map((product) => {
    const documented = expectedByReference[product.reference ?? ""];
    assert.ok(documented, product.reference ?? product.sourceUrl);
    const spec = Object.fromEntries(Object.entries(product.spec).filter(([key]) => !(key in documented)));
    return { ...product, spec };
  });
  const before = analyzeTechnicalDensity(previous);
  const after = analyzeTechnicalDensity(prepared);
  assert.deepEqual([before.totals.sparse, before.totals.medium], [4, 19]);
  assert.deepEqual([after.totals.sparse, after.totals.medium], [0, 0]);
});
