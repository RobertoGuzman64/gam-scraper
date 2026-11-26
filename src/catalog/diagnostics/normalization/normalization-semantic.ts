import { isDeepStrictEqual } from "node:util";
import type { SpecValue } from "../../../contracts/catalog.js";
import { normalizeSpecsObject, type NormalizedSpecValue } from "../../normalization/normalize-specs.js";
import { parseBoolean } from "../../normalization/spec-parsers.js";
import type { NormalizationSpecObservation, NormalizationStageObservation } from "./normalization-audit.js";
import type { NormalizationCheck, NormalizationCheckEvidence, NormalizationCheckFinding, NormalizationCheckOutcome } from "./normalization-checks.js";

type Recognized = Exclude<NormalizationSpecObservation, { kind: "no_reconocida" }>;
type Value = SpecValue | NormalizedSpecValue;
const observed = (stage: NormalizationStageObservation, circuit: string, field: string,
  value: Value | undefined): NormalizationCheckEvidence => value === undefined
  ? { stage: stage.stage, circuit, field, present: false }
  : { stage: stage.stage, circuit, field, present: true, value };
const rawEvidence = (stage: NormalizationStageObservation, spec: NormalizationSpecObservation) =>
  observed(stage, "entrada-observada", spec.rawKey, spec.rawValue);
const known = (stage: NormalizationStageObservation): readonly Recognized[] => stage.specifications.filter(
  (spec): spec is Recognized => spec.kind !== "no_reconocida");
const absent = (spec: Recognized): boolean => spec.kind === "descartada" && spec.reasons.includes("null_like");
const resultOf = (spec: Recognized): NonNullable<NormalizedSpecValue> | undefined =>
  spec.kind === "interpretada" ? spec.normalizedValue : undefined;

export const inspectAliasPrecedence = (stage: NormalizationStageObservation): NormalizationCheckOutcome => {
  const buckets = new Map<string, Recognized[]>();
  for (const spec of known(stage)) {
    const bucket = buckets.get(spec.canonicalKey) ?? [];
    bucket.push(spec);
    buckets.set(spec.canonicalKey, bucket);
  }
  const candidates = [...buckets.entries()].filter(([, specs]) => specs.length > 1);
  if (!candidates.length) return { status: "no_aplicable", reason: "Sin claves reconocidas concurrentes" };
  const findings: NormalizationCheckFinding[] = [];
  let evaluated = 0;
  for (const [key, specs] of candidates) {
    if (specs.every(absent)) continue;
    const combined = specs.find((spec) => spec.kind === "interpretada");
    const isolated = specs.map((spec) => ({ spec, value: normalizeSpecsObject({ [spec.rawKey]: spec.rawValue }).normalized[key] ?? undefined }));
    const valid = isolated.filter(({ value }) => value !== undefined);
    if (!valid.length) continue;
    evaluated += 1;
    const first = valid[0];
    if (!first) continue;
    const distinct = valid.some(({ value }) => !isDeepStrictEqual(first.value, value));
    const combinedValue = combined ? resultOf(combined) : undefined;
    const cause = distinct ? "alias-con-interpretaciones-incompatibles" : combinedValue === undefined
      ? "prestacion-suprimida-por-concurrencia" : !isDeepStrictEqual(first.value, combinedValue)
        ? "interpretacion-alterada-por-concurrencia" : null;
    if (cause === null) continue;
    const firstSpec = specs[0];
    if (!firstSpec) continue;
    findings.push({ cause, specificationKey: key, stage: stage.stage, circuit: "normalizador-alias-concurrentes",
      assessment: !distinct && valid.length === specs.filter((spec) => !absent(spec)).length
        ? "defecto_reproducible" : "hipotesis", applicability: "Dos o más claves de la misma prestación; interpretación aislada y conjunta con el normalizador real",
      reason: distinct ? "Las interpretaciones aisladas son incompatibles; no se acredita cuál debe prevalecer"
        : combinedValue === undefined ? "Una interpretación aislada válida desaparece al concurrir con otras claves; su precedencia requiere acreditación"
          : "El resultado conjunto difiere de la interpretación aislada; no se acredita una precedencia legítima",
      evidence: [rawEvidence(stage, firstSpec), ...specs.slice(1).map((spec) => rawEvidence(stage, spec)),
        ...isolated.map(({ spec, value }) => observed(stage, "normalizador-alias-aislado", spec.rawKey, value)),
        observed(stage, "normalizador-resultado", key, combinedValue)] });
  }
  return evaluated ? { status: "evaluada", findings } : { status: "no_evaluable", reason: "Ninguna clave concurrente tiene interpretación aislada válida" };
};

type SemanticShape = { readonly range: number; readonly alternatives: number; readonly multiplicity: number;
  readonly conditions: number; readonly negations: number };
const shape = (text: string): SemanticShape => {
  const value = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return {
    range: [...value.matchAll(/\d\s*(?:[a-z%°]+\s*)?[-–—]\s*(?=\d)|\bentre\s+\d[^\n]*?\s+y\s+\d/gu)].length,
    alternatives: [...value.matchAll(/\d\s*(?:[a-z%°]+\s*)?(?:\/|\||\bo\b)\s*(?=\d)|\|/gu)].length,
    multiplicity: [...value.matchAll(/\d\s*(?:[a-z%°]+\s*)?[x×]\s*(?=\d)/gu)].length,
    conditions: [...value.matchAll(/\b(?:con carga|sin carga|con estabilizadores|sin estabilizadores|opcional(?:es)?|segun|dependiendo de|hasta\s+\d|a partir de\s+\d|minim[oa]\s+\d|maxim[oa]\s+\d)\b/gu)].length,
    negations: [...value.matchAll(/\b(?:no|sin|not|without)\b/gu)].length
  };
};
const hasShape = (value: SemanticShape): boolean => Object.values(value).some((count) => count > 0);
const dimensionAxes = (value: NormalizedSpecValue): number => typeof value === "object" && value !== null &&
  "largo" in value && "ancho" in value ? [value.largo, value.ancho, "grosor" in value ? value.grosor : null]
    .filter((axis) => axis !== null).length : 0;
const listOf = (value: Value): value is readonly (string | number | boolean)[] => Array.isArray(value);
const relevantList = (value: SpecValue, rule: Recognized["rule"]): boolean => listOf(value) && value.length > 1 &&
  (rule !== "string" || value.some((entry) => typeof entry !== "string" || hasShape(shape(entry))));

const explicitNegation = (spec: Recognized): boolean => spec.rule === "bool" && parseBoolean(spec.rawValue) === false;

const semanticLoss = (spec: Recognized): readonly string[] => {
  const raw = spec.rawValue;
  const normalized = resultOf(spec);
  if (explicitNegation(spec)) return normalized === false ? [] : ["negación explícita"];
  if (typeof raw === "string") {
    const before = shape(raw);
    if (!hasShape(before)) return [];
    const after = typeof normalized === "string" ? shape(normalized) : null;
    const count = normalized === undefined ? 0 : listOf(normalized) ? normalized.length : dimensionAxes(normalized);
    const losses: string[] = [];
    if (before.range > (after?.range ?? 0)) losses.push("rango");
    if (before.alternatives > (after?.alternatives ?? 0) && count < before.alternatives + 1) losses.push("alternativas");
    if (before.multiplicity > (after?.multiplicity ?? 0) &&
      !((spec.rule === "dimension" || spec.rule === "dimension_rect") && count === before.multiplicity + 1)) losses.push("multiplicidad");
    if (before.conditions > (after?.conditions ?? 0)) losses.push("condiciones");
    if (before.negations > (after?.negations ?? 0) && !(normalized === false && parseBoolean(raw) === false)) losses.push("negación");
    return losses;
  }
  if (!relevantList(raw, spec.rule) || !listOf(raw)) return [];
  if (normalized === undefined) return ["lista"];
  if (listOf(normalized) && normalized.length === raw.length || dimensionAxes(normalized) === raw.length) return [];
  return ["lista"];
};

export const inspectSemanticConservation = (stage: NormalizationStageObservation): NormalizationCheckOutcome => {
  const candidates = known(stage).filter((spec) => !absent(spec) &&
    (explicitNegation(spec) || (typeof spec.rawValue === "string" ? hasShape(shape(spec.rawValue)) : relevantList(spec.rawValue, spec.rule))));
  if (!candidates.length) return { status: "no_aplicable", reason: "Sin valores compuestos, condicionados o negados reconocidos" };
  const findings: NormalizationCheckFinding[] = [];
  let evaluated = 0;
  for (const spec of candidates) {
    if (spec.kind === "descartada" && spec.reasons.includes("alias_conflict")) continue;
    evaluated += 1;
    const losses = semanticLoss(spec);
    if (!losses.length) continue;
    const suffix = losses.map((loss) => loss.normalize("NFD").replace(/\p{M}/gu, "").replace(/ /gu, "-")).join("+");
    const rejected = spec.kind === "descartada" ? `; rechazo observado: ${spec.reasons.join(", ")}` : "";
    const contradicted = explicitNegation(spec) && resultOf(spec) === true;
    findings.push({ cause: `${resultOf(spec) === undefined ? "compuesto-no-interpretado" : "estructura-semantica-no-conservada"}:${suffix}`,
      specificationKey: spec.canonicalKey, stage: stage.stage, circuit: "normalizador-conservacion-semantica",
      assessment: contradicted ? "defecto_reproducible" : "hipotesis",
      applicability: "Valor reconocido con indicadores explícitos de composición o condición; contraste con el resultado real",
      reason: contradicted ? "El resultado verdadero contradice una negación explícita reconocida por el parser booleano"
        : `Posible pérdida de ${losses.join(", ")}${rejected}; no se presupone una interpretación técnica ni que el contrato admita representarla`,
      evidence: [rawEvidence(stage, spec), observed(stage, "normalizador-resultado", spec.canonicalKey, resultOf(spec))] });
  }
  return evaluated ? { status: "evaluada", findings } : { status: "no_evaluable", reason: "Valores compuestos descartados por concurrencia de alias" };
};

export const semanticStageChecks: readonly NormalizationCheck[] = [
  { id: "precedencias-alias-original", evaluate: ({ observation }) => inspectAliasPrecedence(observation.original) },
  { id: "precedencias-alias-preparacion", evaluate: ({ observation }) => inspectAliasPrecedence(observation.prepared) },
  { id: "precedencias-alias-publicacion", evaluate: ({ observation }) => observation.publication
    ? inspectAliasPrecedence(observation.publication.observation) : { status: "no_aplicable", reason: "Ficha sin publicación acreditada conciliada" } },
  { id: "conservacion-semantica-original", evaluate: ({ observation }) => inspectSemanticConservation(observation.original) },
  { id: "conservacion-semantica-preparacion", evaluate: ({ observation }) => inspectSemanticConservation(observation.prepared) },
  { id: "conservacion-semantica-publicacion", evaluate: ({ observation }) => observation.publication
    ? inspectSemanticConservation(observation.publication.observation) : { status: "no_aplicable", reason: "Ficha sin publicación acreditada conciliada" } }
];
