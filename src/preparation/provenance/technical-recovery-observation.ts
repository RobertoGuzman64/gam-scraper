import type { SpecsMap } from "../../contracts/catalog.js";
import type { DocumentedTechnicalSource } from "../../contracts/technical-provenance.js";

export type TechnicalRecoverySourceField = "longDescription" | "year" | { readonly spec: string };

export type TechnicalRecoveryObservation = (
  before: SpecsMap, after: SpecsMap, mechanism: string,
  sourceField?: TechnicalRecoverySourceField, source?: DocumentedTechnicalSource,
  editorialRuleId?: string
) => void;
