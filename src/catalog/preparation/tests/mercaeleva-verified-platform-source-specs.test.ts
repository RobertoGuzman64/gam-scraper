import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { reconcileMercaelevaVerifiedPlatformSourceSpecs } from "../evidence/providers/mercaeleva/verified-platform-source-specs.js";
import { prepareSourceProduct } from "../prepare-product.js";

const source = await readCanonicalCatalog("catalogs/providers/mercaeleva/original/mercaeleva-completa-20261029-234332-catalog.json");
const sourceRecord = (reference: string): ProductRecord => {
  const record = source.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const corrections: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "M547-1056": { "Año de fabricación": "2008", "Altura de trabajo": "28 m" },
  "M777-6495": { "Altura de trabajo": "22 m" },
  "M028-8481": { "Altura de trabajo": "6 m" },
  "M958-0132": { "Año de fabricación": "2004" }
};

test("Mercaeleva: recupera especificaciones confirmadas por la fuente individual sin modificar los originales", () => {
  for (const [reference, expected] of Object.entries(corrections)) {
    const original = sourceRecord(reference);
    const originalSnapshot = JSON.stringify(original);
    const recovered = reconcileMercaelevaVerifiedPlatformSourceSpecs(original);
    const prepared = prepareSourceProduct(original).product;
    assert.notEqual(recovered, original, reference);
    for (const [name, value] of Object.entries(expected)) {
      assert.notEqual(original.specs?.[name], value, `${reference}: ${name}`);
      assert.equal(recovered.specs?.[name], value, `${reference}: ${name}`);
      assert.equal(prepared.spec?.[name], value, `${reference}: ${name}`);
    }
    assert.equal(recovered.year, expected["Año de fabricación"] ?? original.year, reference);
    assert.equal(JSON.stringify(original), originalSnapshot, reference);
  }
});

test("Mercaeleva: bloquea la acreditación cuando cambia la identidad o la evidencia original", () => {
  for (const reference of Object.keys(corrections)) {
    const original = sourceRecord(reference);
    const variations: readonly ProductRecord[] = [
      { ...original, reference: "M000-0000" },
      { ...original, url: `${original.url}?variant=1` },
      { ...original, title: `${original.title} VARIANTE` },
      { ...original, model: `${original.model} VARIANTE` },
      { ...original, longDescription: `${original.longDescription} DATO DISTINTO` },
      { ...original, specs: { ...original.specs, "Altura de trabajo": "33 m" } }
    ];
    for (const changed of variations) {
      assert.equal(reconcileMercaelevaVerifiedPlatformSourceSpecs(changed), changed, reference);
    }
  }
});

const mileageCorrections = {
  "M329-6156": { raw: "73 883 h", mileage: "73 883 km", normalized: 73883 },
  "M502-4867": { raw: "42 922 h", mileage: "42 922 km", normalized: 42922 }
} as const;

test("Mercaeleva: reclasifica kilometrajes acreditados sin conservar falsas horas laborales", () => {
  for (const [reference, expected] of Object.entries(mileageCorrections)) {
    const original = sourceRecord(reference);
    const snapshot = JSON.stringify(original);
    assert.equal(original.specs?.["Horas laborales"], expected.raw, reference);
    assert.match(original.longDescription ?? "", /\bKM\s+\d{5}\b/u);
    const recovered = reconcileMercaelevaVerifiedPlatformSourceSpecs(original);
    const prepared = prepareSourceProduct(original).product;
    for (const specs of [recovered.specs, prepared.spec]) {
      assert.equal(specs?.["Horas laborales"], undefined, reference);
      assert.equal(specs?.["Kilometraje"], expected.mileage, reference);
      for (const [key, value] of Object.entries(original.specs ?? {})) {
        if (key !== "Horas laborales") assert.equal(specs?.[key], value, `${reference}: ${key}`);
      }
    }
    assert.equal(prepareSourceProduct(original).issues.includes("Atributo no normalizable: Kilometraje"), false, reference);
    assert.equal(JSON.stringify(original), snapshot, reference);
  }
});

test("Mercaeleva: rechaza kilometraje cuando cambia la fuente o la unidad", () => {
  for (const reference of Object.keys(mileageCorrections)) {
    const original = sourceRecord(reference);
    const variants: readonly ProductRecord[] = [
      { ...original, reference: "M000-0000" },
      { ...original, url: `${original.url}?variante=1` },
      { ...original, model: `${original.model}-OTRA` },
      { ...original, longDescription: (original.longDescription ?? "").replace("KM ", "HORAS ") },
      { ...original, specs: { ...original.specs, "Horas laborales": "999 h" } }
    ];
    for (const changed of variants) {
      assert.equal(reconcileMercaelevaVerifiedPlatformSourceSpecs(changed), changed, `${reference}: identidad`);
    }
  }
});
