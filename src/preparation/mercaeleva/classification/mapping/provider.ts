import type { ClassificationProvider } from "../../../shared/classification/mapping/classification-provider-types.js";
import { applyMercaelevaAliasesDetailed } from "./attributes.js";
import { normalizeMercaelevaCandidate } from "../../technical/mapping/technical.js";
import { mercaelevaUnspecifiedMast } from "../../technical/evidence/handling-evidence.js";
import { mercaelevaUnpublishedHours } from "../../technical/evidence/hours-evidence.js";
import { mercaelevaCategorySlug, mercaelevaNewCategorySlug } from "./categories.js";
import { mercaelevaConditionEvidence } from "./condition.js";

export const mercaelevaClassificationProvider: ClassificationProvider = {
  attribute: {
    suppress: (record, attribute) =>
      (attribute.name === "Tipo de mástil" && attribute.type === "SELECT" && mercaelevaUnspecifiedMast(record)) ||
      (attribute.name === "Horas de uso" && (attribute.type === "NUMBER" || attribute.type === "DECIMAL") &&
        mercaelevaUnpublishedHours(record)),
    addAliases: applyMercaelevaAliasesDetailed,
    excludeSpec: () => false,
    unmeasured: () => false,
    convert: (_record, attribute, candidate, fallback) => normalizeMercaelevaCandidate(attribute, candidate, fallback),
    sourceYear: (record) => record.year?.trim() ?? null
  },
  category: {
    slug: (record, condition) => {
      if (condition === "Nuevo") return mercaelevaNewCategorySlug(record);
      try {
        const url = new URL(record.url);
        return mercaelevaCategorySlug(record, url.pathname.split("/").filter(Boolean), url.hostname);
      } catch { return null; }
    },
    requiresSource: false,
    allowNameFallback: false,
    contradicts: () => false
  },
  condition: (record) => {
    const evidence = mercaelevaConditionEvidence(record);
    return { isNew: evidence.isNew, isUsed: evidence.isUsed, resolvesNew: evidence.isNew, resolvesUsed: evidence.isUsed };
  }
};
