import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { controlledGomarizPlatform } from "../../editorial/core/editorial-contract-records.js";
import { applyDocumentedTechnicalEvidence, recoverReviewedModelTechnicalSpecs, type DocumentedTechnicalUnit } from "../../technical/documented-technical-evidence.js";
import { isProductTechnicalProvenance } from "../../provenance/technical-provenance.js";
import { buildPublicationTechnicalProvenance, isPublicationTechnicalProvenance } from "../../provenance/publication-technical-provenance.js";
import { originalRecordFingerprint } from "../../../catalog/identity-fingerprint.js";
import type { OfflinePreparation } from "../../documents/offline-document.js";

const record = (reference = "77777", longDescription = "La altura de trabajo: 12 m."): ProductRecord => ({
  providerId: "gam", categoryKey: "elevacion-nueva", categoryName: "Plataformas elevadoras nuevas",
  url: `https://online.gamrentals.com/es/plataformas-elevadoras-nuevas/${reference}-prueba`,
  reference, title: "Plataforma de tijera eléctrica XCMG", shortDescription: "Equipo de elevación",
  longDescription, price: "20000 €", brand: "XCMG", model: "Tijera", year: null,
  location: null, country: null, horometer: null, serialNumber: null, condition: "Nuevo",
  image: "https://example.test/image.jpg", images: ["https://example.test/image.jpg"], specs: {}
});

test("fase 17: el motor emite el mecanismo ejecutado con identidad de ficha y valor publicado", () => {
  const original = record();
  const prepared = prepareSourceProduct(original);
  assert.equal(prepared.product.spec["Altura de trabajo (m)"], "12 m");
  assert.ok(prepared.technicalProvenance);
  assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
  assert.equal(prepared.technicalProvenance.originalRecordSha256, originalRecordFingerprint(original));
  assert.deepEqual(prepared.technicalProvenance.entries, [{
    field: "Altura de trabajo (m)", value: "12 m",
    mechanism: "src/preparation/gam/technical/measurements/work-height-evidence.ts",
    scope: "unit", sourceField: "longDescription", sourceValue: original.longDescription
  }]);
  const repeated = prepareSourceProduct(original);
  assert.deepEqual(repeated.technicalProvenance, prepared.technicalProvenance);
  assert.deepEqual(repeated.product, prepared.product);
});

test("fase 17: las variantes, fuentes y valores alterados invalidan la procedencia individual", () => {
  const initial = prepareSourceProduct(record());
  const changedValue = prepareSourceProduct(record("77777", "La altura de trabajo: 13 m."));
  const changedVariant = prepareSourceProduct(record("88888"));
  assert.notEqual(changedValue.technicalProvenance?.originalRecordSha256, initial.technicalProvenance?.originalRecordSha256);
  assert.notEqual(changedVariant.technicalProvenance?.originalRecordSha256, initial.technicalProvenance?.originalRecordSha256);
  assert.notDeepEqual(changedValue.technicalProvenance?.entries, initial.technicalProvenance?.entries);
  assert.deepEqual(prepareSourceProduct(record("77777", "Sin medidas de altura.")).technicalProvenance?.entries, []);
  assert.equal(prepareSourceProduct({ ...record(), url: "https://example.test/prueba" })
    .technicalProvenance?.entries[0]?.scope, "unknown");
});

test("fase 17: solo se publica procedencia técnica asociada a los productos aprobados", () => {
  const source = record();
  const first = prepareSourceProduct(source);
  const second = prepareSourceProduct(record("88888", "Sin medidas de altura."));
  const preparation: OfflinePreparation = {
    version: 1, quality: "complete", published: true, preparedAt: "2026-11-21T00:00:00.000Z",
    source: { providerId: "gam", prefix: "test", scope: "0000000000000000", catalogSha256: "a".repeat(64), productCount: 2 },
    fingerprints: { rulesVersion: 2, rulesSha256: "b".repeat(64) },
    totals: { ready: 2, review: 0 }, identities: ["gam:ref:77777", "gam:ref:88888"],
    products: [first, second]
  };
  const sha = "c".repeat(64);
  const trace = buildPublicationTechnicalProvenance("gam", sha, [first.product, second.product], preparation);
  assert.ok(trace);
  assert.ok(isPublicationTechnicalProvenance(trace));
  assert.equal(trace.products.length, 2);
  assert.equal(trace.products[0]?.technicalProvenance.entries.length, 1);
  assert.equal(trace.products[1]?.technicalProvenance.entries.length, 0);
  const empty = buildPublicationTechnicalProvenance("gam", sha, [second.product], preparation);
  assert.ok(empty);
  assert.equal(empty.products[0]?.technicalProvenance.entries.length, 0);
  assert.throws(() => buildPublicationTechnicalProvenance("gam", sha, [
    { ...first.product, reference: "99999" }
  ], preparation), /Falta producto preparado|Falta procedencia/);
  assert.equal(isPublicationTechnicalProvenance({ ...trace, products: [trace.products[0], trace.products[0]] }), false);
});


test("la evidencia de anuncio conserva la procedencia y no se extiende a otra unidad o fuente modificada", () => {
  const original = record("CONTROL-01", "La cesta cuenta con rotación hidráulica de 90° + 90°.");
  const specs = original.specs ?? {};
  const specifications = { "Rotación de cesta": "90° a cada lado" };
  const evidence: DocumentedTechnicalUnit = {
    fingerprint: createHash("sha256").update(JSON.stringify(original)).digest("hex"),
    brand: original.brand, model: original.model, categoryKey: original.categoryKey,
    title: original.title ?? "", url: original.url, specifications
  };
  const units = { "CONTROL-01": evidence };
  const policy = { providerId: "gam", isEligible: (value: ProductRecord) => value.categoryKey === "elevacion-nueva", exactTitleAndUrl: true };
  const observations: unknown[] = [];
  const result = applyDocumentedTechnicalEvidence(original, specs, units, policy,
    (_before, _after, _mechanism, _field, source) => observations.push(source), "evidencia-control");
  assert.deepEqual(result, { ...specs, ...specifications });
  assert.deepEqual(observations, [{ scope: "unit-document", document: { url: original.url, brand: original.brand, model: original.model } }]);
  assert.equal(applyDocumentedTechnicalEvidence(original, result, units, policy), result);
  for (const invalid of [{ ...original, reference: "CONTROL-02" }, { ...original, model: "MODELO20" },
    { ...original, longDescription: "Otra declaración técnica." }, { ...original, providerId: "gomariz" }]) {
    assert.equal(applyDocumentedTechnicalEvidence(invalid, specs, units, policy), specs);
  }
  const existing = { ...specs, "Rotación de cesta": "80° a cada lado" };
  assert.equal(applyDocumentedTechnicalEvidence(original, existing, units, policy), existing);
});


test("la recuperación de prestaciones condicionadas conserva los valores y rechaza evidencia incompatible", () => {
  const original = { ...record("CONTROL-02", "Velocidad de 8 km/h con carga y 12 km/h sin carga. Altura de acoplamiento de 365 mm."), title: "Tractor de arrastre", model: "TRACTOR" };
  const specs = { "Capacidad de arrastre": "5000 kg" };
  const specifications = {
    "Velocidad de desplazamiento con/sin carga (km/h)": "8 / 12 km/h",
    "Altura de acoplamiento": "365 mm"
  };
  const units = { "CONTROL-02": {
    fingerprint: createHash("sha256").update(JSON.stringify(original)).digest("hex"),
    brand: original.brand, model: original.model, categoryKey: original.categoryKey,
    title: original.title ?? "", url: original.url, specifications
  } } satisfies Readonly<Record<string, DocumentedTechnicalUnit>>;
  const policy = { providerId: "gam", isEligible: (value: ProductRecord) => value.categoryKey === original.categoryKey, exactTitleAndUrl: true };
  const observed: string[] = [];
  const result = applyDocumentedTechnicalEvidence(original, specs, units, policy,
    (before, after) => observed.push(...Object.keys(after).filter((field) => !(field in before))), "evidencia-control");
  assert.deepEqual(result, { ...specs, ...specifications });
  assert.deepEqual(observed, Object.keys(specifications));
  assert.equal(applyDocumentedTechnicalEvidence(original, result, units, policy), result);
  const conflicting = { ...specs, "Altura de acoplamiento": "400 mm" };
  assert.equal(applyDocumentedTechnicalEvidence(original, conflicting, units, policy), conflicting);
  const incompatible: ProductRecord[] = [{ ...original, title: "Otra variante" }, { ...original, url: original.url + "-otra" },
    { ...original, providerId: "manain" }, { ...original, longDescription: "Velocidad de 12 km/h." }];
  for (const changed of incompatible) {
    assert.equal(applyDocumentedTechnicalEvidence(changed, specs, units, policy), specs);
  }
});

test("la evidencia de configuración conserva el alcance de la prestación y no sobrescribe datos de unidad", () => {
  const original = record("CONTROL-03", "La plataforma tiene rotación de cesta de 90° a cada lado y cuatro estabilizadores hidráulicos.");
  const specs = { "Capacidad de carga (kg)": "230 kg" };
  const specifications = { "Rotación de cesta": "90° a cada lado", "Número de estabilizadores": "4" };
  const units = { "CONTROL-03": {
    fingerprint: createHash("sha256").update(JSON.stringify(original)).digest("hex"),
    brand: original.brand, model: original.model, categoryKey: original.categoryKey,
    title: original.title ?? "", url: original.url, specifications
  } } satisfies Readonly<Record<string, DocumentedTechnicalUnit>>;
  const policy = { providerId: "gam", isEligible: (value: ProductRecord) => value.categoryKey === original.categoryKey, exactTitleAndUrl: true };
  const recovered = applyDocumentedTechnicalEvidence(original, specs, units, policy);
  assert.deepEqual(recovered, { ...specs, ...specifications });
  assert.equal(applyDocumentedTechnicalEvidence(original, recovered, units, policy), recovered);
  const conflict = { ...specs, "Número de estabilizadores": "2" };
  assert.equal(applyDocumentedTechnicalEvidence(original, conflict, units, policy), conflict);
  assert.equal(applyDocumentedTechnicalEvidence({ ...original, longDescription: "Cesta con rotación opcional." }, specs, units, policy), specs);
  assert.equal(applyDocumentedTechnicalEvidence({ ...original, reference: "CONTROL-04" }, specs, units, policy), specs);
});

const nominalCenter = "Centro de carga nominal del modelo";
const recoverDocumented = (record: ProductRecord) => recoverReviewedModelTechnicalSpecs(record, record.specs ?? {});

test("recupera el centro nominal común a variantes usadas de capacidad corroborada", () => {
  const record: ProductRecord = { ...controlledGomarizPlatform(), brand: "HELI", model: "CPD18",
    year: "2023", country: null, condition: "Segunda mano", title: "HELI CPD18", shortDescription: null,
    longDescription: "Carretilla para uso interior.", url: "https://www.gomarizrent.com/manipulacion-de-materiales/carretilla-industrial/heli-cpd18-control/",
    specs: { "Altura de trabajo": "4,5 m", Motor: "Eléctrico", Capacidad: "1800 kg" } };
  const before = structuredClone(record);
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, [nominalCenter]: "500 mm" });
  assert.deepEqual(record, before);
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  const entry = prepareSourceProduct(record).technicalProvenance?.entries.find((item) => item.field === nominalCenter);
  assert.equal(entry?.scope, "model-document");
  assert.equal(entry?.verification?.kind, "reviewed-model-fact");
  assert.deepEqual(recoverDocumented({ ...record, reference: "CONTROL-02",
    url: "https://www.gomarizrent.com/manipulacion-de-materiales/carretilla-industrial/heli-cpd18-control-2/" }), result);
  for (const invalid of [
    { ...record, model: "CPD18SQ" }, { ...record, year: "2022" }, { ...record, country: "México" },
    { ...record, title: "HELI CPD18 otra variante" }, { ...record, url: "https://www.gomarizrent.com/carretilla-industrial/heli-cpd20/" },
    { ...record, specs: { ...record.specs, Capacidad: "1750 kg" } },
    { ...record, specs: { ...record.specs, Motor: "Diésel" } },
    { ...record, specs: { ...record.specs, "Centro de carga": "600 mm" } },
    { ...record, longDescription: "Carretilla con centro de carga de 600 mm." }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
});

test("recupera datos de generación compatibles sin confundir la potencia de iluminación", () => {
  const record: ProductRecord = { ...controlledGomarizPlatform(), brand: "Smc", model: "TL90",
    year: "2012", condition: "Segunda mano", title: "SMC TL90", shortDescription: null,
    longDescription: "Torre de iluminación remolcable.", url: "https://www.gomarizrent.com/torre-de-iluminacion/smc-tl90-control/",
    specs: { "Altura almacenaje": "2.10 m", Longitud: "2.50 m", Anchura: "1.32 m", Peso: "1050 kg", Potencia: "4x1000 W" } };
  const before = structuredClone(record);
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, "Capacidad del depósito de combustible": "130 L",
    "Potencia continua del generador": "5 kW", "Frecuencia nominal": "50 Hz" });
  assert.deepEqual(record, before);
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  for (const invalid of [
    { ...record, model: "TL90 LED" }, { ...record, year: "2015" },
    { ...record, specs: { ...record.specs, Potencia: "4x300 W" } },
    { ...record, specs: { ...record.specs, Peso: "1200 kg" } },
    { ...record, specs: { ...record.specs, "Frecuencia": "60 Hz" } },
    { ...record, longDescription: "Torre de iluminación con alternador sustituido." },
    { ...record, longDescription: "Grupo electrógeno." }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  assert.deepEqual(recoverDocumented({ ...record, providerId: "mercaeleva", reference: "CONTROL-02",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/smc-tl90-control-02" }), result);
  const declared = { ...record.specs, Frecuencia: "60 Hz" };
  assert.equal(recoverReviewedModelTechnicalSpecs(record, declared), declared);
});

test("conserva la potencia declarada y distingue la potencia de emergencia de la continua", () => {
  const record: ProductRecord = { ...controlledGomarizPlatform(), brand: "Pramac", model: "GPW100I_FS2",
    year: "2023", condition: "Segunda mano", title: "Pramac GPW100I_FS2", shortDescription: null,
    longDescription: "Grupo electrógeno para suministro eléctrico.", url: "https://www.gomarizrent.com/producto/pramac-gpw100i_fs2/",
    specs: { Altura: "1.85 metros", Longitud: "2.76 m", Anchura: "1.12 m", Peso: "1489 kg", Motor: "Diésel", Potencia: "100 kva" } };
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, "Potencia de emergencia ESP": "110 kVA", "Factor de potencia nominal": "0,8", "Frecuencia nominal": "50 Hz" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  for (const invalid of [
    { ...record, model: "GPW100P_FS2" }, { ...record, model: "GPW100I_FS5" },
    { ...record, specs: { ...record.specs, Potencia: "110 kva" } },
    { ...record, specs: { ...record.specs, Motor: "Gasolina" } },
    { ...record, longDescription: "Grupo electrógeno de frecuencia 60 Hz." }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec["Potencia de emergencia ESP"], "110 kVA");
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === "Potencia de emergencia ESP");
  assert.equal(entry?.scope, "model-document");
  assert.equal(entry?.verification?.kind, "reviewed-model-fact");
});

test("recupera prestaciones de una oferta corroborada sin trasladar otros datos de una variante", () => {
  const record: ProductRecord = { ...controlledGomarizPlatform(), providerId: "gam", brand: "CTE", model: "AZ14 PICKUP",
    condition: "Nuevo", title: "Plataforma articulada CTE AZ14 PICKUP", shortDescription: "CTE AZ14 PICKUP nueva.",
    longDescription: "Plataforma articulada con alcance lateral de 7,1 metros y sistema hidráulico H+H.",
    url: "https://online.gamrentals.com/es/cte/control-plataforma-cte-az14-pickup",
    specs: { Marca: "CTE", Modelo: "AZ14 PICKUP", Longitud: "5900 mm", Altura: "2700 mm", "Altura de elevación (m)": "13,5 metros", "Capacidad de carga (kg)": "230 KG" } };
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, "Alcance horizontal (m)": "7,1 m", "Sistema de estabilización": "H+H" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  assert.deepEqual(recoverDocumented({ ...record, providerId: "mercaeleva", reference: "CONTROL-02",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/cte-az14-pickup-control-02" }), result);
  const invalidRecords: ProductRecord[] = [
    { ...record, condition: "Segunda mano" }, { ...record, year: "2023" }, { ...record, serialNumber: "CONTROL" },
    { ...record, shortDescription: "CTE ZED14 nueva." }, { ...record, model: "AZ14 PICKUP FIB" },
    { ...record, longDescription: "Plataforma articulada con alcance lateral de 7,1 metros." },
    { ...record, longDescription: `${record.longDescription} Alcance lateral: 8 m.` },
    { ...record, longDescription: `${record.longDescription} Estabilización opcional.` },
    { ...record, specs: { ...record.specs, "Alcance horizontal": "8 m" } }
  ];
  for (const invalid of invalidRecords) assert.equal(recoverDocumented(invalid), invalid.specs);
});

test("recupera los depósitos de una fregadora corroborada sin atribuir configuración de batería", () => {
  const record: ProductRecord = { ...controlledGomarizPlatform(), brand: "Nilfisk", model: "BR850-S",
    title: "Nilfisk BR850-S", longDescription: "Las fregadoras limpian suelos.",
    url: "https://www.gomarizrent.com/limpieza/fregadora/nilfisk-br850-s-control/",
    specs: { Altura: "1.35 m", Longitud: "1.55 m", Anchura: "0.88 m", Peso: "705 kg", Motor: "Eléctrico", "Anchura limpieza": "0.81 m" } };
  const result = recoverDocumented(record);
  assert.deepEqual(result, { ...record.specs, "Capacidad del depósito de solución": "157 L", "Capacidad del depósito de recuperación": "157 L", "Tensión nominal": "36 V" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  for (const invalid of [
    { ...record, model: "BR850" }, { ...record, year: "2005" },
    { ...record, specs: { ...record.specs, Peso: "650 kg" } },
    { ...record, longDescription: "Barredora de limpieza." },
    { ...record, longDescription: "Fregadora con depósito sustituido." },
    { ...record, url: "https://www.gomarizrent.com/producto/nilfisk-br850-s/" }
  ]) assert.equal(recoverDocumented(invalid), invalid.specs);
  const entry = prepareSourceProduct(record).technicalProvenance?.entries.find((item) => item.field === "Tensión nominal");
  assert.equal(entry?.scope, "model-document");
  assert.equal(entry?.verification?.kind, "reviewed-model-fact");
});
