import type { ImportCandidate, ImportCatalog } from "../legacy-export/contracts.js";
import type { CommercialBaselineInput } from "./commercial-baseline.js";
import { decideCommercialCategory } from "../commercial/category-decision.js";
import { projectCommercialAttributes } from "../commercial/attribute-projection.js";
import type { CommercialAttributeIssue } from "../commercial/attribute-decision.js";
import { observeCommercialAttributes } from "../commercial/attribute-observation.js";

type AttributeSample = {
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly sourceCategory: string;
  readonly status: CommercialAttributeIssue["reason"] | "resuelto-no-asignado";
};

type AttributeCoverage = {
  readonly attributeID: number;
  readonly name: string;
  readonly type: ImportCatalog["attributes"][number]["type"];
  readonly relatedProducts: number;
  readonly accepted: number;
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
  readonly decisions: readonly {
    readonly reference: string | null;
    readonly sourceUrl: string;
    readonly sourceCategory: string;
    readonly categorySellID: number | null;
    readonly status: "excluded" | "pending" | "proposed";
    readonly relatedAttributes: number;
    readonly attributes: ImportCandidate["attributes"];
    readonly recovered: ImportCandidate["attributes"];
    readonly unresolved: readonly {
      readonly attributeID: number;
      readonly status: "resuelto-no-asignado";
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
  relatedProducts: number;
  accepted: number;
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
  const coverage = new Map<number, MutableCoverage>();
  const relatedByCategory = new Map<number, Set<number>>();
  for (const relation of catalog.relations) {
    if (relation.actived === false || !attributes.has(relation.attributeID)) continue;
    const related = relatedByCategory.get(relation.categoryID) ?? new Set<number>();
    related.add(relation.attributeID);
    relatedByCategory.set(relation.categoryID, related);
  }
  const decisions: CommercialAttributeAudit["decisions"][number][] = [];
  const validationIssues = new Map<MutableIssue["reason"], MutableIssue>();
  let excluded = 0;
  let pendingCategory = 0;
  let categorized = 0;
  let mappedAssignments = 0;
  let recoveredAssignments = 0;
  let acceptedAssignments = 0;
  let productsWithAccepted = 0;
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
        relatedAttributes: 0, attributes: [], recovered: [], unresolved: [] });
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
    const unresolved: CommercialAttributeAudit["decisions"][number]["unresolved"][number][] = [];
    for (const observation of observeCommercialAttributes(item.source, decision.categorySellID, checked.accepted, catalog)) {
      const attributeID = observation.attributeID;
      const attribute = attributes.get(attributeID);
      if (!attribute) continue;
      const stats = coverage.get(attributeID) ?? {
        attributeID, name: attribute.name, type: attribute.type,
        relatedProducts: 0, accepted: 0, examples: []
      };
      stats.relatedProducts += 1;
      if (observation.status === "accepted") stats.accepted += 1;
      else if (observation.status !== "sin-intervencion") {
        recordIssue(item, "resuelto-no-asignado");
        appendSample(stats.examples, example(item, observation.status));
        unresolved.push({ attributeID, status: observation.status });
      }
      coverage.set(attributeID, stats);
    }
    decisions.push({ reference: item.source.reference, sourceUrl: item.source.url,
      sourceCategory: item.source.categoryKey, categorySellID: decision.categorySellID,
      status: "proposed", relatedAttributes: relatedByCategory.get(decision.categorySellID)?.size ?? 0,
      attributes: checked.accepted, recovered: checked.recovered, unresolved });
  }
  return {
    eligible: categorized + pendingCategory, categorized, pendingCategory, excluded,
    mappedAssignments, recoveredAssignments, acceptedAssignments, invalidAssignments: mappedAssignments + recoveredAssignments - acceptedAssignments,
    productsWithAccepted,
    decisions: decisions.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl, "es")),
    coverage: [...coverage.values()].sort((a, b) => a.attributeID - b.attributeID),
    validationIssues: [...validationIssues.values()].sort((a, b) => b.affected - a.affected || a.reason.localeCompare(b.reason, "es"))
  };
};
