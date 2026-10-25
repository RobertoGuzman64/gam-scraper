import type { ProductRecord } from "../contracts/catalog.js";

export type EditableInterventionField = keyof Pick<ProductRecord, "title" | "shortDescription" | "longDescription">;

export type ManualInterventionProposal = {
  readonly providerId: ProductRecord["providerId"];
  readonly identity: string;
  readonly field: EditableInterventionField;
  readonly expected: ProductRecord[EditableInterventionField];
  readonly next: ProductRecord[EditableInterventionField];
  readonly reason: string;
  readonly evidence: string;
};
