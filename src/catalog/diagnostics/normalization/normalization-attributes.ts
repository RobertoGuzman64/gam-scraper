import type { ImportCatalog, ImportCandidate } from "../../../commercial/legacy-export/contracts.js";
import { decideCommercialCategory } from "../../../commercial/projection/category-decision.js";
import { isValidCommercialCategory } from "../../../commercial/projection/category-projection.js";
import { projectCommercialAttributes } from "../../../commercial/projection/attribute-projection.js";
import type { ProductRecord, SpecsMap, SpecValue } from "../../../contracts/catalog.js";
import type { AttributeResolution } from "../../../preparation/classification/attribute-types.js";
import { resolveAttribute } from "../../../preparation/classification/attribute-mapping.js";
import { validateCommercialAttributeValue } from "../../../preparation/classification/attribute-value-validation.js";
import { classificationProvider } from "../../../preparation/classification/classification-provider.js";
import { fold, scalar } from "../../../preparation/classification/attribute-utils.js";
import { recoveredUnitAttributeSpecs } from "../../../preparation/provenance/technical-provenance.js";
import { reviewedModelAttributeSpecs, reviewedModelEditorialSpecs } from "../../../preparation/technical/evidence/documented-technical-evidence.js";
import type { NormalizationSpecObservation } from "./normalization-audit.js";
import { canonicalNormalizationUnit } from "./normalization-dimensional.js";
import { inspectSemanticConservation } from "./normalization-semantic.js";
import type { NormalizationCheck, NormalizationCheckContext, NormalizationCheckEvidence, NormalizationCheckFinding, NormalizationCheckOutcome } from "./normalization-checks.js";

type Attribute = ImportCatalog["attributes"][number];
type Assignment = ImportCandidate["attributes"][number];
type Interpreted = Extract<NormalizationSpecObservation, { kind: "interpretada" }>;
type Resolution = Extract<AttributeResolution, { status: "resolved" }>;
type Evidence = NormalizationCheckEvidence;

const without = (specs: SpecsMap, key: string): SpecsMap => Object.fromEntries(Object.entries(specs).filter(([field]) => field !== key));
const validated = (attribute: Attribute, resolution: AttributeResolution): resolution is Resolution =>
  resolution.status === "resolved" && validateCommercialAttributeValue(attribute, resolution.value) === null;
const scalarResult = (spec: Interpreted, attribute: Attribute): SpecValue | undefined => {
  const normalized = spec.normalizedValue;
  const value: unknown = Array.isArray(normalized) && normalized.length === 1 ? normalized[0] : normalized;
  if (typeof value === "number") {
    const unit = canonicalNormalizationUnit(spec.canonicalKey);
    if (!unit) return attribute.unit_option.trim() === "" ? value : undefined;
    return spec.canonicalKey.endsWith(`(${unit})`) ? value : `${value} ${unit}`;
  }
  return typeof value === "string" || typeof value === "boolean" ? value : undefined;
};
const equalValue = (attribute: Attribute, a: Assignment["value"] | undefined, b: Assignment["value"]): boolean =>
  a === b || attribute.type === "SELECT" && typeof a === "string" && typeof b === "string" && fold(a) === fold(b);
const same = (attribute: Attribute, a: AttributeResolution, b: Resolution): boolean =>
  a.status === "resolved" && equalValue(attribute, a.value, b.value);
const safe = (stage: "original" | "preparacion", spec: NormalizationSpecObservation): spec is Interpreted => {
  if (spec.kind !== "interpretada" || Array.isArray(spec.rawValue) && spec.rawValue.length !== 1) return false;
  const semantic = inspectSemanticConservation({ stage, specifications: [spec] });
  return semantic.status !== "no_evaluable" && !(semantic.status === "evaluada" && semantic.findings.length);
};
const evidence = (stage: Evidence["stage"], circuit: string, field: string, value: SpecValue | undefined): Evidence =>
  value === undefined ? { stage, circuit, field, present: false } : { stage, circuit, field, present: true, value };
const attributeField = (attribute: Attribute): string => `${attribute.id}:${attribute.name}`;
const rawEvidence = (stage: "original" | "preparacion", spec: Interpreted): readonly Evidence[] => [
  evidence(stage, "prestacion-acreditada", spec.rawKey, spec.rawValue),
  { stage, circuit: "normalizador-resultado", field: spec.canonicalKey, present: true, value: spec.normalizedValue }
];

type Comparable = {
  readonly attribute: Attribute;
  readonly direct: AttributeResolution;
  readonly actual: Assignment | undefined;
  readonly actualEvidence: readonly Evidence[];
};

type Opportunity = { readonly spec: Interpreted; readonly stage: "original" | "preparacion"; readonly resolution: Resolution;
  readonly circuit: string; readonly extra: readonly Evidence[] };

const finding = (context: NormalizationCheckContext, item: Comparable, opportunity: Opportunity): NormalizationCheckFinding => ({
  stage: opportunity.stage, circuit: opportunity.circuit,
  specificationKey: opportunity.spec.canonicalKey, assessment: "hipotesis",
  cause: item.actual === undefined ? `atributo-representable-no-asignado:${item.attribute.id}` : `atributo-valor-divergente:${item.attribute.id}`,
  applicability: "Categoría comercial válida, relación activa y valor aceptado por el contrato; comparación diagnóstica con la proyección comercial actual sobre publicación acreditada, no histórica",
  reason: item.actual === undefined ? "El mapeador admite la prestación por este recorrido, pero la proyección comercial actual no asigna el atributo; revisar precedencias y alcance"
    : "La prestación es representable mediante el mapeador, pero el valor difiere de la proyección comercial actual; una reconciliación legítima puede explicarlo y no se acredita qué interpretación debe prevalecer",
  evidence: [evidence(opportunity.stage, "resolucion-atributo", attributeField(item.attribute), opportunity.resolution.value),
    ...item.actualEvidence, ...rawEvidence(opportunity.stage, opportunity.spec),
    ...context.observation.prepared.specifications.filter((spec) => spec.canonicalKey === opportunity.spec.canonicalKey)
      .map((spec) => evidence("preparacion", "prestacion-preparada-actual", spec.rawKey, spec.rawValue)),
    ...opportunity.extra]
});

const directOpportunity = (source: ProductRecord, specs: readonly Interpreted[], item: Comparable): Opportunity | null => {
  if (!validated(item.attribute, item.direct)) return null;
  const resolution = item.direct;
  const contributing = specs.filter((spec) => !same(item.attribute,
    resolveAttribute({ ...source, specs: without(source.specs ?? {}, spec.rawKey) }, item.attribute), resolution) &&
    same(item.attribute, resolveAttribute({ ...source, specs: { [spec.rawKey]: spec.rawValue } }, item.attribute), resolution));
  const spec = contributing.length === 1 ? contributing[0] : undefined;
  if (!spec) return null;
  return { spec, stage: "original", resolution, circuit: "atributo-original-proyeccion", extra: [] };
};

const normalizedOpportunities = (source: ProductRecord, specs: readonly Interpreted[], item: Comparable): readonly Opportunity[] => {
  if (item.direct.status === "rejected" || item.direct.status === "contradiction") return [];
  const original = source.specs ?? {};
  const rules = classificationProvider(source)?.attribute;
  if (rules?.suppress(source, item.attribute)) return [];
  const result: Opportunity[] = [];
  for (const spec of specs) {
    const raw = scalar(spec.rawValue);
    if (raw === null || rules?.excludeSpec(source, item.attribute, spec.rawKey) || rules?.unmeasured(source, item.attribute, raw) ||
      specs.filter(({ canonicalKey }) => canonicalKey === spec.canonicalKey).length !== 1) continue;
    const value = scalarResult(spec, item.attribute);
    if (value === undefined || spec.rawKey !== spec.canonicalKey && Object.hasOwn(original, spec.canonicalKey) ||
      spec.rawKey === spec.canonicalKey && value === spec.rawValue) continue;
    const remaining = without(original, spec.rawKey);
    const projected = { ...source, specs: { ...remaining, [spec.canonicalKey]: value } };
    const resolution = resolveAttribute(projected, item.attribute);
    if (!validated(item.attribute, resolution) || same(item.attribute, item.direct, resolution) ||
      same(item.attribute, resolveAttribute({ ...source, specs: remaining }, item.attribute), resolution) ||
      !same(item.attribute, resolveAttribute({ ...source, specs: { [spec.canonicalKey]: value } }, item.attribute), resolution)) continue;
    result.push({ spec, stage: "original", resolution, circuit: "atributo-normalizado-contraste-aislado", extra: [
      evidence("original", "entrada-normalizada-mapeador", spec.canonicalKey, value),
      evidence("original", "resolucion-original-mapeador", attributeField(item.attribute), item.direct.status === "resolved" ? item.direct.value : undefined),
      evidence("original", "estado-resolucion-original", attributeField(item.attribute), item.direct.status)
    ] });
  }
  return result;
};

const recoveredInputs = ({ source, observation, prepared }: NormalizationCheckContext) => {
  const provenance = prepared.technicalProvenance;
  if (!provenance || provenance.originalRecordSha256 !== observation.originalRecordSha256) return null;
  const model = reviewedModelAttributeSpecs(source, provenance, reviewedModelEditorialSpecs(source, provenance));
  const unit = recoveredUnitAttributeSpecs(source, provenance);
  return Object.keys(model).length || Object.keys(unit).length ? { provenance, model, unit } : null;
};
const recoveredOpportunity = (source: ProductRecord, recovery: ReturnType<typeof recoveredInputs>, item: Comparable,
  specs: readonly Interpreted[]): Opportunity | null => {
  if (!recovery || item.direct.status !== "not_observed") return null;
  const { provenance, model, unit } = recovery;
  const resolution = resolveAttribute(source, item.attribute, model, unit);
  if (!validated(item.attribute, resolution)) return null;
  const candidates = ([{ scope: "modelo", values: model }, { scope: "unidad", values: unit }] as const).flatMap(({ scope, values }) =>
    Object.entries(values).flatMap(([key, value]) => {
      const reduced = scope === "modelo" ? resolveAttribute(source, item.attribute, without(model, key), unit)
        : resolveAttribute(source, item.attribute, model, without(unit, key));
      if (same(item.attribute, reduced, resolution)) return [];
      const traces = provenance.entries.filter((entry) => entry.field === key && entry.value === value &&
        (scope === "modelo" ? entry.scope === "model-document" : entry.scope === "unit"));
      const destinations = specs.filter((spec) => spec.canonicalKey === key && spec.rawValue === value);
      const trace = traces.length === 1 ? traces[0] : undefined;
      const spec = destinations.length === 1 ? destinations[0] : undefined;
      return trace && spec ? [{ scope, trace, spec }] : [];
    }));
  const candidate = candidates.length === 1 ? candidates[0] : undefined;
  return candidate ? { spec: candidate.spec, stage: "preparacion", resolution, circuit: `atributo-recuperacion-${candidate.scope}-proyeccion`, extra: [
    evidence("preparacion", "procedencia-recuperacion", candidate.trace.field, JSON.stringify(candidate.trace))
  ] } : null;
};

export const inspectAttributeOpportunities = (context: NormalizationCheckContext): NormalizationCheckOutcome => {
  const { source, observation, published, commercial, commercialError } = context;
  if (!published || !observation.publication) return { status: "no_aplicable", reason: "Sin publicación acreditada para la proyección comercial" };
  if (commercialError) throw new Error(commercialError);
  if (!commercial) return { status: "no_evaluable", reason: "Sin proyección o metadatos comerciales disponibles" };
  const { catalog, mapped, catalogSha256 } = commercial;
  const proposed = mapped.product;
  if (proposed.providerId !== source.providerId || proposed.sourceUrl !== source.url || proposed.reference !== source.reference ||
    published.providerId !== source.providerId || published.sourceUrl !== source.url || published.reference !== source.reference) {
    return { status: "no_evaluable", reason: "Identidad comercial no conciliada con la ficha" };
  }
  const decision = decideCommercialCategory(source, proposed.categorySellID);
  if (decision.status === "excluded") return { status: "no_aplicable", reason: `Exclusión comercial: ${decision.reason}` };
  if (decision.status !== "proposed") return { status: "no_evaluable", reason: "Sin categoría comercial propuesta" };
  if (!isValidCommercialCategory(source, decision.categorySellID, proposed.condition, catalog)) {
    return { status: "no_evaluable", reason: "Categoría comercial no acreditada por el contrato vigente" };
  }
  const ids = new Set(catalog.relations.filter((relation) => relation.categoryID === decision.categorySellID && relation.actived !== false).map(({ attributeID }) => attributeID));
  const attributes = catalog.attributes.filter(({ id }) => ids.has(id));
  if (!attributes.length) return { status: "no_aplicable", reason: "Sin atributos comerciales relacionados activos" };
  const projected = projectCommercialAttributes(published, proposed, catalog);
  const accepted = new Map(projected.accepted.map((assignment) => [assignment.attributeID, assignment]));
  const original = observation.original.specifications.filter((spec): spec is Interpreted => safe("original", spec));
  const preparation = observation.prepared.specifications.filter((spec): spec is Interpreted => safe("preparacion", spec));
  if (!original.length && !preparation.length) return { status: "no_evaluable", reason: "Sin prestaciones interpretadas sin pérdida semántica observada" };
  const findings: NormalizationCheckFinding[] = [];
  let evaluated = 0;
  const recovery = recoveredInputs(context);
  for (const attribute of attributes) {
    const actual = accepted.get(attribute.id);
    const direct = resolveAttribute(source, attribute);
    const field = attributeField(attribute);
    const item: Comparable = { attribute, direct, actual, actualEvidence: [
      evidence("publicacion", "proyeccion-comercial-actual", field, actual?.value),
      evidence("publicacion", "mapeo-comercial-actual", field, proposed.attributes.find(({ attributeID }) => attributeID === attribute.id)?.value),
      evidence("publicacion", "contrato-comercial-actual", field, JSON.stringify({ categoryID: decision.categorySellID, type: attribute.type, unit: attribute.unit_option, catalogSha256 })),
      ...projected.issues.filter(({ attributeID }) => attributeID === attribute.id).map((issue) => evidence("publicacion", `rechazo-comercial:${issue.reason}`, field, issue.value))
    ] };
    const sourceOpportunity = directOpportunity(source, original, item);
    const recovered = recoveredOpportunity(source, recovery, item, preparation);
    const opportunities = [sourceOpportunity, ...normalizedOpportunities(source, original, item), recovered];
    for (const opportunity of opportunities) {
      if (!opportunity) continue;
      evaluated += 1;
      if (!equalValue(attribute, actual?.value, opportunity.resolution.value)) findings.push(finding(context, item, opportunity));
    }
  }
  return evaluated ? { status: "evaluada", findings } : { status: "no_evaluable", reason: "Sin prestación interpretada y atribuible a un valor comercial representable por los recorridos comprobados" };
};

export const normalizationAttributeChecks: readonly NormalizationCheck[] = [
  { id: "aprovechamiento-atributos-comerciales", evaluate: inspectAttributeOpportunities }
];
