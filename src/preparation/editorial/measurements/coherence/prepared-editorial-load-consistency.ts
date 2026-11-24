import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../../commercial/legacy-export/contracts.js";
import { hasPublishedEditorialLoadConflict } from "./editorial-published-load-consistency.js";

export const hasVerifiedPublishedEditorialLoadConflict = (
  source: ProductRecord, published: ImportCandidate
): boolean => source.providerId === published.providerId && hasPublishedEditorialLoadConflict(source, published);
