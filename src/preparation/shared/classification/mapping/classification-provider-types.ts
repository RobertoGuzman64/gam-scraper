import type { ProductRecord, SpecScalar } from "../../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../../commercial/legacy-export/contracts.js";
import type { AliasOutcome, Attribute, Candidate, AttributeValue } from "./attribute-types.js";

export type ClassificationProvider = {
  readonly attribute: {
    readonly suppress: (record: ProductRecord, attribute: Attribute) => boolean;
    readonly addAliases: (record: ProductRecord, attribute: Attribute, keys: Set<string>, candidates: Candidate[]) => AliasOutcome;
    readonly excludeSpec: (record: ProductRecord, attribute: Attribute, key: string) => boolean;
    readonly unmeasured: (record: ProductRecord, attribute: Attribute, value: SpecScalar) => boolean;
    readonly convert: (record: ProductRecord, attribute: Attribute, candidate: Candidate, fallback: AttributeValue | null) => AttributeValue | null;
    readonly sourceYear: (record: ProductRecord) => string | null;
  };
  readonly category: {
    readonly slug: (record: ProductRecord, condition: Exclude<ImportCandidate["condition"], null>) => string | null;
    readonly requiresSource: boolean;
    readonly allowNameFallback: boolean;
    readonly contradicts: (record: ProductRecord, slug: string) => boolean;
  };
  readonly condition: (record: ProductRecord) => {
    readonly isNew: boolean;
    readonly isUsed: boolean;
    readonly resolvesNew: boolean;
    readonly resolvesUsed: boolean;
  };
};

