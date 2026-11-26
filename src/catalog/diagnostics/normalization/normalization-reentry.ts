import { isDeepStrictEqual } from "node:util";
import { normalizeSpecsObject, type NormalizedSpecValue, type NormalizeResult } from "../../normalization/normalize-specs.js";
import type { NormalizationAuditStage, NormalizationStageObservation } from "./normalization-audit.js";
import type { NormalizationCheck, NormalizationCheckEvidence, NormalizationCheckFinding, NormalizationCheckOutcome } from "./normalization-checks.js";

type Values = Readonly<Record<string, NormalizedSpecValue>>;
const circuit = "normalizador-reentrada";
const firstPass = "normalizador-resultado";
const applicability = "Salida interpretada del normalizador, reintroducida con su clave canónica y tipo original";

const evidenceOf = (stage: NormalizationAuditStage, step: string, field: string, values: Values): NormalizationCheckEvidence => {
  const value = Object.hasOwn(values, field) ? values[field] : undefined;
  return value === undefined ? { stage, circuit: step, field, present: false } : { stage, circuit: step, field, present: true, value };
};

const valueShape = (value: unknown): string => {
  if (value === null || value === undefined) return String(value);
  if (Array.isArray(value)) return `lista:${value.length}`;
  return typeof value === "object" ? `objeto:${Object.keys(value).sort().join(",")}` : typeof value;
};

export const compareNormalizationReentry = (stage: NormalizationStageObservation, initial: Values,
  reentered: NormalizeResult): readonly NormalizationCheckFinding[] => {
  const findings: NormalizationCheckFinding[] = [];
  const conflicts = new Map(reentered.conflictingKeys.map(({ key, sources }) => [key, sources]));
  const keys = new Set([...Object.keys(initial), ...Object.keys(reentered.normalized), ...conflicts.keys()]);
  for (const key of keys) {
    const before = evidenceOf(stage.stage, firstPass, key, initial);
    const after = evidenceOf(stage.stage, circuit, key, reentered.normalized);
    const conflict = conflicts.get(key);
    if (!conflict && before.present && after.present && isDeepStrictEqual(before.value, after.value)) continue;
    const extraKeys = new Set([key, ...(conflict ?? []), ...reentered.renamedKeys.filter(({ to }) => to === key).map(({ from }) => from)]);
    const rawEvidence: NormalizationCheckEvidence[] = stage.specifications.flatMap((spec): NormalizationCheckEvidence[] =>
      spec.kind === "interpretada" && extraKeys.has(spec.canonicalKey)
        ? [{ stage: stage.stage, circuit: "entrada-observada", field: spec.rawKey, present: true, value: spec.rawValue }] : []);
    const extraEvidence = [...extraKeys].filter((field) => field !== key).map((field) => evidenceOf(stage.stage, firstPass, field, initial));
    const rejections = [...new Set(reentered.discardedSpecs.filter(({ key: discardedKey }) => discardedKey === key).map(({ reason }) => reason))].sort();
    const base = { specificationKey: key, stage: stage.stage, circuit, applicability,
      evidence: [before, after, ...extraEvidence, ...rawEvidence] as const };
    if (conflict) findings.push({ ...base, cause: "conflicto-en-reentrada", assessment: "defecto_reproducible",
      reason: `La reentrada genera un conflicto entre ${conflict.join(", ")}` });
    else if (!after.present) findings.push({ ...base, cause: "perdida-en-reentrada", assessment: "defecto_reproducible",
      reason: `La prestación interpretada desaparece al renormalizar${rejections.length ? `: ${rejections.join(", ")}` : reentered.unknownKeys.includes(key) ? ": clave no reconocida" : ""}` });
    else if (!before.present) findings.push({ ...base, cause: "nueva-interpretacion-en-reentrada", assessment: "defecto_reproducible",
      reason: "La reentrada produce una clave ausente del resultado inicial" });
    else if (valueShape(before.value) !== valueShape(after.value)) findings.push({ ...base, cause: "estructura-alterada-en-reentrada",
      assessment: "defecto_reproducible", reason: "La reentrada modifica el tipo o la estructura del resultado interpretado" });
    else if (typeof before.value === "string" && typeof after.value === "string") findings.push({ ...base, cause: "texto-alterado-en-reentrada",
      assessment: "hipotesis", reason: "La reentrada cambia el texto normalizado; su equivalencia semántica no está acreditada" });
    else findings.push({ ...base, cause: "valor-alterado-en-reentrada", assessment: "defecto_reproducible",
      reason: "La reentrada altera un valor interpretado sin cambiar su estructura" });
  }
  return findings;
};

export const inspectNormalizationReentry = (stage: NormalizationStageObservation): NormalizationCheckOutcome => {
  const values = new Map<string, NormalizedSpecValue>();
  for (const spec of stage.specifications) {
    if (spec.kind !== "interpretada") continue;
    const existing = values.get(spec.canonicalKey);
    if (existing !== undefined && !isDeepStrictEqual(existing, spec.normalizedValue)) {
      throw new Error(`Resultado inicial incoherente en reentrada: ${spec.canonicalKey}`);
    }
    values.set(spec.canonicalKey, spec.normalizedValue);
  }
  if (values.size === 0) return { status: "no_evaluable", reason: "Sin prestaciones interpretadas para reintroducir" };
  const initial = Object.fromEntries(values);
  return { status: "evaluada", findings: compareNormalizationReentry(stage, initial, normalizeSpecsObject(initial)) };
};

export const normalizationReentryChecks: readonly NormalizationCheck[] = [
  { id: "idempotencia-original", evaluate: ({ observation }) => inspectNormalizationReentry(observation.original) },
  { id: "idempotencia-preparacion", evaluate: ({ observation }) => inspectNormalizationReentry(observation.prepared) },
  { id: "idempotencia-publicacion", evaluate: ({ observation }) => observation.publication
    ? inspectNormalizationReentry(observation.publication.observation)
    : { status: "no_aplicable", reason: "Ficha sin publicación acreditada conciliada" } }
];
