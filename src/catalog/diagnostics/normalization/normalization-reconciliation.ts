import { isDeepStrictEqual } from "node:util";
import type { SpecsMap, SpecValue } from "../../../contracts/catalog.js";
import { normalizeOriginalTechnicalPresentation, normalizeTechnicalPresentation } from "../../../preparation/technical/technical-presentation.js";
import { normalizeSpecKey, normalizeSpecsObject, reconcileSourceSpecsForNormalization } from "../../normalization/normalize-specs.js";
import { parseBatteryConfiguration, parseBoolean } from "../../normalization/spec-parsers.js";
import { SPEC_RULES } from "../../normalization/spec-rules.js";
import type { NormalizationCheck, NormalizationCheckEvidence, NormalizationCheckFinding, NormalizationCheckOutcome } from "./normalization-checks.js";

type Values = Readonly<Record<string, unknown>>;
type Change = { readonly field: string; readonly value: SpecValue };
type ReconciliationSource = { readonly from: string; readonly to?: string };
const isSpecValue = (value: unknown): value is SpecValue => typeof value === "string" || typeof value === "number" ||
  typeof value === "boolean" || Array.isArray(value) && value.every((item: unknown) =>
    typeof item === "string" || typeof item === "number" || typeof item === "boolean");
const changes = (before: Values, after: Values): readonly Change[] => Object.entries(before).flatMap(([field, value]) =>
  isSpecValue(value) && (!Object.hasOwn(after, field) || !isDeepStrictEqual(value, after[field])) ? [{ field, value }] : []);
const evidence = (circuit: string, field: string, value: unknown): NormalizationCheckEvidence => isSpecValue(value)
  ? { stage: "original", circuit, field, present: true, value } : { stage: "original", circuit, field, present: false };
const interpreted = ({ field, value }: Change) => normalizeSpecsObject({ [field]: value }).normalized[normalizeSpecKey(field)];
const equivalent = (source: Change, target: Change): boolean => {
  const sourceKey = normalizeSpecKey(source.field);
  const targetKey = normalizeSpecKey(target.field);
  const left = interpreted(source);
  const right = interpreted(target);
  if (sourceKey === targetKey) return left !== undefined && left !== null && isDeepStrictEqual(left, right);
  if (right !== undefined && right !== null && isDeepStrictEqual(source.value, target.value)) return true;
  const battery = parseBatteryConfiguration(source.value);
  if (battery !== null && battery === parseBatteryConfiguration(target.value) && right === battery) return true;
  const availability = typeof source.value === "boolean" || typeof source.value === "string" && /^(?:s[ií]|no|yes|true|false)$/iu.test(source.value.trim())
    ? parseBoolean(source.value) : null;
  return availability !== null && typeof right === "boolean" && availability === right;
};

export const compareSemanticReconciliation = (before: Values, after: Values, circuit: string,
  sourceFields: readonly ReconciliationSource[]): readonly NormalizationCheckFinding[] => {
  const removed = changes(before, after);
  const added = changes(after, before);
  const findings: NormalizationCheckFinding[] = [];
  if (!removed.length) return findings;
  const combined = normalizeSpecsObject(after).normalized;
  const retained = (target: Change): boolean => {
    const value = interpreted(target);
    return value !== undefined && value !== null && isDeepStrictEqual(value, combined[normalizeSpecKey(target.field)]);
  };
  for (const source of removed) {
    const renames = sourceFields.filter(({ from }) => from === source.field);
    const key = normalizeSpecKey(source.field);
    if (!Object.hasOwn(SPEC_RULES, key)) continue;
    const isolated = interpreted(source);
    if ((isolated === undefined || isolated === null) && parseBatteryConfiguration(source.value) === null &&
      !(renames.length > 0 && typeof source.value === "boolean")) continue;
    const sameKey = added.filter((target) => normalizeSpecKey(target.field) === key && equivalent(source, target) && retained(target));
    const renamed = renames.length === 1 ? added.filter((target) =>
      (renames[0]?.to === undefined || renames[0].to === target.field) && equivalent(source, target) && retained(target)) : [];
    if (sameKey.length === 1 || renamed.length === 1) continue;
    const overwritten = Object.hasOwn(after, source.field);
    const affectedKeys = new Set([key, ...added.map(({ field }) => normalizeSpecKey(field))]);
    const unchangedCompetitors = Object.entries(after).filter(([field, value]) => field !== source.field &&
      affectedKeys.has(normalizeSpecKey(field)) && Object.hasOwn(before, field) && isDeepStrictEqual(value, before[field]));
    findings.push({ cause: overwritten ? "prestacion-alterada-en-reconciliacion" : "prestacion-sin-equivalencia-en-reconciliacion",
      specificationKey: key, stage: "original", circuit, assessment: "hipotesis",
      applicability: "Reconciliación aislada de entrada original mediante una función productiva; no acredita el recorrido completo de preparación o exportación",
      reason: overwritten ? "Una interpretación aislada válida cambia sin equivalencia acreditada; debe revisarse la precedencia"
        : "Una interpretación aislada válida deja de estar presente sin destino equivalente único acreditado",
      evidence: [evidence(`${circuit}-entrada`, source.field, source.value), evidence(`${circuit}-salida`, source.field, after[source.field]),
        ...removed.filter(({ field }) => field !== source.field).map(({ field, value }) => evidence(`${circuit}-entrada`, field, value)),
        ...added.filter(({ field }) => field !== source.field).map(({ field, value }) => evidence(`${circuit}-salida`, field, value)),
        ...unchangedCompetitors.flatMap(([field, value]) => [evidence(`${circuit}-entrada`, field, value), evidence(`${circuit}-salida`, field, value)])] });
  }
  return findings;
};

export const inspectPresentationReconciliation = (specs: SpecsMap): NormalizationCheckOutcome => {
  if (!Object.keys(specs).some((key) => Object.hasOwn(SPEC_RULES, normalizeSpecKey(key)))) {
    return { status: "no_aplicable", reason: "Sin claves reconocidas para la reconciliación de presentación" };
  }
  const findings: NormalizationCheckFinding[] = [];
  normalizeOriginalTechnicalPresentation(normalizeTechnicalPresentation(specs), specs, (before, after, _mechanism, sourceField) => {
    findings.push(...compareSemanticReconciliation(before, after, "reconciliacion-presentacion-original",
      typeof sourceField === "object" ? [{ from: sourceField.spec }] : []));
  });
  return { status: "evaluada", findings };
};

export const inspectSourceReconciliation = (specs: SpecsMap): NormalizationCheckOutcome => {
  if (!Object.keys(specs).some((key) => Object.hasOwn(SPEC_RULES, normalizeSpecKey(key)))) {
    return { status: "no_aplicable", reason: "Sin claves reconocidas para la reconciliación de origen" };
  }
  const result = reconcileSourceSpecsForNormalization(specs);
  return { status: "evaluada", findings: compareSemanticReconciliation(specs, result.specs,
    "reconciliacion-normalizador-origen", result.renames) };
};

export const semanticReconciliationChecks: readonly NormalizationCheck[] = [
  { id: "precedencias-reconciliacion-presentacion", evaluate: ({ source }) => inspectPresentationReconciliation(source.specs ?? {}) },
  { id: "precedencias-reconciliacion-origen", evaluate: ({ source }) => source.providerId === "gam"
    ? inspectSourceReconciliation(source.specs ?? {}) : { status: "no_aplicable", reason: "Reconciliación de origen del circuito de GAM" } }
];
