import type { ClassificationProvider } from "../../../shared/classification/mapping/classification-provider-types.js";
import { gamSourceYear } from "../../../../catalog/normalization/gam/year.js";
import { applyGamAliasesDetailed, convertGamCandidate, isGamUnmeasuredNumeric, gamUnspecifiedTurningRadius } from "./attributes.js";
import { gamConfirmedAbsentScalar } from "./unrepresentable.js";
import { gamMislabelledSpecKey } from "../../technical/crossed-specifications.js";
import { gamUsedCategorySlug, newCategorySlug } from "./categories.js";
import { gamMappedCategoryContradiction } from "./category-integrity.js";
import { gamConditionEvidence } from "./condition.js";

export const gamClassificationProvider: ClassificationProvider = {
  attribute: {
    suppress: (record, attribute) => gamConfirmedAbsentScalar(record, attribute) ||
      (attribute.name === "Radio de giro" && attribute.unit_option === "mm" && gamUnspecifiedTurningRadius(record)),
    addAliases: applyGamAliasesDetailed,
    excludeSpec: gamMislabelledSpecKey,
    unmeasured: (_record, attribute, value) => isGamUnmeasuredNumeric(attribute, value),
    convert: convertGamCandidate,
    sourceYear: gamSourceYear
  },
  category: {
    slug: (record, condition) => {
      if (condition === "Nuevo") return newCategorySlug(record);
      try {
        const url = new URL(record.url);
        return gamUsedCategorySlug(record, url.pathname.split("/").filter(Boolean), url.hostname);
      } catch { return null; }
    },
    requiresSource: false,
    allowNameFallback: true,
    contradicts: gamMappedCategoryContradiction
  },
  condition: (record) => {
    const evidence = gamConditionEvidence(record);
    return {
      isNew: evidence.isNew,
      isUsed: evidence.isUsed,
      resolvesNew: false,
      resolvesUsed: evidence.documentedUsed
    };
  }
};
