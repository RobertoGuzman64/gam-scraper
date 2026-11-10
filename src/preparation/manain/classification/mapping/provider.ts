import type { ClassificationProvider } from "../../../shared/classification/mapping/classification-provider-types.js";
import { applyManainAliases, convertManainCandidate, isManainUnmeasuredNumeric } from "./attributes.js";
import { manainCategorySlug } from "./categories.js";
import { manainConditionEvidence } from "./condition.js";

export const manainClassificationProvider: ClassificationProvider = {
  attribute: {
    suppress: () => false,
    addAliases: (record, attribute, keys, candidates) => {
      applyManainAliases(record, attribute, keys, candidates);
      return "accepted";
    },
    excludeSpec: () => false,
    unmeasured: isManainUnmeasuredNumeric,
    convert: convertManainCandidate,
    sourceYear: (record) => record.year?.trim() ?? null
  },
  category: {
    slug: manainCategorySlug,
    requiresSource: true,
    allowNameFallback: false,
    contradicts: () => false
  },
  condition: (record) => {
    const evidence = manainConditionEvidence(record);
    return { isNew: evidence.isNew, isUsed: evidence.isUsed, resolvesNew: evidence.isNew, resolvesUsed: evidence.isUsed };
  }
};
