import { isDeepStrictEqual } from "node:util";
import type { ProductRecord, SpecsMap, SpecValue } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import { normalizeSpecKey } from "../../catalog/normalization/normalize-specs.js";
import { prepareSourceProduct } from "../prepare-product.js";
import type { TechnicalRecoveryObservation } from "./technical-recovery-observation.js";
import { reconcileOriginalTechnicalPresentation } from "../technical/original-technical-presentation.js";

type PresentationReplacement = {
  readonly sourceField: string;
  readonly destinationField: string;
  readonly mechanism: string;
  readonly value: SpecValue;
};

export type AccreditedTechnicalPresentation = PresentationReplacement & {
  readonly originalValue: SpecValue;
  readonly previousValue: SpecValue;
};

const captureReplacements = (): {
  readonly replacements: readonly PresentationReplacement[];
  readonly observe: TechnicalRecoveryObservation;
} => {
  const replacements: PresentationReplacement[] = [];
  return { replacements, observe(before, after, mechanism, sourceField, source, editorialRuleId) {
    if (source || editorialRuleId || !sourceField || typeof sourceField !== "object") return;
    const removed = Object.keys(before).filter((field) => !Object.hasOwn(after, field));
    const added = Object.keys(after).filter((field) => !Object.hasOwn(before, field));
    const destinationField = added[0];
    if (removed.length !== 1 || removed[0] !== sourceField.spec || added.length !== 1 || destinationField === undefined ||
      Object.keys(before).some((field) => field !== sourceField.spec && !isDeepStrictEqual(before[field], after[field]))) return;
    const value = after[destinationField];
    if (value === undefined) return;
    replacements.push({ sourceField: sourceField.spec, destinationField, mechanism, value });
  } };
};

const sourceIdentityMatches = (source: ProductRecord, candidate: ImportCandidate): boolean =>
  Boolean(source.reference?.trim() && source.url.trim()) && source.providerId === candidate.providerId &&
  source.reference === candidate.reference && source.url === candidate.sourceUrl &&
  (source.providerId !== "gam" || (source.externalReference?.trim() || null) === candidate.externalReference);

const identitySpecs = (specs: SpecsMap): SpecsMap => Object.fromEntries(Object.entries(specs).filter(([field]) =>
  ["marca", "modelo", "referencia", "nº de serie"].includes(normalizeSpecKey(field).toLocaleLowerCase("es"))));

const publicationIdentityMatches = (previous: ImportCandidate, candidate: ImportCandidate): boolean =>
  previous.providerId === candidate.providerId && previous.reference === candidate.reference &&
  previous.sourceUrl === candidate.sourceUrl && previous.externalReference === candidate.externalReference &&
  previous.category === candidate.category && previous.categorySellID === candidate.categorySellID &&
  Boolean(candidate.title?.trim()) && previous.title === candidate.title &&
  isDeepStrictEqual(identitySpecs(previous.spec), identitySpecs(candidate.spec));

const matchesFinal = (replacement: PresentationReplacement, final: SpecsMap): boolean =>
  !Object.hasOwn(final, replacement.sourceField) && Object.hasOwn(final, replacement.destinationField) &&
  isDeepStrictEqual(final[replacement.destinationField], replacement.value);

const uniqueReplacements = (replacements: readonly PresentationReplacement[], final: SpecsMap): readonly PresentationReplacement[] =>
  replacements.filter((replacement) => matchesFinal(replacement, final) &&
    replacements.filter((other) => other.sourceField === replacement.sourceField ||
      other.destinationField === replacement.destinationField).length === 1);

const accredit = (source: ProductRecord, candidate: ImportCandidate, previous?: ImportCandidate):
  ReadonlyMap<string, AccreditedTechnicalPresentation> => {
  const result = new Map<string, AccreditedTechnicalPresentation>();
  if (!source.specs || !sourceIdentityMatches(source, candidate) ||
    (previous && !publicationIdentityMatches(previous, candidate))) return result;
  const actual = captureReplacements();
  const prepared = prepareSourceProduct(source, actual.observe);
  if ((previous && prepared.status !== "ready") || !isDeepStrictEqual(prepared.product, candidate)) return result;
  const historicalSpecs = previous?.spec ?? source.specs;
  const replay = captureReplacements();
  const replayed = reconcileOriginalTechnicalPresentation(source, historicalSpecs, replay.observe);
  const historical = uniqueReplacements(replay.replacements, replayed);
  for (const replacement of uniqueReplacements(actual.replacements, candidate.spec)) {
    const { sourceField, destinationField } = replacement;
    const originalValue = source.specs[sourceField];
    const previousValue = historicalSpecs[sourceField];
    if (originalValue === undefined || previousValue === undefined || Object.hasOwn(historicalSpecs, destinationField) ||
      !historical.some((observed) => isDeepStrictEqual(observed, replacement))) continue;
    result.set(sourceField, { ...replacement, originalValue, previousValue });
  }
  return result;
};

export const accreditSourceTechnicalPresentation = (source: ProductRecord, candidate: ImportCandidate):
  ReadonlyMap<string, AccreditedTechnicalPresentation> => accredit(source, candidate);

export const accreditPublishedTechnicalPresentation = (source: ProductRecord, previous: ImportCandidate, candidate: ImportCandidate):
  ReadonlyMap<string, AccreditedTechnicalPresentation> => accredit(source, candidate, previous);
