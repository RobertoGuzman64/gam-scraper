import type { ImportCandidate } from "./contracts.js";
import { referenceKey } from "./reference-inventory.js";

export const commercialReference = (product: ImportCandidate): string | null =>
  product.providerId === "gam" ? product.externalReference?.trim() || null : product.reference;

export const commercialReferenceKey = (providerId: string, reference: string): string => {
  const key = referenceKey(reference);
  if (providerId !== "gam") return key;
  const stock = /^GAM[\s-]+(\d+)$/.exec(key);
  return stock ? `GAM-${stock[1]}` : key;
};

export const commercialCandidate = (product: ImportCandidate): ImportCandidate =>
  product.providerId === "gam" ? { ...product, reference: commercialReference(product) } : product;
