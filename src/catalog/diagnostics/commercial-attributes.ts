import type { ImportCandidate, ImportCatalog } from "../legacy-export/contracts.js";
import type { CommercialBaselineInput } from "./commercial-baseline.js";
import { decideCommercialCategory } from "../commercial/category-decision.js";
import { projectCommercialAttributes } from "../commercial/attribute-projection.js";
import type { CommercialAttributeIssue } from "../commercial/attribute-decision.js";
import { resolveAttribute } from "../preparation/mapping/attribute-mapping.js";
import type { AttributeResolution } from "../preparation/mapping/attribute-types.js";

type MissingStatus = Exclude<AttributeResolution["status"], "resolved">;
type AttributeSample = {
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly sourceCategory: string;
  readonly status: MissingStatus | CommercialAttributeIssue["reason"] | "resuelto-no-asignado" | "origen-distinto-de-preparacion";
};

type AttributeCoverage = {
  readonly attributeID: number;
  readonly name: string;
  readonly type: ImportCatalog["attributes"][number]["type"];
  readonly requiredInSnapshot: boolean;
  readonly relatedProducts: number;
  readonly accepted: number;
  readonly notObserved: number;
  readonly contradiction: number;
  readonly invalid: number;
  readonly rejected: number;
  readonly examples: readonly AttributeSample[];
};

export type CommercialAttributeAudit = {
  readonly eligible: number;
  readonly categorized: number;
  readonly pendingCategory: number;
  readonly excluded: number;
  readonly mappedAssignments: number;
  readonly recoveredAssignments: number;
  readonly acceptedAssignments: number;
  readonly invalidAssignments: number;
  readonly productsWithAccepted: number;
  readonly requiredMissingInSnapshot: number;
  readonly originPreparationDifferences: { readonly affected: number; readonly examples: readonly AttributeSample[] };
  readonly decisions: readonly {
    readonly reference: string | null;
    readonly sourceUrl: string;
    readonly sourceCategory: string;
    readonly categorySellID: number | null;
    readonly status: "excluded" | "pending" | "proposed";
    readonly attributes: ImportCandidate["attributes"];
    readonly recovered: ImportCandidate["attributes"];
    readonly unresolved: readonly {
      readonly attributeID: number;
      readonly status: MissingStatus | "resuelto-no-asignado";
      readonly requiredInSnapshot: boolean;
    }[];
  }[];
  readonly coverage: readonly AttributeCoverage[];
  readonly validationIssues: readonly {
    readonly reason: CommercialAttributeIssue["reason"] | "resuelto-no-asignado";
    readonly affected: number;
    readonly examples: readonly AttributeSample[];
  }[];
};

type MutableCoverage = {
  attributeID: number;
  name: string;
  type: AttributeCoverage["type"];
  requiredInSnapshot: boolean;
  relatedProducts: number;
  accepted: number;
  notObserved: number;
  contradiction: number;
  invalid: number;
  rejected: number;
  examples: AttributeSample[];
};

type MutableIssue = { reason: CommercialAttributeAudit["validationIssues"][number]["reason"]; affected: number; examples: AttributeSample[] };

const example = (item: CommercialBaselineInput, status: AttributeSample["status"]): AttributeSample => ({
  reference: item.source.reference, sourceUrl: item.source.url,
  sourceCategory: item.source.categoryKey, status
});
const appendSample = (samples: AttributeSample[], sample: AttributeSample): void => {
  if (samples.length < 3) samples.push(sample);
};

export const analyzeCommercialAttributes = (
  entries: readonly CommercialBaselineInput[], catalog: ImportCatalog
): CommercialAttributeAudit => {
  const attributes = new Map(catalog.attributes.map((attribute) => [attribute.id, attribute]));
  const relations = new Map<number, Set<number>>();
  for (const relation of catalog.relations.filter((item) => item.actived !== false)) {
    const ids = relations.get(relation.categoryID) ?? new Set<number>();
    ids.add(relation.attributeID);
    relations.set(relation.categoryID, ids);
  }
  const coverage = new Map<number, MutableCoverage>();
  const decisions: CommercialAttributeAudit["decisions"][number][] = [];
  const validationIssues = new Map<MutableIssue["reason"], MutableIssue>();
  let excluded = 0;
  let pendingCategory = 0;
  let categorized = 0;
  let mappedAssignments = 0;
  let recoveredAssignments = 0;
  let acceptedAssignments = 0;
  let productsWithAccepted = 0;
  let requiredMissingInSnapshot = 0;
  let originPreparationDifferenceCount = 0;
  const originPreparationExamples: AttributeSample[] = [];
  const recordIssue = (item: CommercialBaselineInput, reason: MutableIssue["reason"]): void => {
    const existing = validationIssues.get(reason) ?? { reason, affected: 0, examples: [] };
    existing.affected += 1;
    appendSample(existing.examples, example(item, reason));
    validationIssues.set(reason, existing);
  };
  for (const item of entries) {
    const decision = decideCommercialCategory(item.source, item.mapped.product.categorySellID);
    if (decision.status !== "proposed") {
      decisions.push({ reference: item.source.reference, sourceUrl: item.source.url,
        sourceCategory: item.source.categoryKey, categorySellID: null, status: decision.status,
        attributes: [], recovered: [], unresolved: [] });
      if (decision.status === "excluded") excluded += 1;
      else pendingCategory += 1;
      continue;
    }
    categorized += 1;
    const proposed = item.mapped.product;
    mappedAssignments += proposed.attributes.length;
    const checked = projectCommercialAttributes(item.published, proposed, catalog);
    recoveredAssignments += checked.recovered.length;
    acceptedAssignments += checked.accepted.length;
    if (checked.accepted.length > 0) productsWithAccepted += 1;
    for (const issue of checked.issues) recordIssue(item, issue.reason);
    const accepted = new Map(checked.accepted.map((assignment) => [assignment.attributeID, assignment.value]));
    const recovered = new Set(checked.recovered.map((assignment) => assignment.attributeID));
    const unresolved: CommercialAttributeAudit["decisions"][number]["unresolved"][number][] = [];
    const linked = relations.get(decision.categorySellID) ?? new Set<number>();
    for (const attributeID of linked) {
      const attribute = attributes.get(attributeID);
      if (!attribute) continue;
      const stats = coverage.get(attributeID) ?? {
        attributeID, name: attribute.name, type: attribute.type, requiredInSnapshot: attribute.required,
        relatedProducts: 0, accepted: 0, notObserved: 0, contradiction: 0, invalid: 0, rejected: 0, examples: []
      };
      stats.relatedProducts += 1;
      const result = resolveAttribute(item.source, attribute);
      const value = accepted.get(attributeID);
      if (value !== undefined) {
        stats.accepted += 1;
        if (!recovered.has(attributeID) && (result.status !== "resolved" || result.value !== value)) {
          originPreparationDifferenceCount += 1;
          appendSample(originPreparationExamples, example(item, "origen-distinto-de-preparacion"));
        }
      } else if (result.status === "resolved") {
        recordIssue(item, "resuelto-no-asignado");
        appendSample(stats.examples, example(item, "resuelto-no-asignado"));
        unresolved.push({ attributeID, status: "resuelto-no-asignado", requiredInSnapshot: attribute.required });
        if (attribute.required) requiredMissingInSnapshot += 1;
      } else {
        stats[result.status === "not_observed" ? "notObserved" : result.status] += 1;
        if (attribute.required) requiredMissingInSnapshot += 1;
        if (result.status !== "not_observed" || attribute.required) {
          unresolved.push({ attributeID, status: result.status, requiredInSnapshot: attribute.required });
          appendSample(stats.examples, example(item, result.status));
        }
      }
      coverage.set(attributeID, stats);
    }
    decisions.push({ reference: item.source.reference, sourceUrl: item.source.url,
      sourceCategory: item.source.categoryKey, categorySellID: decision.categorySellID,
      status: "proposed", attributes: checked.accepted, recovered: checked.recovered, unresolved });
  }
  return {
    eligible: categorized + pendingCategory, categorized, pendingCategory, excluded,
    mappedAssignments, recoveredAssignments, acceptedAssignments, invalidAssignments: mappedAssignments + recoveredAssignments - acceptedAssignments,
    productsWithAccepted, requiredMissingInSnapshot,
    originPreparationDifferences: { affected: originPreparationDifferenceCount, examples: originPreparationExamples },
    decisions: decisions.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl, "es")),
    coverage: [...coverage.values()].sort((a, b) => {
      const unresolvedA = a.relatedProducts - a.accepted;
      const unresolvedB = b.relatedProducts - b.accepted;
      return unresolvedB - unresolvedA || a.attributeID - b.attributeID;
    }),
    validationIssues: [...validationIssues.values()].sort((a, b) => b.affected - a.affected || a.reason.localeCompare(b.reason, "es"))
  };
};
