import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { technicalDocumentClaimSha256, type TechnicalSpecEvidence } from "../../../contracts/technical-provenance.js";
import { createPreparedSourceFixture } from "../../../testing/builders/prepared-source-fixture.js";
import { originalRecordFingerprint } from "../../identity-fingerprint.js";
import { attachNormalizationPublication, inspectNormalizationProduct } from "../normalization/normalization-audit.js";
import { inspectPreparationProvenance, inspectPublicationProvenance } from "../normalization/normalization-provenance.js";
import { inspectStageEquivalences, normalizationEquivalenceChecks } from "../normalization/normalization-equivalence.js";
import { evaluateNormalizationChecks, summarizeNormalizationChecks, type NormalizationCheckContext, type NormalizationCheckOutcome } from "../normalization/normalization-checks.js";

const prepare = createPreparedSourceFixture();
const mechanism = "src/preparation/technical/technical-presentation.ts";
const source = (specs: SpecsMap): ProductRecord => ({ providerId: "gam", categoryKey: "plataformas-tijera", categoryName: "Plataformas de tijera",
  url: "https://example.test/plataforma-sintetica", reference: "SINTETICA", title: "Plataforma de tijera Marca Modelo",
  shortDescription: null, longDescription: "Altura de trabajo de 8 m", price: null, brand: "Marca", model: "Modelo",
  year: null, location: null, country: null, horometer: null, serialNumber: null, image: null, specs });
const trace = (changes: Partial<Extract<TechnicalSpecEvidence, { scope: "unit" }>> = {}): TechnicalSpecEvidence => ({
  field: "Altura plataforma (m)", value: "8 m", mechanism, scope: "unit",
  sourceField: "Altura de trabajo (m)", sourceValue: "8 m", ...changes });
const context = (original: SpecsMap, current: SpecsMap, entries: readonly TechnicalSpecEvidence[],
  publication?: { specs: SpecsMap; entries: readonly TechnicalSpecEvidence[] }): NormalizationCheckContext => {
  const record = source(original);
  const prepared = prepare(record);
  const fingerprint = originalRecordFingerprint(record);
  const currentProduct = { ...prepared, product: { ...prepared.product, spec: current },
    technicalProvenance: { originalRecordSha256: fingerprint, entries } };
  const observed = inspectNormalizationProduct(record, currentProduct);
  const published = publication ? { ...currentProduct.product, spec: publication.specs } : null;
  const observation = published ? attachNormalizationPublication(observed, record, published, "a".repeat(64)) : observed;
  return { source: record, prepared: currentProduct, observation, published,
    publishedProvenance: publication ? { originalRecordSha256: fingerprint, entries: publication.entries } : null };
};
const findings = (result: NormalizationCheckOutcome) => {
  if (result.status !== "evaluada") assert.fail(`Comprobación evaluable esperada: ${result.status}`);
  return result.findings;
};
const original = { "Altura de trabajo (m)": "8 m" };
const destination = { "Altura plataforma (m)": "8 m" };

test("una traza exacta acredita el enlace de la etapa, no la equivalencia técnica ni la publicación histórica", () => {
  const input = context(original, destination, [trace()], { specs: destination, entries: [] });
  const snapshot = JSON.stringify(input);
  const result = findings(inspectPreparationProvenance(input));
  assert.equal(result.length, 1);
  assert.equal(result[0]?.assessment, "diferencia_legitima");
  assert.equal(result[0]?.stage, "preparacion");
  assert.match(result[0]?.reason ?? "", /no acredita por sí sola equivalencia técnica/u);
  assert.deepEqual(result[0]?.evidence.filter(({ stage }) => stage === "original"), [
    { stage: "original", circuit: "original-prestacion-conciliado-con-traza", field: "Altura de trabajo (m)", present: true, value: "8 m" }
  ]);
  assert.equal(inspectPublicationProvenance(input).status, "no_aplicable");
  assert.deepEqual(findings(inspectStageEquivalences(input, input.observation.original, input.observation.prepared)), []);
  const historical = findings(inspectStageEquivalences(input, input.observation.original, input.observation.publication?.observation));
  assert.equal(historical[0]?.cause, "contraste-sin-correspondencia");
  assert.equal(historical[0]?.assessment, "hipotesis");
  assert.equal(JSON.stringify(input), snapshot);
});

test("la traza histórica conciliada no se sustituye por la actual ni acredita otra variante", () => {
  const input = context(original, { "Altura plataforma (m)": "9 m" }, [trace({ value: "9 m" })], { specs: destination, entries: [trace()] });
  const result = findings(inspectPublicationProvenance(input));
  assert.equal(result[0]?.stage, "publicacion");
  assert.equal(result[0]?.assessment, "diferencia_legitima");
  assert.deepEqual(findings(inspectStageEquivalences(input, input.observation.original, input.observation.publication?.observation)), []);
  const divergence = findings(inspectStageEquivalences(input, input.observation.prepared, input.observation.publication?.observation));
  assert.equal(divergence[0]?.assessment, "no_evaluable");
  const unrelated = { ...input, publishedProvenance: { originalRecordSha256: "b".repeat(64), entries: [trace()] } };
  assert.equal(inspectPublicationProvenance(unrelated).status, "no_evaluable");
  assert.equal(findings(inspectStageEquivalences(unrelated, unrelated.observation.original, unrelated.observation.publication?.observation))[0]?.cause, "contraste-sin-correspondencia");
});

test("la clave de origen y el valor exacto de destino deben coincidir aunque dos valores sean normalizables", () => {
  const wrongSource = context(original, destination, [trace({ sourceField: "Altura de trabajo", sourceValue: "8 m" })]);
  const wrongValue = context(original, destination, [trace({ sourceValue: "8000 mm" })]);
  const wrongDestination = context(original, destination, [trace({ value: "8000 mm" })]);
  for (const [input, cause] of [[wrongSource, "procedencia-origen-incompatible"], [wrongValue, "procedencia-origen-incompatible"],
    [wrongDestination, "procedencia-destino-incompatible"]] as const) {
    const result = findings(inspectPreparationProvenance(input));
    assert.equal(result[0]?.cause, cause);
    assert.equal(result[0]?.assessment, "defecto_reproducible");
  }
  const ambiguous = context(original, { "Anchura": "1200 mm", "Anchura total": "1200 mm" }, [trace({ field: "Anchura (mm)", value: "1200 mm" })]);
  assert.equal(findings(inspectPreparationProvenance(ambiguous))[0]?.assessment, "no_evaluable");
});

test("distingue documentación verificada, referencia sin verificar y huella de afirmación incompatible", () => {
  const document = { url: "https://example.test/manual", brand: "Marca", model: "Modelo" };
  const base: Extract<TechnicalSpecEvidence, { scope: "model-document" | "unit-document" | "document-reference" }> = {
    field: "Altura plataforma (m)", value: "8 m", mechanism, scope: "model-document", document, sourceField: null, sourceValue: null };
  const reviewedOn = "2026-11-01";
  const support = "Ficha técnica sintética";
  const verification = { kind: "reviewed-model-fact" as const, reviewedOn, support,
    claimSha256: technicalDocumentClaimSha256(document, base.field, base.value, reviewedOn, support) };
  const verified = context(original, destination, [{ ...base, verification }]);
  assert.equal(findings(inspectPreparationProvenance(verified))[0]?.cause, "procedencia-documental-conciliada");
  assert.equal(findings(inspectPreparationProvenance(context(original, destination, [base])))[0]?.assessment, "no_evaluable");
  assert.equal(findings(inspectPreparationProvenance(context(original, destination, [{ ...base, verification: { ...verification, claimSha256: "b".repeat(64) } }])))[0]?.cause,
    "procedencia-verificacion-incompatible");
});

test("las representaciones equivalentes no generan señales ni se equiparan prestaciones distintas por su magnitud", () => {
  const input = context({ "Anchura": "1,2 m", "Peso (kg)": "1000 kg", ...original },
    { "Anchura total": "1200 mm", "Peso (kg)": "1500 kg", ...destination }, []);
  const result = findings(inspectStageEquivalences(input, input.observation.original, input.observation.prepared));
  assert.deepEqual(result.map(({ specificationKey, cause }) => [specificationKey, cause]), [
    ["Peso (kg)", "contraste-valor-distinto"], ["Altura de trabajo (m)", "contraste-sin-correspondencia"]]);
  assert.ok(result.every(({ assessment }) => assessment === "hipotesis"));
});

test("la igualdad del resultado normalizado no oculta una pérdida semántica observada por la comprobación existente", () => {
  const input = context({ "Marca del motor": ["Marca", "sin", "filtro"] }, { "Marca del motor": "sin filtro" }, []);
  const result = findings(inspectStageEquivalences(input, input.observation.original, input.observation.prepared));
  assert.equal(result[0]?.cause, "equivalencia-normalizada-no-concluyente");
  assert.equal(result[0]?.assessment, "hipotesis");
  assert.equal(result.length, 1);
});

test("la cobertura histórica ausente o fallida se distingue y el impacto se deduplica por prestación", () => {
  const input = context(original, destination, [trace()], { specs: destination, entries: [trace()] });
  const report = summarizeNormalizationChecks(normalizationEquivalenceChecks, ["gam"], evaluateNormalizationChecks(normalizationEquivalenceChecks, "gam", [input]));
  assert.equal(report.byAssessment.diferencia_legitima.occurrences, 2);
  assert.equal(report.byAssessment.diferencia_legitima.uniqueSpecifications, 1);
  assert.equal(report.potential.occurrences, 0);
  const unavailable = { ...input, publishedProvenance: null };
  assert.equal(inspectPublicationProvenance(unavailable).status, "no_evaluable");
  const failed = { ...unavailable, publicationProvenanceError: "Huella histórica incompatible" };
  const coverage = summarizeNormalizationChecks(normalizationEquivalenceChecks, ["gam"], evaluateNormalizationChecks(normalizationEquivalenceChecks, "gam", [failed]));
  assert.equal(coverage.failures[0]?.check, "procedencia-publicacion");
  assert.equal(coverage.checks.find(({ check }) => check === "procedencia-publicacion")?.errors, 1);
});
