import type { NormalizationSerializationOutcomes } from "./normalization-serialization.js";
import type { ImportCatalog } from "../../../commercial/legacy-export/contracts.js";
import type { ProductTechnicalProvenance } from "../../../contracts/technical-provenance.js";
import type { ProductRecord, SpecValue } from "../../../contracts/catalog.js";
import type { PreparedProduct } from "../../../preparation/contracts.js";
import type { NormalizedSpecValue } from "../../normalization/normalize-specs.js";
import type { NormalizationAssessment, NormalizationAuditStage, NormalizationProductObservation } from "./normalization-audit.js";
import { normalizationScopeOf, type NormalizationPatternScope } from "./normalization-patterns.js";

export type NormalizationCheckContext = {
  readonly observation: NormalizationProductObservation;
  readonly source: ProductRecord;
  readonly prepared: PreparedProduct;
  readonly published: PreparedProduct["product"] | null;
  readonly publishedProvenance?: ProductTechnicalProvenance | null;
  readonly publicationProvenanceError?: string;
  readonly commercial?: { readonly catalog: ImportCatalog; readonly mapped: PreparedProduct; readonly catalogSha256: string };
  readonly commercialError?: string;
  readonly serialization?: NormalizationSerializationOutcomes;
  readonly serializationError?: string;
};

export type NormalizationCheckAssessment = Exclude<NormalizationAssessment, "observacion_acreditada"> |
  "defecto_reproducible" | "no_aplicable";

export type NormalizationCheckEvidence = {
  readonly stage: NormalizationAuditStage;
  readonly circuit: string;
  readonly field: string;
} & ({ readonly present: true; readonly value: SpecValue | NormalizedSpecValue } | { readonly present: false });

export type NormalizationCheckFinding = {
  readonly cause: string;
  readonly specificationKey: string | null;
  readonly stage: NormalizationAuditStage;
  readonly circuit: string;
  readonly assessment: NormalizationCheckAssessment;
  readonly applicability: string;
  readonly reason: string;
  readonly evidence: readonly [NormalizationCheckEvidence, ...NormalizationCheckEvidence[]];
};

export type NormalizationCheckOutcome =
  | { readonly status: "evaluada"; readonly findings: readonly NormalizationCheckFinding[] }
  | { readonly status: "no_aplicable" | "no_evaluable"; readonly reason: string };

export type NormalizationCheck = {
  readonly id: string;
  readonly evaluate: (context: NormalizationCheckContext) => NormalizationCheckOutcome;
};

type CoverageReason = { readonly status: "no_aplicable" | "no_evaluable" | "error"; readonly reason: string; readonly count: number };
type Coverage = {
  readonly population: number;
  readonly eligible: number;
  readonly evaluated: number;
  readonly excluded: number;
  readonly notEvaluable: number;
  readonly errors: number;
  readonly reasons: readonly CoverageReason[];
};

type Occurrence = NormalizationCheckFinding & Pick<NormalizationProductObservation,
  "identity" | "providerId" | "reference" | "sourceUrl" | "originalRecordSha256"> & {
  readonly publicationSha256: string | null;
  readonly check: string;
  readonly scope: NormalizationPatternScope;
};

type ProviderCheckResult = { readonly check: string; readonly providerId: string; readonly coverage: Coverage;
  readonly occurrences: readonly Occurrence[] };

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const occurrenceKey = (occurrence: Occurrence): string => JSON.stringify(occurrence, (_key: string, value: unknown) =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => compare(a, b))) : value);
const emptyCoverage = () => ({ population: 0, eligible: 0, evaluated: 0, excluded: 0, notEvaluable: 0, errors: 0 });
const tallyReason = (reasons: Map<string, CoverageReason>, status: CoverageReason["status"], reason: string, count = 1): void => {
  const key = JSON.stringify([status, reason]);
  reasons.set(key, { status, reason, count: (reasons.get(key)?.count ?? 0) + count });
};
const orderedReasons = (reasons: Map<string, CoverageReason>): readonly CoverageReason[] =>
  [...reasons.entries()].sort(([a], [b]) => compare(a, b)).map(([, reason]) => reason);

const checkIds = (checks: readonly NormalizationCheck[]): readonly string[] => {
  const ids = checks.map(({ id }) => id);
  if (ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length) throw new Error("Comprobaciones de normalización sin identidad única");
  return ids;
};

export const evaluateNormalizationChecks = (checks: readonly NormalizationCheck[], providerId: string,
  contexts: readonly NormalizationCheckContext[]): readonly ProviderCheckResult[] => {
  checkIds(checks);
  const identities = new Set<string>();
  for (const { observation } of contexts) {
    if (observation.providerId !== providerId || identities.has(observation.identity)) {
      throw new Error(`Población de comprobaciones de normalización incoherente: ${observation.identity}`);
    }
    identities.add(observation.identity);
  }
  return checks.map((check) => {
    const coverage = emptyCoverage();
    const reasons = new Map<string, CoverageReason>();
    const occurrences: Occurrence[] = [];
    for (const context of contexts) {
      coverage.population += 1;
      let outcome: NormalizationCheckOutcome;
      try { outcome = check.evaluate(context); }
      catch (error) {
        coverage.errors += 1;
        tallyReason(reasons, "error", error instanceof Error ? error.message : String(error));
        continue;
      }
      if (outcome.status === "no_aplicable") coverage.excluded += 1;
      else {
        coverage.eligible += 1;
        if (outcome.status === "no_evaluable") coverage.notEvaluable += 1;
      }
      if (outcome.status !== "evaluada") {
        tallyReason(reasons, outcome.status, outcome.reason);
        continue;
      }
      coverage.evaluated += 1;
      const { identity, reference, sourceUrl, originalRecordSha256, publication } = context.observation;
      const scope = normalizationScopeOf(context.observation);
      for (const finding of outcome.findings) occurrences.push({ ...finding, identity, providerId, reference, sourceUrl,
        originalRecordSha256, publicationSha256: publication?.sha256 ?? null, check: check.id, scope });
    }
    return { check: check.id, providerId, coverage: { ...coverage, reasons: orderedReasons(reasons) }, occurrences };
  });
};

const combinedCoverage = (results: readonly ProviderCheckResult[]): Coverage => {
  const total = emptyCoverage();
  const reasons = new Map<string, CoverageReason>();
  for (const { coverage } of results) {
    total.population += coverage.population;
    total.eligible += coverage.eligible;
    total.evaluated += coverage.evaluated;
    total.excluded += coverage.excluded;
    total.notEvaluable += coverage.notEvaluable;
    total.errors += coverage.errors;
    for (const item of coverage.reasons) tallyReason(reasons, item.status, item.reason, item.count);
  }
  return { ...total, reasons: orderedReasons(reasons) };
};

const impactOf = (occurrences: readonly Occurrence[]) => ({
  uniqueProducts: new Set(occurrences.map(({ identity }) => identity)).size,
  uniqueSpecifications: new Set(occurrences.flatMap(({ identity, specificationKey }) =>
    specificationKey === null ? [] : [JSON.stringify([identity, specificationKey])])).size,
  occurrences: occurrences.length,
  unresolvedSpecificationOccurrences: occurrences.filter(({ specificationKey }) => specificationKey === null).length
});

const groupDescriptor = ({ check, cause, specificationKey, scope, stage, circuit, assessment }: Occurrence) =>
  ({ check, cause, specificationKey, scope, stage, circuit, assessment });

const groupOccurrences = (occurrences: readonly Occurrence[]) => {
  const groups = new Map<string, { descriptor: ReturnType<typeof groupDescriptor>; indices: number[] }>();
  occurrences.forEach((occurrence, index) => {
    const descriptor = groupDescriptor(occurrence);
    const key = JSON.stringify(descriptor);
    const group = groups.get(key) ?? { descriptor, indices: [] };
    group.indices.push(index);
    groups.set(key, group);
  });
  return [...groups.entries()].sort(([a], [b]) => compare(a, b)).map(([, { descriptor, indices }]) => {
    const members = indices.flatMap((index) => {
      const occurrence = occurrences[index];
      return occurrence ? [occurrence] : [];
    });
    const providers = [...new Set(members.map(({ providerId }) => providerId))].sort(compare);
    return { ...descriptor, occurrenceIndices: indices, impact: impactOf(members),
      byProvider: providers.map((providerId) => ({ providerId, ...impactOf(members.filter((item) => item.providerId === providerId)) })) };
  });
};

export const summarizeNormalizationChecks = (checks: readonly NormalizationCheck[], expectedProviders: readonly string[],
  results: readonly ProviderCheckResult[]) => {
  const ids = checkIds(checks);
  const unique = new Map<string, Occurrence>();
  for (const result of results) for (const occurrence of result.occurrences) unique.set(occurrenceKey(occurrence), occurrence);
  const occurrences = [...unique.entries()].sort(([a], [b]) => compare(a, b)).map(([, occurrence]) => occurrence);
  const coverage = ids.map((check) => {
    const members = results.filter((result) => result.check === check).sort((a, b) => compare(a.providerId, b.providerId));
    return { check, ...combinedCoverage(members), missingProviders: expectedProviders.filter((providerId) =>
      !members.some((member) => member.providerId === providerId)),
      byProvider: members.map(({ providerId, coverage }) => ({ providerId, ...coverage })) };
  });
  const groups = groupOccurrences(occurrences);
  const candidates = occurrences.filter(({ assessment }) => assessment === "defecto_reproducible" || assessment === "hipotesis");
  return { coverageUnit: "ficha" as const, checks: coverage, occurrences, groups,
    impact: impactOf(occurrences), potential: impactOf(candidates),
    groupMemberships: groups.reduce((count, group) => count + group.occurrenceIndices.length, 0),
    byAssessment: {
      defecto_reproducible: impactOf(occurrences.filter(({ assessment }) => assessment === "defecto_reproducible")),
      hipotesis: impactOf(occurrences.filter(({ assessment }) => assessment === "hipotesis")),
      diferencia_legitima: impactOf(occurrences.filter(({ assessment }) => assessment === "diferencia_legitima")),
      no_evaluable: impactOf(occurrences.filter(({ assessment }) => assessment === "no_evaluable")),
      no_aplicable: impactOf(occurrences.filter(({ assessment }) => assessment === "no_aplicable"))
    },
    failures: coverage.flatMap(({ check, byProvider }) => byProvider.flatMap(({ providerId, reasons }) =>
      reasons.filter(({ status }) => status === "error").map(({ reason, count }) => ({ check, providerId, reason, count })))) };
};
