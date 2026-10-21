import type { ProductRecord } from "../../../../../contracts/catalog.js";

const fold = (value: string): string => value.toLocaleLowerCase("es").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export const mercaelevaConditionEvidence = (record: ProductRecord): { readonly isNew: boolean; readonly isUsed: boolean } => {
  const mercaelevaState = record.providerId === "mercaeleva" && typeof record.specs?.["Estado"] === "string"
    ? fold(record.specs["Estado"]) : null;
  const newInSource = mercaelevaState === "nuevo" || mercaelevaState === "nueva";
  const usedInSource = mercaelevaState === "usado" || mercaelevaState === "usada" ||
    mercaelevaState === "segunda mano" || mercaelevaState === "de segunda mano";
  return { isNew: newInSource, isUsed: usedInSource };
};
