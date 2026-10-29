import type { ImportCandidate } from "./contracts.js";

export const commercialReference = (product: ImportCandidate): string | null =>
  product.providerId === "gam" ? product.externalReference?.trim() || null : product.reference;

export const commercialCandidate = (product: ImportCandidate): ImportCandidate =>
  product.providerId === "gam" ? { ...product, reference: commercialReference(product) } : product;
