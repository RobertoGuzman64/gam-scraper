import { isDeepStrictEqual } from "node:util";
import type { ProductRecord, SpecValue } from "../../../../contracts/catalog.js";
import { explicitNumericSpecUnit, normalizeSpecKey, normalizeSpecsObject, reconcileSourceSpecsForNormalization, type NormalizedSpecValue } from "../../../../catalog/normalization/normalize-specs.js";
import { SPEC_RULES } from "../../../../catalog/normalization/spec-rules.js";
import type { NormalizationCheckEvidence, NormalizationCheckFinding, NormalizationCheckOutcome } from "../../../../catalog/diagnostics/normalization/normalization-checks.js";
import type { NormalizationSerializationOutcomes } from "../../../../catalog/diagnostics/normalization/normalization-serialization.js";
import { serializeProductsCsv } from "../../../../scraping/output/csv-serializer.js";
import { parseCsv } from "../../../../shared/csv-parse.js";
import { toCsv } from "../../../../shared/csv.js";
import { normalizeGamRows } from "../../../../tools/gam/normalization/normalize-rows.js";
import { parseCsv as parseSeedCsv } from "../../../../tools/gam/seed/internal/csv.js";
import { parseSeedSpecJson } from "../../../../tools/gam/seed/internal/json.js";
import { normalizeSeedSpecs } from "../../../../tools/gam/seed/internal/spec.js";
import { normalizeSpace } from "../../../../tools/gam/seed/internal/string.js";

const originalCircuit = "original-csv-specjson";
const columnCircuit = "csv-normalizado-columnas";
const directCircuit = "seed-specjson-directo";
const indirectCircuit = "seed-specjson-via-csv-normalizado";
const canonicalCircuit = "normalizador-resultado-reconciliado";
const normalizedCircuit = "csv-normalizado-specjson";
const scope = "GAM: proyección técnica en memoria; no acredita resolución de categorías, emisión de seed ni ejecución comercial";
const normalizedScope = `${scope}; recorrido con --allow-unknown y --expand-spec-columns, sujeto a bloqueo por conflictos`;
type Values = Readonly<Record<string, unknown>>;
type EvidenceValue = SpecValue | NormalizedSpecValue;

const noEvaluation = (reason: string): NormalizationCheckOutcome => ({ status: "no_evaluable", reason });
const evaluated = (findings: readonly NormalizationCheckFinding[]): NormalizationCheckOutcome => ({ status: "evaluada", findings });
const readValue = (values: Values, field: string): unknown => Object.hasOwn(values, field) ? values[field] : undefined;
const scalar = (value: unknown): value is string | number | boolean => typeof value === "string" || typeof value === "number" || typeof value === "boolean";
const evidence = (circuit: string, field: string, value: unknown): NormalizationCheckEvidence => {
  if (value === undefined) return { stage: "original", circuit, field, present: false };
  const observed: EvidenceValue = value === null || scalar(value) ? value : Array.isArray(value) && value.every(scalar) ? value : JSON.stringify(value);
  return { stage: "original", circuit, field, present: true, value: observed };
};
const difference = (key: string, circuit: string, cause: string, reason: string, before: NormalizationCheckEvidence,
  after: NormalizationCheckEvidence, assessment: NormalizationCheckFinding["assessment"], applicability = scope,
  extra: readonly NormalizationCheckEvidence[] = []): NormalizationCheckFinding => ({
  stage: "original", specificationKey: Object.hasOwn(SPEC_RULES, normalizeSpecKey(key)) ? normalizeSpecKey(key) : null,
  circuit, cause, reason, assessment, applicability, evidence: [before, after, ...extra]
});

export const compareSerializedSpecs = (expected: Values, actual: Values, circuit = originalCircuit): readonly NormalizationCheckFinding[] => {
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  return [...keys].flatMap((key) => {
    const before = readValue(expected, key), after = readValue(actual, key);
    return isDeepStrictEqual(before, after) ? [] : [difference(key, circuit, "specjson-alterado-en-serializacion",
      "El recorrido de serialización y lectura CSV altera una clave o valor original", evidence("entrada-observada", key, before),
      evidence(circuit, key, after), "defecto_reproducible")];
  });
};

const canonicalValue = (key: string, value: unknown): NormalizedSpecValue | undefined => value === undefined ? undefined :
  normalizeSpecsObject({ [key]: value }).normalized[key];
const changeAssessment = (before: unknown, after: unknown): NormalizationCheckFinding["assessment"] =>
  typeof before === "string" && typeof after === "string" || typeof before === "object" && !Array.isArray(before) ? "hipotesis" : "defecto_reproducible";

export const compareTechnicalColumns = (expected: Readonly<Record<string, NormalizedSpecValue>>, json: Values,
  row: Readonly<Record<string, string>>): readonly NormalizationCheckFinding[] => {
  const findings: NormalizationCheckFinding[] = [];
  for (const [key, before] of Object.entries(expected)) {
    if (before === null) continue;
    const rawJson = readValue(json, key);
    const field = `spec__${key}`;
    const rawColumn = row[field] || undefined;
    const jsonValue = canonicalValue(key, rawJson);
    const columnValue = canonicalValue(key, rawColumn);
    const beforeEvidence = evidence(canonicalCircuit, key, before);
    const jsonEvidence = evidence(normalizedCircuit, key, rawJson);
    const columnEvidence = evidence(columnCircuit, field, rawColumn);
    if (!isDeepStrictEqual(before, jsonValue)) findings.push(difference(key, normalizedCircuit, "interpretacion-alterada-en-csv",
      "La representación escalar de specJson no recupera la interpretación canónica con el normalizador vigente", beforeEvidence,
      jsonEvidence, changeAssessment(before, jsonValue), normalizedScope, [evidence("normalizador-specjson", key, jsonValue)]));
    if (!isDeepStrictEqual(jsonValue, columnValue) || rawColumn === undefined && rawJson !== undefined) findings.push(difference(key, columnCircuit,
      "columna-tecnica-divergente", "La columna técnica expandida no conserva la interpretación de specJson", jsonEvidence, columnEvidence,
      changeAssessment(jsonValue, columnValue), normalizedScope, [beforeEvidence, evidence("normalizador-columna", key, columnValue)]));
    const unit = typeof rawJson === "number" ? explicitNumericSpecUnit(key) : undefined;
    if (unit && rawColumn !== undefined && !rawColumn.trim().endsWith(` ${unit}`)) findings.push(difference(key, columnCircuit,
      "unidad-explicita-omitida-en-columna", "La columna numérica no conserva la unidad explícita exigida por el contrato de expansión", jsonEvidence,
      columnEvidence, "defecto_reproducible", normalizedScope));
  }
  return findings;
};

export const compareDirectSeed = (expected: Readonly<Record<string, NormalizedSpecValue>>, seed: Values): readonly NormalizationCheckFinding[] =>
  Object.entries(expected).flatMap(([key, before]) => {
    if (before === null) return [];
    const after = readValue(seed, key);
    if (isDeepStrictEqual(before, after) || typeof before === "object" && !Array.isArray(before) && isDeepStrictEqual(before, canonicalValue(key, after))) return [];
    return [difference(key, directCircuit, "interpretacion-alterada-en-seed-directo",
      "La proyección técnica compartida por las tres variantes seed no conserva la interpretación canónica; las estructuras requieren contraste semántico",
      evidence(canonicalCircuit, key, before), evidence(directCircuit, key, after), changeAssessment(before, after))];
  });

export const compareSeedRoutes = (direct: Values, indirect: Values): readonly NormalizationCheckFinding[] => {
  const keys = new Set([...Object.keys(direct), ...Object.keys(indirect)]);
  return [...keys].flatMap((key) => {
    const before = readValue(direct, key), after = readValue(indirect, key);
    if (isDeepStrictEqual(before, after)) return [];
    const known = Object.hasOwn(SPEC_RULES, key);
    return [difference(key, indirectCircuit, "recorridos-seed-divergentes", "El mismo consumidor técnico produce valores o tipos distintos según reciba el CSV original o el normalizado",
      evidence(directCircuit, key, before), evidence(indirectCircuit, key, after), known ? changeAssessment(before, after) : "hipotesis", normalizedScope)];
  });
};

const seedRows = (csv: string, technicalColumns = false): readonly Record<string, string>[] => {
  const { headers, rows } = parseSeedCsv(csv);
  const required = new Set(["url", "reference", "specJson", "categoryKey", "title"]);
  const selected = headers.flatMap((header, index) => required.has(header) || technicalColumns && header.startsWith("spec__")
    ? [{ header, index }] : []);
  return rows.map((row) => Object.fromEntries(selected.map(({ header, index }) => [header, row[index] ?? ""])));
};
const matched = (rows: readonly Record<string, string>[], index: number, source: ProductRecord): Record<string, string> => {
  const row = rows[index];
  if (!row || row.url !== source.url || row.reference !== (source.reference ?? "")) throw new Error("Fila CSV no conciliada con la identidad de origen");
  return row;
};
const attempt = (operation: () => NormalizationCheckOutcome): NormalizationCheckOutcome | Error => {
  try { return operation(); } catch (error) { return error instanceof Error ? error : new Error(String(error)); }
};

const normalizeCsv = async (csv: string, records: readonly ProductRecord[]) => {
  const { headers: originalHeaders, rows } = parseCsv(csv);
  const headers = [...originalHeaders];
  if (rows.length !== records.length) throw new Error("Población CSV original alterada");
  const normalizationInputs = records.map((source, index) => parseSeedSpecJson(matched(rows, index, source).specJson ?? "", source.reference ?? source.url));
  const statistics = await normalizeGamRows(rows, headers, { expandSpecColumns: true, maxValuesPerKey: 50 }, async () => {});
  if (statistics.rowsWithInvalidSpecJson) throw new Error("El normalizador CSV rechaza specJson generado por el serializador");
  return { csv: toCsv(rows, headers), normalizationInputs };
};

const readSerializationRoutes = async (records: readonly ProductRecord[]) => {
  const csv = serializeProductsCsv(records);
  const directRows = seedRows(csv);
  if (directRows.length !== records.length) throw new Error("Población CSV original alterada");
  const normalized = await normalizeCsv(csv, records);
  const normalizedRows = seedRows(normalized.csv, true);
  if (normalizedRows.length !== records.length) throw new Error("Población CSV normalizada alterada");
  return { directRows, normalizedRows, normalizationInputs: normalized.normalizationInputs };
};

export const inspectGamSerialization = async (records: readonly ProductRecord[]): Promise<ReadonlyMap<string, NormalizationSerializationOutcomes>> => {
  if (records.some(({ providerId }) => providerId !== "gam")) throw new Error("Población CSV–seed ajena a GAM");
  const { directRows, normalizedRows, normalizationInputs } = await readSerializationRoutes(records);
  const result = new Map<string, NormalizationSerializationOutcomes>();
  for (const [index, source] of records.entries()) {
    const reference = source.reference ?? source.url;
    const original = matched(directRows, index, source);
    const normalized = matched(normalizedRows, index, source);
    const raw = parseSeedSpecJson(original.specJson ?? "", reference);
    const normalizationInput = normalizationInputs[index];
    if (!normalizationInput) throw new Error("Entrada de normalización CSV ausente");
    const rawFindings = [...compareSerializedSpecs(source.specs ?? {}, raw),
      ...compareSerializedSpecs(source.specs ?? {}, normalizationInput, "original-csv-lector-normalizacion")];
    const norm = normalizeSpecsObject(reconcileSourceSpecsForNormalization(raw).specs);
    const blocked = norm.conflictingKeys.length > 0;
    const hasInput = Object.keys(raw).length > 0;
    const hasCanonical = Object.keys(norm.normalized).length > 0;
    const seedEligible = Boolean(normalizeSpace(original.categoryKey ?? "") && normalizeSpace(original.title ?? ""));
    const ineligible = !seedEligible ? "Sin título o categoría de entrada al conversor seed" : blocked ? "Conflictos de alias bloquean los conversores seed" : !hasInput ? "Sin prestaciones de entrada" : null;
    const normalizedJson = parseSeedSpecJson(normalized.specJson ?? "", reference);
    const direct = ineligible === null ? (() => { try { return normalizeSeedSpecs(raw, reference); } catch (error) { return error instanceof Error ? error : new Error(String(error)); } })() : null;
    const columnOutcome = blocked ? noEvaluation("Conflictos de alias bloquean la normalización CSV") : !hasCanonical ? noEvaluation("Sin prestaciones interpretadas para expandir") :
      attempt(() => evaluated(compareTechnicalColumns(norm.normalized, normalizedJson, normalized)));
    const directOutcome = ineligible !== null ? noEvaluation(ineligible) : direct instanceof Error ? direct :
      direct === null || !hasCanonical ? noEvaluation("Sin prestaciones interpretadas para contrastar el seed directo") : attempt(() => evaluated(compareDirectSeed(norm.normalized, direct)));
    const indirectOutcome = ineligible !== null ? noEvaluation(ineligible) : direct instanceof Error ? direct : direct === null ? noEvaluation("Sin seed directo comparable") :
      attempt(() => evaluated(compareSeedRoutes(direct, normalizeSeedSpecs(normalizedJson, reference))));
    if (result.has(source.url)) throw new Error("Identidad CSV–seed duplicada");
    result.set(source.url, { "csv-specjson": evaluated(rawFindings), "csv-columnas-tecnicas": columnOutcome,
      "seed-directo": directOutcome, "seed-via-csv-normalizado": indirectOutcome });
  }
  return result;
};
