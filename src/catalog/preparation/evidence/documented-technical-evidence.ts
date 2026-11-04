import { createHash } from "node:crypto";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";

export type DocumentedTechnicalUnit = {
  readonly fingerprint: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly categoryKey: string;
  readonly specifications: Readonly<SpecsMap>;
  readonly title?: string;
  readonly url?: string;
};

export type DocumentedTechnicalSource = {
  readonly providerId: string;
  readonly isEligible: (record: ProductRecord) => boolean;
  readonly requiredCondition?: ProductRecord["condition"];
  readonly exactTitleAndUrl?: boolean;
};

export const applyDocumentedTechnicalEvidence = (
  record: ProductRecord,
  specs: SpecsMap,
  units: Readonly<Record<string, DocumentedTechnicalUnit>>,
  source: DocumentedTechnicalSource
): SpecsMap => {
  if (record.providerId !== source.providerId || !record.reference || !record.specs ||
    (source.requiredCondition !== undefined && record.condition !== source.requiredCondition) ||
    !source.isEligible(record)) return specs;
  const unit = units[record.reference];
  if (!unit || record.brand !== unit.brand || record.model !== unit.model ||
    record.categoryKey !== unit.categoryKey ||
    (source.exactTitleAndUrl === true && (record.title !== unit.title || record.url !== unit.url)) ||
    createHash("sha256").update(JSON.stringify(record)).digest("hex") !== unit.fingerprint ||
    Object.keys(unit.specifications).some((key) => key in specs)) return specs;
  return { ...specs, ...unit.specifications };
};
