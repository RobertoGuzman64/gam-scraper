import type { SpecsMap, SpecValue } from "../../../contracts/catalog.js";
import { basketDimensions, numberToken } from "../../../preparation/classification/attribute-utils.js";
import { normalizeOriginalTechnicalPresentation, normalizeTechnicalPresentation } from "../../../preparation/technical/technical-presentation.js";
import { normalizeSpecKey, type NormalizedSpecValue } from "../../normalization/normalize-specs.js";
import { canonicalNumericUnit } from "../../normalization/spec-parsers.js";
import { SPEC_ELECTRICAL_UNITS, SPEC_LENGTH_UNITS, SPEC_MASS_UNITS, SPEC_ROTATION_UNITS, SPEC_VOLUME_UNITS } from "../../normalization/spec-rules.js";
import type { NormalizationSpecObservation, NormalizationStageObservation } from "./normalization-audit.js";
import type { NormalizationCheck, NormalizationCheckEvidence, NormalizationCheckFinding, NormalizationCheckOutcome } from "./normalization-checks.js";

type MeasuredSpec = Extract<NormalizationSpecObservation, { kind: "interpretada" }>;
type Measure = { readonly value: number; readonly unit: string; readonly ambiguous: boolean; readonly mapperValue: number | null };
const lengthExponent: Readonly<Partial<Record<string, number>>> = { mm: -3, cm: -2, m: 0 };
const unitOf = (unit: string): string | null => unit.trim().toLowerCase() === "cm" ? "cm" : canonicalNumericUnit(unit);
const declaredUnit = (key: string): string | null => unitOf(key.match(/\(([^()]+)\)\s*$/u)?.[1] ?? "");
export const canonicalNormalizationUnit = (key: string): string | null => declaredUnit(key) ?? unitOf(SPEC_LENGTH_UNITS[key] ?? SPEC_MASS_UNITS[key] ??
  SPEC_VOLUME_UNITS[key] ?? SPEC_ROTATION_UNITS[key] ?? SPEC_ELECTRICAL_UNITS[key] ?? "");
const compatible = (a: string, b: string): boolean => a === b || (lengthExponent[a] !== undefined && lengthExponent[b] !== undefined);

const readMeasure = (key: string, raw: SpecValue): Measure | null => {
  const keyUnit = declaredUnit(key);
  if (typeof raw === "number") return keyUnit && Number.isFinite(raw) && raw >= 0
    ? { value: raw, unit: keyUnit, ambiguous: false, mapperValue: raw } : null;
  if (typeof raw !== "string") return null;
  const match = /^(\d+(?:[.,]\d+)?)(?:\s*(\D.+|\D))?$/u.exec(raw.trim());
  if (!match?.[1]) return null;
  const explicit = match[2] ? unitOf(match[2]) : null;
  if (match[2] && !explicit || keyUnit && explicit && keyUnit !== explicit) return null;
  const unit = explicit ?? keyUnit;
  if (!unit) return null;
  const literal = match[1];
  const value = Number(literal.replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return { value, unit, ambiguous: /^[1-9]\d{0,2}[.,]\d{3}$/u.test(literal), mapperValue: numberToken(literal) };
};

const decimalIdentity = (value: number, exponent: number): string => {
  const [mantissa = "", scientific = "0"] = String(value).split("e");
  const [whole = "", fraction = ""] = mantissa.split(".");
  const digits = `${whole}${fraction}`.replace(/^0+/u, "");
  if (!digits) return "0";
  const significant = digits.replace(/0+$/u, "");
  return `${significant}e${Number(scientific) + exponent - fraction.length + digits.length - significant.length}`;
};

const equalMagnitude = (a: number, aUnit: string, b: number, bUnit: string): boolean => compatible(aUnit, bUnit) &&
  decimalIdentity(a, lengthExponent[aUnit] ?? 0) === decimalIdentity(b, lengthExponent[bUnit] ?? 0);

const numericResult = (value: NormalizedSpecValue): number | null => {
  const single: unknown = Array.isArray(value) && value.length === 1 ? value[0] : value;
  return typeof single === "number" && Number.isFinite(single) ? single : null;
};

const finding = (stage: NormalizationStageObservation, spec: MeasuredSpec, circuit: string,
  cause: string, assessment: NormalizationCheckFinding["assessment"], reason: string,
  observed: NormalizationCheckEvidence, extra: readonly NormalizationCheckEvidence[] = []): NormalizationCheckFinding => ({
  stage: stage.stage, specificationKey: spec.canonicalKey, circuit, cause, assessment, reason,
  applicability: "Prestación interpretada, magnitud comparable y unidad explícita en el valor o la clave; sin inferir unidades de origen",
  evidence: [{ stage: stage.stage, circuit: "entrada-observada", field: spec.rawKey, present: true, value: spec.rawValue },
    observed, ...extra]
});

const normalizerEvidence = (stage: NormalizationStageObservation, spec: MeasuredSpec): NormalizationCheckEvidence =>
  ({ stage: stage.stage, circuit: "normalizador-resultado", field: spec.canonicalKey, present: true, value: spec.normalizedValue });

const compareScalar = (stage: NormalizationStageObservation, spec: MeasuredSpec): readonly NormalizationCheckFinding[] | null => {
  const input = readMeasure(spec.rawKey, spec.rawValue);
  const unit = canonicalNormalizationUnit(spec.canonicalKey);
  const output = numericResult(spec.normalizedValue);
  if (!input || !unit || output === null || !compatible(input.unit, unit)) return null;
  const circuit = "normalizador-magnitud";
  const observed = normalizerEvidence(stage, spec);
  if (input.ambiguous) {
    if (input.mapperValue === null || equalMagnitude(input.mapperValue, input.unit, output, unit)) return null;
    return [finding(stage, spec, circuit, "separador-numerico-ambiguo", "hipotesis",
      "El normalizador y la lectura numérica compartida por el mapeo admiten magnitudes distintas; el separador no acredita por sí solo una interpretación correcta", observed,
      [{ stage: stage.stage, circuit: "parser-numerico-mapeo", field: spec.rawKey, present: true, value: input.mapperValue }])];
  }
  const findings: NormalizationCheckFinding[] = [];
  if (!equalMagnitude(input.value, input.unit, output, unit)) findings.push(finding(stage, spec, circuit,
    "magnitud-normalizada-incompatible", "defecto_reproducible", `La magnitud explícita en ${input.unit} no equivale al resultado en ${unit}`, observed));
  if (input.mapperValue !== null && !equalMagnitude(input.value, input.unit, input.mapperValue, input.unit)) findings.push(finding(stage, spec,
    "parser-numerico-mapeo", "magnitud-parser-mapeo-incompatible", "defecto_reproducible",
    "La lectura numérica compartida por el mapeo altera una magnitud explícita no ambigua; no acredita un atributo comercial incorrecto",
    { stage: stage.stage, circuit: "parser-numerico-mapeo", field: spec.rawKey, present: true, value: input.mapperValue }, [observed]));
  return findings;
};

const explicitAxes = (key: string, raw: SpecValue): readonly Measure[] | null => {
  if (typeof raw !== "string") return null;
  const parts = raw.trim().split(/\s*[x×]\s*/iu);
  if (parts.length < 2 || parts.length > 3) return null;
  const last = readMeasure("", parts[parts.length - 1] ?? "");
  const units = parts.map((part) => readMeasure("", part));
  if (!last || units.slice(0, -1).some((unit) => unit !== null) && units.some((unit) => unit === null)) return null;
  const axes = parts.map((part, index) => units[index] ?? readMeasure(`(${last.unit})`, part));
  if (!axes.every((axis): axis is Measure => axis !== null && !axis.ambiguous && lengthExponent[axis.unit] !== undefined)) return null;
  const declared = declaredUnit(key);
  if (declared && lengthExponent[declared] === undefined) return null;
  return axes;
};

const normalizedAxes = (value: NormalizedSpecValue): readonly number[] | null => {
  if (typeof value === "object" && value !== null && "grosor" in value && "largo" in value && "ancho" in value &&
    typeof value.largo === "number") return [value.largo, value.ancho, value.grosor].filter((axis): axis is number => typeof axis === "number");
  if (typeof value === "object" && value !== null && "ancho" in value && "largo" in value &&
    typeof value.ancho === "number" && typeof value.largo === "number" && !("grosor" in value)) return [value.ancho, value.largo];
  if (typeof value !== "string" || !/\smm$/u.test(value)) return null;
  const axes = value.replace(/\smm$/u, "").split(/\s*x\s*/u).map((part) => readMeasure("(mm)", part));
  return axes.length === 3 && axes.every((axis): axis is Measure => axis !== null && !axis.ambiguous)
    ? axes.map(({ value }) => value) : null;
};

const compareBasket = (stage: NormalizationStageObservation, spec: MeasuredSpec): readonly NormalizationCheckFinding[] | null => {
  if (typeof spec.rawValue !== "string") return null;
  const mapped = basketDimensions(spec.rawValue);
  if (!mapped) return null;
  const axes = normalizedAxes(spec.normalizedValue);
  const mappedAxes = mapped.replace(/\sm$/u, "").split(/\s*x\s*/u).map((part) => readMeasure("(m)", part));
  if (!axes || !mappedAxes.every((axis): axis is Measure => axis !== null)) return null;
  if (axes.length !== mappedAxes.length) return null;
  const observed = normalizerEvidence(stage, spec);
  const mapper: NormalizationCheckEvidence = { stage: stage.stage, circuit: "mapeador-dimensiones-cesta", field: spec.rawKey, present: true, value: mapped };
  if (mappedAxes.every(({ value }, index) => axes[index] !== undefined && equalMagnitude(value, "m", axes[index], "mm"))) return [];
  const rounded = mappedAxes.every(({ value }, index) => Math.round(value * 1000000) / 1000 === axes[index]);
  return [finding(stage, spec, "mapeador-dimensiones-cesta", rounded ? "precision-dimensiones-cesta" : "magnitudes-dimensiones-cesta-divergentes",
    rounded ? "diferencia_legitima" : "hipotesis", rounded ? "La representación normalizada redondea a tres decimales de milímetro, según el contrato dimensional" :
      "El normalizador y el mapeador de cesta no conservan las mismas magnitudes por eje; revisar la interpretación dimensional", observed, [mapper])];
};

const compareGeometry = (stage: NormalizationStageObservation, spec: MeasuredSpec): readonly NormalizationCheckFinding[] | null => {
  const input = explicitAxes(spec.rawKey, spec.rawValue);
  const axes = normalizedAxes(spec.normalizedValue);
  if (!input || !axes || input.length !== axes.length) return spec.rule === "dimension_rect" ? compareBasket(stage, spec) : null;
  const findings: NormalizationCheckFinding[] = [];
  const observed = normalizerEvidence(stage, spec);
  if (!input.every(({ value, unit }, index) => axes[index] !== undefined && equalMagnitude(value, unit, axes[index], "mm"))) {
    const rounded = input.every(({ value, unit }, index) => {
      const millimetres = Number(decimalIdentity(value, (lengthExponent[unit] ?? 0) + 3));
      return Math.round(millimetres * 1000) / 1000 === axes[index];
    });
    findings.push(finding(stage, spec, "normalizador-ejes", rounded ? "precision-ejes-normalizados" : "magnitud-eje-incompatible",
      rounded ? "diferencia_legitima" : "defecto_reproducible", rounded ? "Los ejes se redondean a tres decimales de milímetro según el contrato dimensional" :
        "Al menos un eje de la entrada explícita no equivale a su magnitud normalizada en milímetros", observed));
  }
  if (spec.rule === "dimension_rect") findings.push(...(compareBasket(stage, spec) ?? []));
  return findings;
};

const applicable = (spec: NormalizationSpecObservation): boolean => spec.rule === "dimension_rect" || spec.rule === "dimension" ||
  (spec.rule === "number" || spec.rule === "number_array") && canonicalNormalizationUnit(spec.canonicalKey) !== null;

export const inspectDimensionalCoherence = (stage: NormalizationStageObservation): NormalizationCheckOutcome => {
  let eligible = 0;
  let evaluated = 0;
  const findings: NormalizationCheckFinding[] = [];
  for (const spec of stage.specifications) {
    if (!applicable(spec)) continue;
    eligible += 1;
    if (spec.kind !== "interpretada") continue;
    const result = spec.rule === "dimension_rect" || spec.rule === "dimension" ? compareGeometry(stage, spec) : compareScalar(stage, spec);
    if (result === null) continue;
    evaluated += 1;
    findings.push(...result);
  }
  if (!eligible) return { status: "no_aplicable", reason: "Sin prestaciones escalares con unidad canónica ni dimensiones estructuradas" };
  return evaluated ? { status: "evaluada", findings } : { status: "no_evaluable", reason: "Sin magnitudes escalares o ejes comparables con unidades acreditadas" };
};

export const compareDimensionalPresentation = (stage: NormalizationStageObservation, presented: SpecsMap): NormalizationCheckOutcome => {
  let eligible = 0;
  let evaluated = 0;
  const findings: NormalizationCheckFinding[] = [];
  const byCanonical = new Map<string, string[]>();
  for (const key of Object.keys(presented)) {
    const canonical = normalizeSpecKey(key);
    const keys = byCanonical.get(canonical) ?? [];
    keys.push(key);
    byCanonical.set(canonical, keys);
  }
  for (const spec of stage.specifications) {
    if (!applicable(spec) || spec.rule === "dimension_rect" || spec.rule === "dimension") continue;
    eligible += 1;
    if (spec.kind !== "interpretada") continue;
    const input = readMeasure(spec.rawKey, spec.rawValue);
    if (!input || input.ambiguous) continue;
    const keys = byCanonical.get(spec.canonicalKey) ?? [];
    const key = Object.hasOwn(presented, spec.rawKey) ? spec.rawKey : keys.length === 1 ? keys[0] : undefined;
    if (key === undefined) continue;
    if (key !== spec.rawKey && stage.specifications.filter(({ canonicalKey }) => canonicalKey === spec.canonicalKey).length !== 1) continue;
    const raw = presented[key];
    if (raw === undefined) continue;
    const output = readMeasure(key, raw);
    const explicit = readMeasure("", raw);
    const targetUnit = declaredUnit(key);
    const contradictoryUnit = explicit !== null && targetUnit !== null && explicit.unit !== targetUnit;
    if (!output && !contradictoryUnit || output?.ambiguous) continue;
    evaluated += 1;
    const observed: NormalizationCheckEvidence = { stage: stage.stage, circuit: "presentacion-original-aislada", field: key, present: true, value: raw };
    if (contradictoryUnit || output && !compatible(input.unit, output.unit)) findings.push(finding(stage, spec, "presentacion-original-aislada",
      "unidad-presentada-incompatible", "defecto_reproducible", "La presentación aislada introduce una unidad incompatible con la entrada o con su propia clave", observed, [normalizerEvidence(stage, spec)]));
    else if (output && !equalMagnitude(input.value, input.unit, output.value, output.unit)) findings.push(finding(stage, spec, "presentacion-original-aislada",
      "magnitud-presentada-incompatible", "defecto_reproducible", "La función de presentación aplicada a la entrada original altera la magnitud explícita", observed, [normalizerEvidence(stage, spec)]));
  }
  if (!eligible) return { status: "no_aplicable", reason: "Sin prestaciones escalares con unidad canónica" };
  return evaluated ? { status: "evaluada", findings } : { status: "no_evaluable", reason: "Sin correspondencia dimensional unívoca en la presentación aislada" };
};

export const normalizationDimensionalChecks: readonly NormalizationCheck[] = [
  { id: "coherencia-dimensional-original", evaluate: ({ observation }) => inspectDimensionalCoherence(observation.original) },
  { id: "coherencia-dimensional-preparacion", evaluate: ({ observation }) => inspectDimensionalCoherence(observation.prepared) },
  { id: "coherencia-dimensional-publicacion", evaluate: ({ observation }) => observation.publication
    ? inspectDimensionalCoherence(observation.publication.observation) : { status: "no_aplicable", reason: "Ficha sin publicación acreditada conciliada" } },
  { id: "coherencia-presentacion-original", evaluate: ({ observation, source }) => {
    const specs = source.specs ?? {};
    return compareDimensionalPresentation(observation.original, normalizeOriginalTechnicalPresentation(normalizeTechnicalPresentation(specs), specs));
  } }
];
