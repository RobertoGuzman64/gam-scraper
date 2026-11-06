import { recoverMercaelevaDocumentedLgmgAndBtLiftSpecs } from "../../technical/evidence/documented-lgmg-and-bt-lift-specs.js";
import { recoverMercaelevaDocumentedEquipmentTechnicalSpecs } from "../../technical/evidence/documented-equipment-technical-specs.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readMercaelevaSource } from "../../../../testing/builders/mercaeleva-source-fixture.js";
import { verifiedPlatformModelOperatingData } from "../../technical/evidence/verified-platform-model-operating-data.js";
import { resolveMercaelevaDocumentedModelOperatingGeneral } from "../mapping/documented-model-operating-general.js";
import { recoverMercaelevaDocumentedPlatformTechnicalSpecs } from "../../technical/evidence/documented-platform-technical-specs.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const records = await readMercaelevaSource();
const references = new Set([
  "M238-0251", "M380-2365", "M479-8138", "M579-8838", "M622-7084",
  "M690-5522", "M731-0501", "M749-9513", "M829-9712", "M665-4166",
  "M451-2844", "M584-9410", "M726-5166", "M649-6453", "M569-9029",
  "M082-6111", "M140-0406", "M055-3461", "M091-1956", "M549-6792"
]);

const find = (reference: string): ProductRecord => {
  const record = records.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Mercaeleva: acredita veinte descripciones pendientes con datos del modelo y de la unidad separados", () => {
  const matched = records.filter((item) => resolveMercaelevaDocumentedModelOperatingGeneral(item) !== null);
  assert.equal(matched.length, 20);
  assert.deepEqual(new Set(matched.map((item) => item.reference)), references);
  assert.equal(new Set(verifiedPlatformModelOperatingData.map((item) => `${item.brand}:${item.model}`)).size, 19);

  for (const record of matched) {
    const before = JSON.stringify(record);
    const documentation = verifiedPlatformModelOperatingData.find((item) =>
      record.brand === item.brand && record.model === item.model && record.condition === item.condition);
    assert.ok(documentation);
    assert.match(documentation.source, /^https:\/\//u);
    const description = resolveMercaelevaDocumentedModelOperatingGeneral(record);
    assert.ok(description);
    assert.ok(description.split(/\s+/u).length >= 60, record.reference ?? "");
    for (const detail of [documentation.manufacturerWorkHeight, documentation.platformHeight,
      documentation.capacity, documentation.distinctive, String(record.specs?.["Artículo No."]), record.year ?? ""]) {
      assert.ok(description.includes(detail), `${record.reference}: ${detail}`);
    }
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.description_general, description);
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.deepEqual(prepared.product.spec, recoverMercaelevaDocumentedLgmgAndBtLiftSpecs(record, recoverMercaelevaDocumentedEquipmentTechnicalSpecs(record, recoverMercaelevaDocumentedPlatformTechnicalSpecs(record, record.specs ?? {}))));
    assert.equal(JSON.stringify(record), before);
    if (record.horometer !== null) assert.ok(description.includes(`${record.horometer} h`));
    if (record.condition === "Nuevo") {
      assert.match(description, /como nueva/u);
      assert.doesNotMatch(description, /condición general buena/u);
    } else {
      assert.match(description, /como usada/u);
    }
  }
});

test("Mercaeleva: no extiende evidencia a una ficha con horas, origen, estado o modelo contradictorios", () => {
  for (const reference of ["M725-7107", "M777-6495", "M805-9451", "M971-8124", "M547-1056"]) {
    assert.equal(resolveMercaelevaDocumentedModelOperatingGeneral(find(reference)), null, reference);
  }
  for (const reference of references) {
    const record = find(reference);
    const candidates: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, categoryKey: "alquiler" },
      { ...record, reference: `${reference}-otra` },
      { ...record, url: `${record.url}?version=otra` },
      { ...record, brand: "Otra marca" },
      { ...record, model: "Otro modelo" },
      { ...record, condition: record.condition === "Nuevo" ? "Segunda mano" : "Nuevo" },
      { ...record, year: "1999" },
      { ...record, horometer: "9999" },
      { ...record, longDescription: `${record.longDescription} información sin acreditar` },
      { ...record, specs: { ...record.specs, "Estado": "Desconocido" } },
      { ...record, specs: { ...record.specs, "Título adicional": "Otra plataforma" } },
      { ...record, specs: { ...record.specs, "Condición general": "Regular" } },
      { ...record, specs: { ...record.specs, "Tipo de motor": "Otro" } },
      { ...record, specs: { ...record.specs, "Altura de trabajo": "25 m" } },
      { ...record, specs: { ...record.specs, "Artículo No.": "otro" } },
      { ...record, specs: { ...record.specs, "Año de fabricación": "1999" } },
      { ...record, specs: { ...record.specs, "Horas laborales": "9999 h" } }
    ];
    for (const [index, candidate] of candidates.entries()) {
      assert.equal(resolveMercaelevaDocumentedModelOperatingGeneral(candidate), null, `${reference}:${index}`);
    }
  }
});
