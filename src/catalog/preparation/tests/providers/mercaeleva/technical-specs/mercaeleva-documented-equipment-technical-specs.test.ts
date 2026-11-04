import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { recoverMercaelevaDocumentedEquipmentTechnicalSpecs } from "../../../../evidence/providers/mercaeleva/documented-equipment-technical-specs.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { readMercaelevaSource } from "../../../../../../testing/builders/mercaeleva-source-fixture.js";

const source = await readMercaelevaSource();
const expectedByReference: Readonly<Record<string, SpecsMap>> = {
  "M736-5615": {"Capacidad de carga": "4500 kg", "Capacidad de tolva colmada": "2670 l", "Tracción": "4x4", "Transmisión": "Hidrostática"},
  "M432-1479": {"Profundidad máxima de excavación": "1800 mm", "Anchura mínima del chasis": "750 mm", "Altura máxima de descarga": "2215 mm"},
  "M913-0641": {"Profundidad máxima de excavación": "2820 mm", "Anchura total": "1500 mm", "Fuerza máxima de excavación en cuchara": "21 kN"},
  "M044-4093": {"Altura de plataforma": "13,72 m", "Alcance horizontal": "7,47 m"},
  "M238-0251": {"Alcance horizontal": "7,6 m", "Capacidad máxima de plataforma": "200 kg"},
  "M239-8327": {"Altura de plataforma": "16,5 m", "Capacidad máxima de plataforma": "500 kg"},
  "M315-5925": {"Altura de plataforma": "15,3 m", "Capacidad máxima de plataforma": "500 kg"},
  "M401-4335": {"Alcance horizontal": "6,1 m", "Capacidad máxima de plataforma": "200 kg"},
  "M484-4055": {"Altura de plataforma": "18,8 m", "Capacidad máxima de plataforma": "225 kg"},
  "M569-9029": {"Altura de plataforma": "9,7 m", "Capacidad máxima de plataforma": "454 kg"},
  "M649-6453": {"Altura de plataforma": "15,24 m", "Anchura total": "2,34 m"},
  "M690-5522": {"Alcance horizontal": "6,78 m", "Capacidad máxima de plataforma": "227 kg"},
  "M055-1205": {"Alcance horizontal": "12 m", "Anchura de plataforma": "0,7 m"},
  "M502-4867": {"Alcance horizontal": "9,2 m", "Capacidad máxima de plataforma": "225 kg"},
  "M329-6156": {"Longitud de plataforma": "1,4 m", "Anchura de plataforma": "0,7 m"},
  "M011-3720": {"Propulsión": "Eléctrica", "Altura de elevación": "205 mm", "Altura de plataforma recogida": "150 mm"},
  "M239-6301": {"Propulsión": "Eléctrica", "Altura de elevación": "205 mm", "Altura de plataforma recogida": "150 mm", "Capacidad nominal": "2000 kg"},
  "M005-5167": {"Tracción": "4x4"},
  "M200-9533": {"Alcance horizontal": "9,2 m"},
  "M640-1938": {"Velocidad máxima de desplazamiento": "20 km/h"},
  "M855-6850": {"Velocidad máxima de desplazamiento": "20 km/h"},
};

const selectedReferences = new Set(Object.keys(expectedByReference));

test("Mercaeleva: 21 unidades distintas aportan 45 prestaciones documentadas sin modificar los originales", () => {
  const improved = new Set<string>();
  let added = 0;
  for (const record of source) {
    const originalSnapshot = JSON.stringify(record);
    const originalSpecs = record.specs ?? {};
    const recovered = recoverMercaelevaDocumentedEquipmentTechnicalSpecs(record, originalSpecs);
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
    assert.equal(JSON.stringify(record), originalSnapshot, record.reference ?? record.url);
    if (record.reference) improved.add(record.reference);
    added += Object.keys(expected).length;
  }
  assert.deepEqual(improved, selectedReferences);
  assert.equal(added, 45);
});

test("Mercaeleva: las prestaciones no se propagan a referencias, variantes ni fuentes alteradas", () => {
  for (const record of source) {
    if (!record.reference || !selectedReferences.has(record.reference)) continue;
    const original = record.specs ?? {};
    const expected = expectedByReference[record.reference];
    assert.ok(expected, record.reference);
    const addedKey = Object.keys(expected)[0];
    assert.ok(addedKey, record.reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, categoryKey: "alquiler" },
      { ...record, reference: `${record.reference}-otra` },
      { ...record, url: `${record.url}?otra=1` },
      { ...record, title: `${record.title} variante` },
      { ...record, brand: "Otra marca" },
      { ...record, model: "Otro modelo" },
      { ...record, year: "2001" },
      { ...record, condition: "Nuevo" },
      { ...record, horometer: "987654" },
      { ...record, longDescription: `${record.longDescription} variante distinta` },
      { ...record, specs: { ...original, "Modelo": "Otra variante" } },
      { ...record, specs: { ...original, "Artículo No.": "otro" } },
      { ...record, specs: { ...original, "Año de fabricación": "2000" } },
      { ...record, specs: { ...original, [addedKey]: "otro valor" } }
    ];
    for (const [index, variant] of variants.entries()) {
      const input = variant.specs ?? {};
      assert.equal(recoverMercaelevaDocumentedEquipmentTechnicalSpecs(variant, input), input, `${record.reference}:${index}`);
    }
    const previouslyDefined = { ...original, [addedKey]: "valor anterior" };
    assert.equal(recoverMercaelevaDocumentedEquipmentTechnicalSpecs(record, previouslyDefined), previouslyDefined, record.reference);
  }
});
