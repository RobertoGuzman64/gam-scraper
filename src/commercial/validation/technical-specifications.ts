import type { ImportCandidate } from "../legacy-export/contracts.js";
import { hasTechnicalLoadCapacityDisagreement } from "../../catalog/validation/technical-specifications.js";

export {
  isPresentableSpecifications,
  inspectTechnicalSpecifications
} from "../../catalog/validation/technical-specifications.js";
export type {
  TechnicalSpecificationIssue,
  TechnicalSpecificationIssueCode
} from "../../catalog/validation/technical-specifications.js";

export const hasLoadCapacityDisagreement = (
  product: Pick<ImportCandidate, "title" | "spec">
): boolean => hasTechnicalLoadCapacityDisagreement(product.title, product.spec);
