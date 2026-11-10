import type { ClassificationProvider } from "../../../shared/classification/mapping/classification-provider-types.js";
import { applyGomarizAliases, convertGomarizCandidate } from "./attributes.js";
import { gomarizCategorySlug } from "./categories.js";
import { gomarizUsedConditionEvidence } from "./condition.js";

export const gomarizClassificationProvider: ClassificationProvider = {
  attribute: {
    suppress: () => false,
    addAliases: (record, attribute, keys, candidates) => applyGomarizAliases(record, attribute, keys, candidates) ? "accepted" : "rejected",
    excludeSpec: () => false,
    unmeasured: () => false,
    convert: convertGomarizCandidate,
    sourceYear: (record) => record.year?.trim() ?? null
  },
  category: {
    slug: (record, condition) => {
      if (condition === "Nuevo") return null;
      try {
        const url = new URL(record.url);
        return gomarizCategorySlug(record, url.pathname.split("/").filter(Boolean), url.hostname);
      } catch { return null; }
    },
    requiresSource: false,
    allowNameFallback: false,
    contradicts: () => false
  },
  condition: (record) => {
    const used = gomarizUsedConditionEvidence(record);
    return { isNew: false, isUsed: used, resolvesNew: false, resolvesUsed: used };
  }
};
