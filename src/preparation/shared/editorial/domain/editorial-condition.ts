import type { ProductRecord } from "../../../../contracts/catalog.js";

const normalized = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").trim().toLocaleLowerCase("es");

export const resolveVerifiedEditorialCondition = (record: ProductRecord): ProductRecord["condition"] => {
  const condition = record.condition ?? null;
  if (!condition) return null;
  const declared = record.specs?.Estado;
  if (declared === undefined) return condition;
  if (typeof declared !== "string") return null;
  const state = normalized(declared);
  const compatible = condition === "Nuevo" ? state === "nuevo" || state === "nueva" :
    state === "usado" || state === "usada" || state === "segunda mano";
  return compatible ? condition : null;
};
