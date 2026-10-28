import { createHash } from "node:crypto";
import type { ImportCandidate } from "../../../legacy-export/contracts.js";

const shortDescriptionCase = {
  reference: "5996",
  sourceUrl: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-yale/5996-carretilla-elevadora-electrica-yale-erp60mxlg6",
  sha256: "35384c515c665df67d7b8f891b252c5e99d21aff4b623332f4009a0005ff2eab",
  closingPhrase: "diferentes entornos industriales."
} as const;

export const hasGamShortDescriptionCorrection = (reference: string): boolean =>
  reference === shortDescriptionCase.reference;

export const curateGamDescription = (product: ImportCandidate): ImportCandidate => {
  if (product.providerId !== "gam" || product.reference !== shortDescriptionCase.reference) return product;
  const description = product.description;
  if (product.sourceUrl !== shortDescriptionCase.sourceUrl || !description ||
    createHash("sha256").update(description).digest("hex") !== shortDescriptionCase.sha256) {
    throw new Error(`Descripción GAM: resumen distinto de la evidencia acreditada (${product.reference})`);
  }
  const end = description.indexOf(shortDescriptionCase.closingPhrase);
  if (end < 0) throw new Error(`Descripción GAM: frase de cierre ausente (${product.reference})`);
  return { ...product, description: description.slice(0, end + shortDescriptionCase.closingPhrase.length) };
};
