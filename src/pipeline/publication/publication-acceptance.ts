import type { PublicationDifference } from "./publication-contracts.js";

export type PublicationAcceptance = {
  readonly accepted: boolean;
  readonly blockers: readonly string[];
};

export const evaluatePublicationDifference = (difference: PublicationDifference): PublicationAcceptance => {
  const blockers: string[] = [];
  if (difference.removed.length) blockers.push(`Fichas retiradas: ${difference.removed.join(", ")}`);
  if (difference.lostDescriptions.length) {
    blockers.push(`Descripciones vaciadas: ${difference.lostDescriptions.join(", ")}`);
  }
  if (difference.removedSpecifications.length) {
    blockers.push(`Especificaciones retiradas sin equivalencia acreditada: ${difference.removedSpecifications.join(", ")}`);
  }
  if (difference.lostSpecificationValues.length) {
    blockers.push(`Valores técnicos vaciados: ${difference.lostSpecificationValues.join(", ")}`);
  }
  if (difference.changedSources.length) {
    blockers.push(`Identidad de origen modificada: ${difference.changedSources.join(", ")}`);
  }
  return { accepted: blockers.length === 0, blockers };
};

export class PublicationAcceptanceError extends Error {
  constructor(readonly blockers: readonly string[]) {
    super(`Activación bloqueada: ${blockers.join("; ")}`);
    this.name = "PublicationAcceptanceError";
  }
}
