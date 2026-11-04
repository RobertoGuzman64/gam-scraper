import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverGamDocumentedDensity178Specs } from "../../../../evidence/providers/gam/verified-models/documented-density-178.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { analyzeTechnicalDensity } from "../../../../../diagnostics/technical-density.js";

const originals = (await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json")).products;
const expectedByReference: Readonly<Record<string, SpecsMap>> = {
  "211": {
    "Anchura de caja admitida": "800–1200 mm",
    "Inclinación de cajas": "Hasta 180°",
    "Velocidad de volteo": "Regulable"
  },
  "212": {
    "Inclinación de cajas": "Hasta 180°",
    "Soportes de caja": "Fijos, sin regulación de anchura",
    "Soportes necesarios para más de 500 kg": "Dos"
  },
  "213": {
    "Grado de inclinación": "Regulable",
    "Velocidad de volteo": "Regulable",
    "Control de aceleración y deceleración": "Progresivo",
    "Parada de inclinación": "Automática en posición neutra"
  },
  "218": {
    "Propulsión": "Manual",
    "Accionamiento de elevación": "Hidráulico manual",
    "Freno de estacionamiento": "Incorporado"
  },
  "219": {
    "Propulsión": "Manual",
    "Accionamiento de elevación": "Hidráulico manual",
    "Patas envolventes": "Para palés cerrados"
  },
  "235": {
    "Propulsión": "Manual",
    "Descenso de carga": "Controlado",
    "Ensayo de durabilidad": "Hasta 46.000 elevaciones"
  },
  "237": {
    "Propulsión": "Manual",
    "Elevación": "Hidráulica manual",
    "Descenso de carga": "Controlado"
  },
  "239": {
    "Longitud de horquillas": "600 mm",
    "Altura mínima de horquillas": "85 mm",
    "Propulsión": "Manual"
  },
  "241": {
    "Chasis": "Resistente a ácidos",
    "Timón y grupo de elevación": "Acero inoxidable",
    "Acabado de bomba": "Cromado"
  },
  "242": {
    "Chasis": "Resistente a ácidos",
    "Timón y componentes de elevación": "Acero inoxidable",
    "Construcción de horquillas": "Cerradas"
  },
  "243": {
    "Accionamiento de elevación": "Manual",
    "Timón y bomba de pistones": "Acero inoxidable",
    "Ruedas de carga": "Tándem"
  },
  "244": {
    "Accionamiento de elevación": "Manual",
    "Timón y bomba de pistones": "Acero inoxidable",
    "Restantes componentes exteriores": "Recubrimiento cromado"
  },
  "297": {
    "Configuración de remolque": "Madre-hija",
    "Número de plataformas de carga": "1",
    "Transporte del carro": "Sin contacto con el suelo"
  },
  "298": {
    "Configuración de remolque": "Madre-hija",
    "Plataformas de elevación": "2, hidráulicas",
    "Transporte de los carros": "Sin contacto con el suelo"
  },
  "299": {
    "Carga y descarga": "Por ambos laterales",
    "Bloqueo del carro": "Integrado",
    "Transporte de plataforma rodante": "Sobre sus propias ruedas"
  },
  "4814": {
    "Tracción": "4×4",
    "Tipo de motor": "Diésel"
  },
  "4817": {
    "Tracción": "4×4",
    "Potencia nominal del motor": "74 kW"
  },
  "4819": {
    "Tracción": "4×4",
    "Capacidad a máxima altura de elevación": "2500 kg"
  },
  "4031": {
    "Capacidad de tolva": "310 l",
    "Longitud del cepillo principal": "910 mm"
  },
  "4040": {
    "Capacidad del depósito": "72 l",
    "Longitud de cable de alimentación": "8,5 m",
    "Motores de aspiración": "3 independientes"
  }
};
const references = new Set(Object.keys(expectedByReference));

test("GAM: 20 fichas de la fase 178 incorporan 57 prestaciones acreditadas sin sobrescrituras", () => {
  const improved = new Set<string>();
  let additions = 0;
  for (const record of originals) {
    const originalSpecs = record.specs ?? {};
    const originalSnapshot = JSON.stringify(record);
    const documented = recoverGamDocumentedDensity178Specs(record, originalSpecs);
    const expected = record.reference ? expectedByReference[record.reference] : undefined;
    if (!expected) {
      assert.equal(documented, originalSpecs, record.reference ?? record.url);
      continue;
    }
    assert.deepEqual(documented, { ...originalSpecs, ...expected }, record.reference ?? record.url);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", record.reference ?? record.url);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(prepared.product.spec[key], value, `${record.reference}:${key}`);
      assert.ok(!(key in originalSpecs), `${record.reference}:${key}`);
    }
    assert.equal(JSON.stringify(record), originalSnapshot);
    if (record.reference) improved.add(record.reference);
    additions += Object.keys(expected).length;
  }
  assert.deepEqual(improved, references);
  assert.equal(additions, 57);
});

test("GAM: las evidencias de 178 se bloquean ante referencias, identidades o specs diferentes", () => {
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
      { ...record, brand: "Marca diferente" },
      { ...record, model: "Modelo distinto" },
      { ...record, condition: "Segunda mano" },
      { ...record, year: "2099" },
      { ...record, longDescription: `${record.longDescription} variante` },
      { ...record, specs: { ...specs, "Año de fabricación": "2000" } },
      { ...record, specs: { ...specs, [firstKey]: "Preexistente" } }
    ];
    for (const [index, variant] of variants.entries()) {
      const input = variant.specs ?? {};
      assert.equal(recoverGamDocumentedDensity178Specs(variant, input), input, `${record.reference}:${index}`);
    }
    const previous = { ...specs, [firstKey]: "Acreditado previamente" };
    assert.equal(recoverGamDocumentedDensity178Specs(record, previous), previous);
  }
});

test("GAM: las 20 fichas de 178 dejan de figurar en densidad alta o media", () => {
  const selected = originals.filter((record) => record.reference && references.has(record.reference));
  assert.equal(selected.length, 20);
  const before = selected.map((record) => {
    const prepared = prepareSourceProduct(record).product;
    const addedKeys = expectedByReference[record.reference ?? ""];
    assert.ok(addedKeys, record.reference ?? record.url);
    return { ...prepared, spec: Object.fromEntries(Object.entries(prepared.spec).filter(([key]) => !(key in addedKeys))) };
  });
  const after = selected.map((record) => prepareSourceProduct(record).product);
  const beforeDensity = analyzeTechnicalDensity(before);
  const afterDensity = analyzeTechnicalDensity(after);
  assert.deepEqual([beforeDensity.totals.sparse, beforeDensity.totals.medium], [20, 0]);
  assert.deepEqual([afterDensity.totals.sparse, afterDensity.totals.medium], [0, 0]);
});
