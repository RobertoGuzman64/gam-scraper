import assert from "node:assert/strict";
import test from "node:test";
import type { ImportCandidate, ImportCatalog } from "../../../commercial/legacy-export/contracts.js";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import type { TechnicalSpecEvidence } from "../../../contracts/technical-provenance.js";
import { createPreparedSourceFixture } from "../../../testing/builders/prepared-source-fixture.js";
import { originalRecordFingerprint } from "../../identity-fingerprint.js";
import { attachNormalizationPublication, inspectNormalizationProduct } from "../normalization/normalization-audit.js";
import { inspectAttributeOpportunities, normalizationAttributeChecks } from "../normalization/normalization-attributes.js";
import { evaluateNormalizationChecks, summarizeNormalizationChecks, type NormalizationCheckContext, type NormalizationCheckOutcome } from "../normalization/normalization-checks.js";

const prepare = createPreparedSourceFixture();
const catalog: ImportCatalog = {
  categories: [{ id: 1, parentId: null, name: "Maquinaria Nueva", slug: "maquinaria-nueva" },
    { id: 2, parentId: 1, name: "Carretilla elevadora eléctrica", slug: "carretilla-elevadora-electrica" }],
  attributes: [{ id: 3, name: "Altura de elevación", type: "NUMBER", unit_option: "mm", required: false },
    { id: 4, name: "Centro de carga", type: "NUMBER", unit_option: "mm", required: false },
    { id: 5, name: "Neumáticos", type: "SELECT", unit_option: "Macizos / Neumáticos", required: false },
    { id: 6, name: "Altura máxima de elevación", type: "NUMBER", unit_option: "m", required: false }],
  relations: [{ categoryID: 2, attributeID: 3 }, { categoryID: 2, attributeID: 4 }, { categoryID: 2, attributeID: 5 }, { categoryID: 2, attributeID: 6 }]
};
const source = (specs: SpecsMap): ProductRecord => ({ providerId: "gam", categoryKey: "carretillas-nuevas", categoryName: "Carretillas",
  url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/sintetica", reference: "SINTETICA",
  title: "Carretilla elevadora eléctrica Marca Modelo", shortDescription: "Carretilla eléctrica Marca Modelo", longDescription: "Ficha sintética",
  price: null, brand: "Marca", model: "Modelo", year: null, location: null, country: null, horometer: null, serialNumber: null,
  image: null, condition: "Nuevo", specs });
const context = (specs: SpecsMap, assignments: ImportCandidate["attributes"] = [], changes: Partial<ProductRecord> = {},
  recovery?: { specs: SpecsMap; entries: readonly TechnicalSpecEvidence[] }): NormalizationCheckContext => {
  const record = { ...source(specs), ...changes };
  const result = prepare(record);
  const prepared = recovery ? { ...result, product: { ...result.product, spec: recovery.specs },
    technicalProvenance: { originalRecordSha256: originalRecordFingerprint(record), entries: recovery.entries } } : result;
  const published = prepared.product;
  const observation = attachNormalizationPublication(inspectNormalizationProduct(record, prepared), record, published, "a".repeat(64));
  return { source: record, prepared, published, observation, commercial: { catalog, catalogSha256: "b".repeat(64),
    mapped: { ...prepared, product: { ...published, categorySellID: 2, category: "Carretilla elevadora eléctrica", condition: "Nuevo", attributes: assignments } } } };
};
const findings = (outcome: NormalizationCheckOutcome) => {
  if (outcome.status !== "evaluada") assert.fail(`Comprobación evaluable esperada: ${JSON.stringify(outcome)}`);
  return outcome.findings;
};

test("acredita una oportunidad directa de prestación reconocida, con ID, contrato y ausencia o valor observado", () => {
  const input = context({ "Altura de elevación (mm)": "3500 mm" });
  const snapshot = JSON.stringify(input);
  const missing = findings(inspectAttributeOpportunities(input));
  assert.equal(missing.length, 1);
  assert.equal(missing[0]?.cause, "atributo-representable-no-asignado:3");
  assert.equal(missing[0]?.specificationKey, "Altura de elevación (mm)");
  assert.equal(missing[0]?.assessment, "hipotesis");
  assert.deepEqual(missing[0]?.evidence[0], { stage: "original", circuit: "resolucion-atributo", field: "3:Altura de elevación", present: true, value: 3500 });
  assert.equal(missing[0]?.evidence[1]?.present, false);
  assert.equal(JSON.stringify(input), snapshot);
  const divergent = findings(inspectAttributeOpportunities(context({ "Altura de elevación (mm)": "3500 mm" }, [{ attributeID: 3, value: 3000 }])));
  assert.equal(divergent[0]?.cause, "atributo-valor-divergente:3");
  assert.equal(divergent[0]?.evidence[1]?.present, true);
  assert.deepEqual(findings(inspectAttributeOpportunities(context({ "Altura de elevación (mm)": "3500 mm" }, [{ attributeID: 3, value: 3500 }]))), []);
});

test("no equipara atributos no relacionados, opciones inválidas, contradicciones ni configuraciones alternativas con carencias", () => {
  for (const specs of [{ "Altura de elevación (mm)": "3500 / 5500 mm" }, { "Altura de elevación (mm)": "3500 mm", "Altura de elevación (m)": "5 m" },
    { "Neumáticos": "Opción no admitida" }] satisfies readonly SpecsMap[]) {
    const result = inspectAttributeOpportunities(context(specs));
    assert.ok(result.status !== "evaluada" || result.findings.length === 0);
  }
  const input = context({ "Altura de elevación (mm)": "3500 mm" });
  assert.ok(input.commercial);
  const inactive = { ...input, commercial: { ...input.commercial, catalog: { ...catalog, relations: catalog.relations.map((entry) => ({ ...entry, actived: false })) } } };
  assert.equal(inspectAttributeOpportunities(inactive).status, "no_aplicable");
});

test("distingue recuperación de unidad acreditada de un valor de modelo o una traza incompatible", () => {
  const trace: TechnicalSpecEvidence = { field: "Centro de carga (mm)", value: "500 mm", scope: "unit",
    sourceField: "longDescription", sourceValue: "Ficha sintética", mechanism: "src/preparation/technical/technical-presentation.ts" };
  const input = context({}, [], {}, { specs: { "Centro de carga (mm)": "500 mm" }, entries: [trace] });
  const result = findings(inspectAttributeOpportunities(input));
  assert.equal(result[0]?.circuit, "atributo-recuperacion-unidad-proyeccion");
  assert.equal(result[0]?.specificationKey, "Centro de carga (mm)");
  const wrongTrace = context({}, [], {}, { specs: { "Centro de carga (mm)": "500 mm" }, entries: [{ ...trace, sourceValue: "Otra ficha" }] });
  assert.equal(inspectAttributeOpportunities(wrongTrace).status, "no_evaluable");
  const modelOnly = context({}, [], {}, { specs: { "Centro de carga (mm)": "500 mm" }, entries: [{
    field: trace.field, value: trace.value, mechanism: trace.mechanism, scope: "model-document", sourceField: null, sourceValue: null,
    document: { url: "https://example.test/manual", brand: "Marca", model: "Modelo" }
  }] });
  assert.equal(inspectAttributeOpportunities(modelOnly).status, "no_evaluable");
});

test("declara exclusión, categoría pendiente, identidad incompatible y error de evaluación sin modificar los resultados anteriores", () => {
  const input = context({ "Altura de elevación (mm)": "3500 mm" });
  assert.ok(input.commercial);
  const { commercial, ...missing } = input;
  assert.equal(inspectAttributeOpportunities(missing).status, "no_evaluable");
  assert.equal(inspectAttributeOpportunities({ ...input, published: null }).status, "no_aplicable");
  const pending = { ...input, commercial: { ...commercial, mapped: { ...commercial.mapped, product: { ...commercial.mapped.product, categorySellID: null } } } };
  assert.equal(inspectAttributeOpportunities(pending).status, "no_evaluable");
  const other = { ...input, commercial: { ...commercial, mapped: { ...commercial.mapped, product: { ...commercial.mapped.product, reference: "OTRA" } } } };
  assert.equal(inspectAttributeOpportunities(other).status, "no_evaluable");
  const failed = { ...missing, commercialError: "Metadatos inaccesibles" };
  const report = summarizeNormalizationChecks(normalizationAttributeChecks, ["gam"], evaluateNormalizationChecks(normalizationAttributeChecks, "gam", [failed]));
  assert.equal(report.failures[0]?.reason, "Metadatos inaccesibles");
  assert.equal(report.checks[0]?.errors, 1);
});


test("la representación escalar conserva la unidad canónica implícita antes de consultar el mapeador", () => {
  const input = context({ "Altura máxima de elevación": "14 m" }, [{ attributeID: 6, value: 14 }]);
  const result = findings(inspectAttributeOpportunities(input));
  assert.ok(!result.some(({ cause }) => cause.endsWith(":6")));
});


test("una divergencia real entre la normalización escalar y la asignación observada conserva ambas lecturas sin elegir el separador", () => {
  const input = context({ "Centro de carga (mm)": "2,345 mm" }, [{ attributeID: 4, value: 2345 }]);
  const result = findings(inspectAttributeOpportunities(input));
  const hypothesis = result.find(({ circuit }) => circuit === "atributo-normalizado-contraste-aislado");
  assert.equal(hypothesis?.specificationKey, "Centro de carga (mm)");
  assert.equal(hypothesis?.assessment, "hipotesis");
  assert.equal(hypothesis?.evidence[0]?.present && hypothesis.evidence[0].value, 2.345);
  assert.equal(hypothesis?.evidence[1]?.present && hypothesis.evidence[1].value, 2345);
});
