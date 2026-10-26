import type { ProductRecord, SpecValue } from "../contracts/catalog.js";

export type EditableInterventionField = keyof Pick<ProductRecord,
  "title" | "shortDescription" | "longDescription" | "brand" | "model"> | `spec:${string}`;

export type ManualInterventionProposal = {
  readonly providerId: ProductRecord["providerId"];
  readonly identity: string;
  readonly field: EditableInterventionField;
  readonly expected: SpecValue | null;
  readonly next: SpecValue | null;
  readonly reason: string;
  readonly evidence: string;
};

export type InterventionMetadata = {
  readonly id: string;
  readonly summary: string;
};
