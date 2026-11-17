import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { accreditedSourceSamples } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { analyzeTechnicalDensity } from "../../../../catalog/diagnostics/technical-density.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { recoverGamDocumentedSourcePerformanceSpecs } from "./documented-source-performance-specs.js";

const originals = accreditedSourceSamples("gam-original");
const expectedByReference: Readonly<Record<string, { readonly specification: Readonly<SpecsMap>; readonly sourceFragment: string }>> = {
  "3993": {"specification": {"Autonomía anunciada por carga": "45 min"}, "sourceFragment": "autonomía de 45 minutos"},
  "3994": {"specification": {"Autonomía máxima anunciada por carga": "70 min"}, "sourceFragment": "hasta 70 minutos de autonomía"},
  "4013": {"specification": {"Anchura máxima de fregado con cepillo lateral": "1145 mm"}, "sourceFragment": "ancho de restregado de la T16 D, que puede alcanzar los 1145 mm"},
  "4014": {"specification": {"Anchura máxima de fregado con cepillo lateral": "1145 mm"}, "sourceFragment": "ancho de restregado de la T16 C, que puede alcanzar los 1145 mm"},
  "4023": {"specification": {"Capacidad del depósito de residuos": "45 l"}, "sourceFragment": "depósito de 45 litros"},
  "4028": {"specification": {"Tensión de alimentación de batería": "36 V"}, "sourceFragment": "baterías de 36 voltios"},
  "4036": {"specification": {"Longitud de cable de alimentación": "12 m"}, "sourceFragment": "cable de alimentación de 12 metros"},
  "4039": {"specification": {"Longitud de cable de alimentación": "8,5 m"}, "sourceFragment": "cable de alimentación de 8,5 metros"},
  "4650": {"specification": {"Masa mínima autorizada del camión soporte": "3500 kg"}, "sourceFragment": "PTT mínimo de 3.500 kg"},
  "4659": {"specification": {"Longitud de plumín": "2,1 m"}, "sourceFragment": "jib de 2,1 metros"},
  "4844": {"specification": {"Masa mínima autorizada del camión soporte": "3500 kg"}, "sourceFragment": "PTT mínimo de 3.500 kg"},
  "4845": {"specification": {"Masa mínima autorizada del camión soporte": "3500 kg"}, "sourceFragment": "PTT mínimo de 3.500 kg"},
  "4847": {"specification": {"Masa del camión soporte anunciada": "3500 kg"}, "sourceFragment": "camión Iveco de 3.500 kg"},
  "5918": {"specification": {"Autonomía máxima anunciada": "150 km"}, "sourceFragment": "hasta 150 km de autonomía"},
  "6148": {"specification": {"Capacidad del depósito de solución": "40 l"}, "sourceFragment": "depósito de solución es de 40 l"},
  "6186": {"specification": {"Rotación de torre": "700°"}, "sourceFragment": "rotación de torre de 700°"},
  "6187": {"specification": {"Rotación de torre": "700°"}, "sourceFragment": "rotación de torre de 700°"},
  "6805": {"specification": {"Autonomía máxima anunciada": "100 km"}, "sourceFragment": "autonomía de hasta 100 km"},
  "6807": {"specification": {"Autonomía máxima anunciada en ciudad": "262 km"}, "sourceFragment": "hasta 262 km en ciudad"},
  "6834": {"specification": {"Potencia aparente nominal anunciada": "37,5 kVA"}, "sourceFragment": "37,5 kvas/30 kW"},
};
const references = Object.keys(expectedByReference);

test("GAM: veinte fichas acreditadas incorporan prestaciones declaradas en su fuente", () => {
  let improved = 0;
  let additions = 0;
  for (const record of originals) {
    const specs = record.specs ?? {};
    const expected = record.reference ? expectedByReference[record.reference] : undefined;
    const recovered = recoverGamDocumentedSourcePerformanceSpecs(record, specs);
    if (!expected) {
      assert.strictEqual(recovered, specs, record.reference ?? record.url);
      continue;
    }
    assert.ok((record.longDescription ?? "").toLowerCase().includes(expected.sourceFragment.toLowerCase()), record.reference);
    assert.deepEqual(recovered, { ...specs, ...expected.specification }, record.reference);
    const originalSnapshot = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", record.reference);
    for (const [key, value] of Object.entries(expected.specification)) {
      assert.ok(!(key in specs), `${record.reference}:${key}`);
      assert.equal(prepared.product.spec[key], value, `${record.reference}:${key}`);
      additions++;
    }
    assert.equal(JSON.stringify(record), originalSnapshot, record.reference);
    improved++;
  }
  assert.equal(improved, 20);
  assert.equal(additions, 20);
});

test("GAM: variantes y campos ocupados impiden reutilizar la evidencia", () => {
  for (const record of originals) {
    if (!record.reference || !references.includes(record.reference)) continue;
    const original = record.specs ?? {};
    const expected = expectedByReference[record.reference];
    if (!expected) throw new Error(record.reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "mercaeleva" },
      { ...record, reference: `${record.reference}-otra` },
      { ...record, categoryKey: "categoria-distinta" },
      { ...record, title: `${record.title} variante` },
      { ...record, url: `${record.url}?configuracion=distinta` },
      { ...record, year: "2099" },
      { ...record, model: "Modelo diferente" },
      { ...record, brand: "Marca diferente" },
      { ...record, longDescription: `${record.longDescription} configuración distinta` },
      { ...record, specs: { ...original, "Dato nuevo de origen": "alterado" } }
    ];
    for (const [index, variant] of variants.entries()) {
      const incoming = variant.specs ?? {};
      assert.strictEqual(recoverGamDocumentedSourcePerformanceSpecs(variant, incoming), incoming,
        `${record.reference}:${index}`);
    }
    const firstKey = Object.keys(expected.specification)[0];
    if (firstKey === undefined) throw new Error(record.reference);
    const occupied = { ...original, [firstKey]: "Valor existente" };
    assert.strictEqual(recoverGamDocumentedSourcePerformanceSpecs(record, occupied), occupied, record.reference);
  }
});

test("GAM: veinte salidas completas del umbral técnico sin rebajar los controles", () => {
  let belowBefore = 0;
  let belowAfter = 0;
  for (const record of originals) {
    if (!record.reference || !references.includes(record.reference)) continue;
    const prepared = prepareSourceProduct(record);
    const previous: typeof prepared.product = {
      ...prepared.product,
      spec: Object.fromEntries(Object.entries(prepared.product.spec).filter(([key]) =>
        !(key in (expectedByReference[record.reference ?? ""]?.specification ?? {}))))
    };
    assert.equal(analyzeTechnicalDensity([previous]).target.below, 1, record.reference);
    assert.equal(analyzeTechnicalDensity([prepared.product]).target.below, 0, record.reference);
    belowBefore++;
    belowAfter += analyzeTechnicalDensity([prepared.product]).target.below;
  }
  assert.equal(belowBefore, 20);
  assert.equal(belowAfter, 0);
});
