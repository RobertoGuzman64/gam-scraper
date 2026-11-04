import { recoverMercaelevaDocumentedResidualLiftSpecs } from "../../../../evidence/providers/mercaeleva/documented-residual-lift-specs.js";
import { recoverMercaelevaDocumentedEquipmentTechnicalSpecs } from "../../../../evidence/providers/mercaeleva/documented-equipment-technical-specs.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readMercaelevaSource } from "../../../../../../testing/builders/mercaeleva-source-fixture.js";
import { documentedLegacyPlatformModels } from "../../../../evidence/providers/mercaeleva/documented-legacy-platform-models.js";
import { resolveMercaelevaLegacyPlatformGeneral } from "../../../../mapping/providers/mercaeleva/documented-legacy-platform-general.js";
import { recoverMercaelevaDocumentedPlatformTechnicalSpecs } from "../../../../evidence/providers/mercaeleva/documented-platform-technical-specs.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { recoverMercaelevaDocumentedDensity180Specs } from "../../../../evidence/providers/mercaeleva/documented-density-180.js";

const records = await readMercaelevaSource();
const improvedReferences = new Set([
  "M971-8124", "M692-8041", "M061-0041", "M318-0509", "M018-7013",
  "M940-3556", "M840-8278", "M988-6161", "M932-2445", "M177-1398",
  "M159-0669", "M484-4055", "M239-8327", "M315-5925", "M624-7785",
  "M805-9451", "M777-6495", "M310-8756", "M044-4093", "M995-8408", "M141-6600"
]);

const find = (reference: string): ProductRecord => {
  const record = records.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const preparedGeneral = (reference: string): string => {
  const general = prepareSourceProduct(find(reference)).product.description_general;
  assert.ok(general, reference);
  return general;
};

test("Mercaeleva: documenta modelos de plataformas sin sobrescribir descripciones previas suficientes", () => {
  const matched = records.filter((record) => resolveMercaelevaLegacyPlatformGeneral(record) !== null);
  assert.equal(matched.length, 33);
  assert.equal(documentedLegacyPlatformModels.length, 18);
  assert.equal(new Set(documentedLegacyPlatformModels.map((item) => `${item.brand}:${item.model}`)).size, 18);

  const improved = new Set<string>();
  for (const record of matched) {
    const snapshot = JSON.stringify(record);
    const documentation = documentedLegacyPlatformModels.find((item) =>
      item.brand === record.brand && item.model === record.model && item.condition === record.condition);
    assert.ok(documentation);
    assert.match(documentation.source, /^https:\/\//u);
    const general = resolveMercaelevaLegacyPlatformGeneral(record);
    assert.ok(general);
    assert.ok(general.split(/\s+/u).length >= 85, record.reference ?? "");
    for (const value of [documentation.manufacturerHeight, documentation.platformHeight,
      documentation.capacity, documentation.distinctive, record.year ?? ""]) {
      assert.ok(general.includes(value), `${record.reference}:${value}`);
    }

    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.equal(JSON.stringify(record), snapshot);
    if (improvedReferences.has(record.reference ?? "")) {
      assert.equal(prepared.product.description_general, general, record.reference ?? "");
      assert.deepEqual(prepared.product.spec, recoverMercaelevaDocumentedDensity180Specs(record, recoverMercaelevaDocumentedResidualLiftSpecs(record, recoverMercaelevaDocumentedEquipmentTechnicalSpecs(record, recoverMercaelevaDocumentedPlatformTechnicalSpecs(record, record.specs ?? {})))));
      improved.add(record.reference ?? "");
    } else {
      assert.notEqual(prepared.product.description_general, general, record.reference ?? "");
      const description = prepared.product.description_general;
      assert.ok(description);
      assert.ok(description.split(/\s+/u).length >= 60);
    }
  }

  const reconciled = find("M777-6495");
  assert.equal(resolveMercaelevaLegacyPlatformGeneral(reconciled), null);
  const prepared = prepareSourceProduct(reconciled);
  assert.equal(prepared.status, "ready");
  assert.match(preparedGeneral("M777-6495"), /21,6 m/u);
  assert.match(preparedGeneral("M777-6495"), /7373 horas/u);
  improved.add("M777-6495");
  assert.deepEqual(improved, improvedReferences);
});

test("Mercaeleva: distingue conflictos de horómetro y conserva avisos comerciales sin certificarlos", () => {
  for (const [reference, sourceHours, structuredHours] of [
    ["M018-7013", "7386", "7368"],
    ["M840-8278", "623", "627"],
    ["M988-6161", "415", "416"]
  ] as const) {
    const general = preparedGeneral(reference);
    assert.ok(general.includes(`${sourceHours} horas`), reference);
    assert.ok(general.includes(`${structuredHours} h`), reference);
    assert.match(general, /discrepancia que debe verificarse/u);
  }
  assert.match(preparedGeneral("M159-0669"),
    /0 horas, sin una lectura de horómetro estructurada/u);
  assert.match(preparedGeneral("M315-5925"),
    /ficha estructurada consigna 1347 h, aunque el anuncio original no indica horas/u);
  assert.match(preparedGeneral("M692-8041"),
    /«SECOND LIFE», sin acreditar por sí sola una rehabilitación/u);
  assert.match(preparedGeneral("M310-8756"),
    /«PINTADA», sin que ello acredite una revisión mecánica/u);
  assert.match(preparedGeneral("M159-0669"),
    /9,8 m en interiores y 8 m en exteriores/u);
});

test("Mercaeleva: no aplica documentación a identidad, procedencia, estado, horas o técnica manipulados", () => {
  for (const reference of ["M725-7107", "M547-1056", "M198-7237", "M887-9469"]) {
    assert.equal(resolveMercaelevaLegacyPlatformGeneral(find(reference)), null, reference);
  }
  for (const record of records.filter((item) => resolveMercaelevaLegacyPlatformGeneral(item))) {
    const cases: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, categoryKey: "alquiler" },
      { ...record, reference: `${record.reference}-otra` },
      { ...record, url: `${record.url}?consulta=otra` },
      { ...record, brand: "Otra marca" },
      { ...record, model: "Otro modelo" },
      { ...record, condition: record.condition === "Nuevo" ? "Segunda mano" : "Nuevo" },
      { ...record, title: `${record.title} otra versión` },
      { ...record, year: "1999" },
      { ...record, horometer: "99999" },
      { ...record, longDescription: `${record.longDescription} equipamiento no acreditado` },
      { ...record, specs: { ...record.specs, "Estado": "Desconocido" } },
      { ...record, specs: { ...record.specs, "Título adicional": "Otra plataforma" } },
      { ...record, specs: { ...record.specs, "Tipo de motor": "Otro" } },
      { ...record, specs: { ...record.specs, "Altura de trabajo": "25 m" } },
      { ...record, specs: { ...record.specs, "Artículo No.": "otra" } },
      { ...record, specs: { ...record.specs, "Año de fabricación": "1999" } },
      { ...record, specs: { ...record.specs, "Horas laborales": "99999 h" } }
    ];
    for (const [index, candidate] of cases.entries()) {
      assert.equal(resolveMercaelevaLegacyPlatformGeneral(candidate), null, `${record.reference}:${index}`);
    }
  }
});
