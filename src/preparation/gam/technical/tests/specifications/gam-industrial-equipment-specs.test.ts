import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverGamDocumentedIndustrialEquipmentSpecs } from "../../evidence/verified-models/documented-industrial-equipment-specs.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { analyzeTechnicalDensity } from "../../../../../catalog/diagnostics/technical-density.js";

const originals = (await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json")).products;
const expectedByReference: Readonly<Record<string, SpecsMap>> = {
  "4029": {
    "Anchura del cepillo principal": "810 mm",
    "Anchura del cepillo lateral": "510 mm",
    "Capacidad de la tolva": "150 L",
    "Altura máxima de descarga de la tolva": "1570 mm"
  },
  "3034": {
    "Centro de carga": "600 mm",
    "Elevación de las horquillas": "195 mm",
    "Peso de servicio": "60 kg"
  },
  "171": {
    "Depósito de agua limpia estándar": "190 L",
    "Depósito de recuperación": "225 L",
    "Anchura de la boquilla de aspiración": "1065 mm"
  },
  "4683": {
    "Centro de carga": "500 mm",
    "Distancia entre ejes": "1650 mm",
    "Anchura total del chasis": "1150 mm"
  },
  "4691": {
    "Centro de carga": "500 mm",
    "Distancia entre ejes": "1700 mm",
    "Anchura total del chasis": "1225 mm"
  },
  "6186": {
    "Alcance lateral máximo": "12,70 m",
    "Altura máxima de cesta": "21,60 m",
    "Dimensiones de cesta": "1400 x 700 x 1100 mm"
  },
  "6187": {
    "Alcance lateral máximo": "10,50 m",
    "Altura máxima de cesta": "15,70 m",
    "Dimensiones de cesta": "1400 x 700 x 1100 mm"
  },
  "6191": {
    "Alcance lateral máximo": "10 m",
    "Altura aproximada de cesta": "19 m",
    "Dimensiones de cesta": "1400 x 700 x 1100 mm"
  },
  "6192": {
    "Alcance lateral máximo": "10 m",
    "Altura aproximada de cesta": "21 m",
    "Dimensiones de cesta": "1400 x 700 x 1100 mm"
  },
  "6746": {
    "Centro de carga": "600 mm",
    "Altura máxima de preparación": "4,8 m",
    "Accionamiento de traslación": "Eléctrico"
  },
  "2365": {
    "Capacidad del elevador de paneles": "40 kg",
    "Tamaño máximo del panel": "3,65 x 1,20 m"
  },
  "6805": {
    "Velocidad máxima": "45 km/h",
    "Tensión nominal de batería": "60 V",
    "Tipo de frenos": "Disco delantero y trasero",
    "Dimensiones exteriores": "1890 x 720 x 1110 mm"
  }
};
const references = new Set(Object.keys(expectedByReference));

test("GAM: las prestaciones se limitan a los originales acreditados", () => {
  let improved = 0;
  let additions = 0;
  for (const record of originals) {
    const specs = record.specs ?? {};
    const snapshot = JSON.stringify(record);
    const actual = recoverGamDocumentedIndustrialEquipmentSpecs(record, specs);
    const expected = record.reference ? expectedByReference[record.reference] : undefined;
    if (!expected) {
      assert.equal(actual, specs, record.reference ?? record.url);
      continue;
    }
    assert.deepEqual(actual, { ...specs, ...expected }, record.reference ?? record.url);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", record.reference ?? record.url);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(prepared.product.spec[key], value, `${record.reference}:${key}`);
      assert.ok(!(key in specs), `${record.reference}:${key}`);
    }
    assert.equal(JSON.stringify(record), snapshot);
    improved++;
    additions += Object.keys(expected).length;
  }
  assert.equal(improved, 12);
  assert.equal(additions, 37);
});

test("GAM: las variantes y las sobrescrituras están bloqueadas", () => {
  for (const record of originals) {
    if (!record.reference || !references.has(record.reference)) continue;
    const specs = record.specs ?? {};
    const firstKey = Object.keys(expectedByReference[record.reference] ?? {})[0];
    assert.ok(firstKey, record.reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "mercaeleva" },
      { ...record, categoryKey: "otra-categoria" },
      { ...record, reference: `${record.reference}-otro` },
      { ...record, url: `${record.url}?variante=1` },
      { ...record, title: `${record.title} variante` },
      { ...record, brand: "Otra marca" },
      { ...record, model: "Otra variante" },
      { ...record, year: "2099" },
      { ...record, longDescription: `${record.longDescription} variante` },
      { ...record, specs: { ...specs, "Dato de identidad nuevo": "Cambio" } }
    ];
    for (const [index, variant] of variants.entries()) {
      const incoming = variant.specs ?? {};
      assert.equal(recoverGamDocumentedIndustrialEquipmentSpecs(variant, incoming), incoming, `${record.reference}:${index}`);
    }
    const occupied = { ...specs, [firstKey]: "Dato previo" };
    assert.equal(recoverGamDocumentedIndustrialEquipmentSpecs(record, occupied), occupied);
  }
});

test("GAM: la densidad mejorada mantiene los umbrales existentes", () => {
  const selected = originals.filter((record) => record.reference && references.has(record.reference));
  assert.equal(selected.length, 12);
  const before = selected.map((record) => {
    const prepared = prepareSourceProduct(record).product;
    const additions = expectedByReference[record.reference ?? ""];
    assert.ok(additions);
    return { ...prepared, spec: Object.fromEntries(Object.entries(prepared.spec).filter(([key]) => !(key in additions))) };
  });
  const after = selected.map((record) => prepareSourceProduct(record).product);
  const beforeDensity = analyzeTechnicalDensity(before);
  const afterDensity = analyzeTechnicalDensity(after);
  assert.equal(beforeDensity.totals.sparse + beforeDensity.totals.medium, 12);
  assert.deepEqual([afterDensity.totals.sparse, afterDensity.totals.medium], [0, 0]);
});
