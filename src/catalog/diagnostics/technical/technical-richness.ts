import { fold } from "../../../preparation/classification/category-utils.js";
import { buildProductIdentity } from "../../identity.js";
import { normalizeSpecKey, normalizeSpecsObject, type NormalizedSpecValue, type DiscardReason } from "../../normalization/normalize-specs.js";
import { parseMeasuredLength } from "../../normalization/spec-parsers.js";
import { SPEC_RULES } from "../../normalization/spec-rules.js";
import { specHasValue, compare } from "../coverage/content-gaps-source.js";
import { assessQualitativeTechnicalFamily, assessEssentialTechnicalCoverage } from "../coverage/specification-family-priorities.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";
import type { SpecsMap, SpecValue } from "../../../contracts/catalog.js";

type Observation = { readonly key: string; readonly canonicalKey: string; readonly value: SpecValue;
  readonly interpreted: NonNullable<NormalizedSpecValue> | null;
  readonly reasons: readonly DiscardReason[]; readonly recognized: boolean };
type AliasCase = { readonly concept: string; readonly status: "acreditada" | "posible" | "conflicto";
  readonly fields: readonly Observation[] };

const lengthConcept = (key: string): string | null => {
  const unit = /^(.*) \((mm|m)\)$/u.exec(key);
  if (unit?.[1] && unit[2] && SPEC_RULES[key] === "number" &&
    SPEC_RULES[`${unit[1]} (${unit[2] === "m" ? "mm" : "m"})`] === "number") {
    return unit[1];
  }
  return null;
};

export const technicalConceptKey = (key: string): string => {
  const canonical = normalizeSpecKey(key);
  return lengthConcept(canonical) ?? canonical;
};

export const observeTechnicalSpecifications = (specs: SpecsMap) => {
  const groups = new Map<string, Observation[]>();
  for (const [key, value] of Object.entries(specs).sort(([a], [b]) => compare(a, b))) {
    if (!specHasValue(value)) continue;
    const canonicalKey = normalizeSpecKey(key);
    const concept = technicalConceptKey(key);
    const result = normalizeSpecsObject({ [key]: value });
    const parsed = Object.hasOwn(result.normalized, canonicalKey) ? result.normalized[canonicalKey] : null;
    const fields = groups.get(concept) ?? [];
    fields.push({ key, canonicalKey, value, interpreted: parsed ?? null,
      reasons: result.discardedSpecs.map(({ reason }) => reason), recognized: Object.hasOwn(SPEC_RULES, canonicalKey) });
    groups.set(concept, fields);
  }
  const accepted: string[] = [];
  const unresolved: Observation[] = [];
  const aliases: AliasCase[] = [];
  let count = 0;
  for (const [concept, fields] of groups) {
    const comparableValues = fields.map(({ canonicalKey, interpreted }) => lengthConcept(canonicalKey) !== null
      ? parseMeasuredLength(interpreted, canonicalKey, "mm") : interpreted);
    const values = new Set(comparableValues.flatMap((value) => value === null ? [] : [JSON.stringify(value)]));
    const complete = comparableValues.every((value) => value !== null);
    if (complete && values.size === 1) {
      count++;
      accepted.push(...new Set(fields.map(({ canonicalKey }) => canonicalKey)));
      if (fields.length > 1) aliases.push({ concept, status: "acreditada", fields });
    } else {
      unresolved.push(...fields);
      if (fields.length > 1) aliases.push({ concept, status: values.size > 1 ? "conflicto" : "posible", fields });
    }
  }
  return { count, accepted: accepted.sort(compare), unresolved, aliases };
};

const percentile = (sorted: readonly number[], proportion: number): number | null => {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * proportion;
  const lower = sorted[Math.floor(index)]!;
  const upper = sorted[Math.ceil(index)]!;
  return lower + (upper - lower) * (index % 1);
};

const distribution = (counts: readonly number[]) => {
  const sorted = [...counts].sort((a, b) => a - b);
  const p25 = percentile(sorted, 0.25);
  const p50 = percentile(sorted, 0.5);
  const p75 = percentile(sorted, 0.75);
  return { products: sorted.length, p25, p50, p75,
    low: p25 === null ? 0 : sorted.filter((count) => count < p25).length,
    medium: p25 === null || p75 === null ? 0 : sorted.filter((count) => count >= p25 && count <= p75).length,
    high: p75 === null ? 0 : sorted.filter((count) => count > p75).length };
};

export const isRichnessTechnicalKey = (key: string, isTechnicalKey: (key: string) => boolean): boolean =>
  isTechnicalKey(key) && isTechnicalKey(normalizeSpecKey(key)) && !["nueva o usada", "maquina"].includes(fold(key));

export const analyzeTechnicalRichness = (products: readonly ImportCandidate[], isTechnicalKey: (key: string) => boolean) => {
  const cases = products.map((product) => {
    const specs = Object.fromEntries(Object.entries(product.spec).filter(([key]) =>
      isRichnessTechnicalKey(key, isTechnicalKey)));
    const { count, accepted, unresolved, aliases } = observeTechnicalSpecifications(specs);
    const family = assessQualitativeTechnicalFamily(product);
    const essentials = family.family ? assessEssentialTechnicalCoverage(family.family, accepted,
      unresolved.map(({ canonicalKey }) => canonicalKey)) : [];
    return { identity: buildProductIdentity({ providerId: product.providerId, reference: product.reference,
      serialNumber: null, url: product.sourceUrl }).key, providerId: product.providerId, reference: product.reference,
      url: product.sourceUrl, family: family.name, familyStatus: family.status,
      interpretedConcepts: count, interpretedKeys: accepted, unresolved, aliases, essentials };
  }).sort((a, b) => compare(a.identity, b.identity));
  const groups = new Map<string, typeof cases>();
  for (const item of cases) {
    const key = item.family ?? item.familyStatus;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const families = [...groups].sort(([a], [b]) => compare(a, b)).map(([name, items]) => {
    const essentials = new Map<string, { label: string; priority: "P1" | "P2"; observed: number; notObserved: number; notEvaluable: number }>();
    for (const item of items) for (const field of item.essentials) {
      const totals = essentials.get(field.key) ?? { label: field.label, priority: field.priority, observed: 0, notObserved: 0, notEvaluable: 0 };
      if (field.status === "observada") totals.observed++;
      else if (field.status === "no_observada") totals.notObserved++;
      else totals.notEvaluable++;
      essentials.set(field.key, totals);
    }
    return { name, ...distribution(items.map((item) => item.interpretedConcepts)),
      essentials: [...essentials].sort(([a], [b]) => compare(a, b)).map(([key, totals]) => ({ key, ...totals })) };
  });
  const essentialPriorities = families.flatMap((family) => family.essentials.filter((field) => field.notObserved > 0)
    .map((field) => ({ family: family.name, ...field })))
    .sort((a, b) => compare(a.priority, b.priority) || b.notObserved - a.notObserved || compare(a.family, b.family) || compare(a.key, b.key));
  return { note: "Riqueza de conceptos interpretables por el normalizador, no garantía de veracidad ni censo exhaustivo de hechos. Solo se fusionan alias concordantes de una misma regla o representaciones métricas m/mm del mismo concepto canónico. Configuraciones, rangos y magnitudes diferentes se conservan; equivalencias no demostradas quedan separadas. La distribución es relativa a cada cohorte (por debajo de P25, entre P25 y P75 inclusive, por encima de P75), no un umbral de calidad ni bloqueo. La cobertura esencial observa declaraciones, no acredita aplicabilidad a cada variante. Las familias reconocidas sin criterio esencial se distinguen de las desconocidas y contradictorias.",
    totals: { ...distribution(cases.map((item) => item.interpretedConcepts)),
      withoutFamilyCriteria: cases.filter((item) => item.familyStatus === "sin_criterio").length,
      unknownFamily: cases.filter((item) => item.familyStatus === "desconocida").length,
      conflictingFamily: cases.filter((item) => item.familyStatus === "contradictoria").length,
      essentialUnobservedProducts: cases.filter((item) => item.essentials.some((field) => field.status === "no_observada")).length,
      essentialNotEvaluableProducts: cases.filter((item) => item.essentials.some((field) => field.status === "no_evaluable")).length,
      unresolvedProducts: cases.filter((item) => item.unresolved.length > 0).length,
      accreditedRedundancyProducts: cases.filter((item) => item.aliases.some((alias) => alias.status === "acreditada")).length,
      possibleRedundancyProducts: cases.filter((item) => item.aliases.some((alias) => alias.status === "posible")).length,
      conflictingAliasProducts: cases.filter((item) => item.aliases.some((alias) => alias.status === "conflicto")).length },
    families, essentialPriorities, cases };
};
