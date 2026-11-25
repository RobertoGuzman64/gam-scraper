import type { NormalizationAuditStage, NormalizationProductObservation } from "./normalization-audit.js";
import { contrastNormalizationProduct, type NormalizationContrast } from "./normalization-contrast.js";
import { discoverNormalizationPatterns, type NormalizationPattern } from "./normalization-patterns.js";

export type NormalizationImpact = {
  readonly identities: readonly string[];
  readonly uniqueProducts: number;
  readonly occurrences: number;
  readonly patternMemberships: number;
};

export type NormalizationContrastSummary = Pick<NormalizationContrast, "from" | "to" | "kind" | "assessment"> & {
  readonly uniqueProducts: number;
  readonly occurrences: number;
};

type ImpactBucket = { identities: Set<string>; occurrences: Set<string>; patternMemberships: number };
const bucket = (): ImpactBucket => ({ identities: new Set(), occurrences: new Set(), patternMemberships: 0 });
const impact = (value: ImpactBucket): NormalizationImpact => ({ identities: [...value.identities].sort(),
  uniqueProducts: value.identities.size, occurrences: value.occurrences.size, patternMemberships: value.patternMemberships });
const tally = (patterns: readonly NormalizationPattern[], providerId?: string): NormalizationImpact => {
  const result = bucket();
  for (const pattern of patterns) for (const variant of pattern.variants) for (const occurrence of variant.occurrences) {
    if (providerId !== undefined && occurrence.providerId !== providerId) continue;
    result.identities.add(occurrence.identity);
    result.occurrences.add(occurrenceKey(pattern.stage, occurrence.identity, occurrence.specification.rawKey));
    result.patternMemberships += 1;
  }
  return impact(result);
};

const byStage = (patterns: readonly NormalizationPattern[]): Readonly<Record<NormalizationAuditStage, NormalizationImpact>> => ({
  original: tally(patterns.filter((pattern) => pattern.stage === "original")),
  preparacion: tally(patterns.filter((pattern) => pattern.stage === "preparacion")),
  publicacion: tally(patterns.filter((pattern) => pattern.stage === "publicacion"))
});
const byProvider = (patterns: readonly NormalizationPattern[]) => [...new Set(patterns.flatMap((pattern) =>
  pattern.variants.flatMap((variant) => variant.occurrences.map((occurrence) => occurrence.providerId))))].sort()
  .map((providerId) => ({ providerId, ...tally(patterns, providerId) }));
const occurrenceKey = (stage: NormalizationAuditStage, identity: string, rawKey: string): string =>
  JSON.stringify([stage, identity, rawKey]);

const contrastSummary = (contrasts: readonly NormalizationContrast[]): readonly NormalizationContrastSummary[] => {
  const groups = new Map<string, { descriptor: Pick<NormalizationContrast, "from" | "to" | "kind" | "assessment">;
    identities: Set<string>; occurrences: number }>();
  for (const { from, to, kind, assessment, identity } of contrasts) {
    const descriptor = { from, to, kind, assessment };
    const key = JSON.stringify(descriptor);
    const group = groups.get(key) ?? { descriptor, identities: new Set<string>(), occurrences: 0 };
    group.identities.add(identity);
    group.occurrences += 1;
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, group]) => ({
    ...group.descriptor, uniqueProducts: group.identities.size, occurrences: group.occurrences }));
};

const contrastIndex = (contrasts: readonly NormalizationContrast[]): ReadonlyMap<string, readonly NormalizationContrast[]> => {
  const index = new Map<string, NormalizationContrast[]>();
  for (const contrast of contrasts) {
    const keys = [occurrenceKey(contrast.from, contrast.identity, contrast.source.rawKey),
      ...contrast.targets.map((target) => occurrenceKey(contrast.to, contrast.identity, target.rawKey))];
    for (const key of keys) {
      const values = index.get(key) ?? [];
      values.push(contrast);
      index.set(key, values);
    }
  }
  return index;
};

const groupContrasts = (patterns: readonly NormalizationPattern[], index: ReturnType<typeof contrastIndex>) => {
  const related = new Set<NormalizationContrast>();
  for (const pattern of patterns) for (const variant of pattern.variants) for (const occurrence of variant.occurrences) {
    for (const contrast of index.get(occurrenceKey(pattern.stage, occurrence.identity, occurrence.specification.rawKey)) ?? []) {
      related.add(contrast);
    }
  }
  return contrastSummary([...related]);
};

const potential = (patterns: readonly NormalizationPattern[]): readonly NormalizationPattern[] => patterns.filter((pattern) =>
  pattern.stage !== "original" && pattern.assessment !== "no_evaluable" && pattern.assessment !== "diferencia_legitima");

export type NormalizationPatternGroup = {
  readonly kind: NormalizationPattern["kind"];
  readonly scope: NormalizationPattern["scope"];
  readonly key: string;
  readonly rule: NormalizationPattern["rule"];
  readonly signature: string | null;
  readonly patterns: readonly NormalizationPattern[];
  readonly impact: NormalizationImpact;
  readonly potential: NormalizationImpact;
  readonly byStage: ReturnType<typeof byStage>;
  readonly byProvider: ReturnType<typeof byProvider>;
  readonly contrastSummary: readonly NormalizationContrastSummary[];
};

const groupsOf = (patterns: readonly NormalizationPattern[], index: ReturnType<typeof contrastIndex>): readonly NormalizationPatternGroup[] => {
  const grouped = new Map<string, NormalizationPattern[]>();
  for (const pattern of patterns) {
    const key = JSON.stringify([pattern.kind, pattern.scope, pattern.key, pattern.rule, pattern.signature]);
    const members = grouped.get(key) ?? [];
    members.push(pattern);
    grouped.set(key, members);
  }
  return [...grouped.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, members]) => {
    const first = members[0];
    if (!first) throw new Error("Grupo de normalización vacío");
    const { kind, scope, key, rule, signature } = first;
    return { kind, scope, key, rule, signature, patterns: members, impact: tally(members),
      potential: tally(potential(members)), byStage: byStage(members), byProvider: byProvider(members),
      contrastSummary: groupContrasts(members, index) };
  });
};

export const analyzeNormalizationImpact = (products: readonly NormalizationProductObservation[]) => {
  const ordered = [...products].sort((a, b) => a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0);
  const patterns = discoverNormalizationPatterns(ordered);
  const candidates = potential(patterns);
  const contrasts: readonly NormalizationContrast[] = ordered.flatMap(contrastNormalizationProduct);
  const providers = [...new Set(ordered.map((item) => item.providerId))].sort().map((providerId) => {
    const members = ordered.filter((item) => item.providerId === providerId);
    const publicationSha256 = [...new Set(members.flatMap((item) => item.publication ? [item.publication.sha256] : []))].sort();
    if (publicationSha256.length > 1) throw new Error(`Selecciones de publicación distintas en normalización: ${providerId}`);
    return { providerId, originalProducts: members.length, preparedProducts: members.length,
      publishedProducts: members.filter((item) => item.publication !== undefined).length,
      withoutPublication: members.filter((item) => item.publication === undefined).map((item) => item.identity),
      readyWithoutPublication: members.filter((item) => item.publication === undefined && item.preparationStatus === "ready").length,
      reviewWithoutPublication: members.filter((item) => item.publication === undefined && item.preparationStatus === "review").length,
      publicationSha256 };
  });
  return { providers, groups: groupsOf(patterns, contrastIndex(contrasts)), contrasts, contrastSummary: contrastSummary(contrasts), impact: tally(patterns), potential: tally(candidates),
    byStage: byStage(patterns), potentialByStage: byStage(candidates), potentialByProvider: byProvider(candidates),
    potentialByAssessment: { observacion_acreditada: tally(candidates.filter((pattern) => pattern.assessment === "observacion_acreditada")),
      hipotesis: tally(candidates.filter((pattern) => pattern.assessment === "hipotesis")) } };
};
