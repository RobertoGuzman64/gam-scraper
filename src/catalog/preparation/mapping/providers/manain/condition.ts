import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../category-utils.js";

export const manainConditionEvidence = (record: ProductRecord): { readonly isNew: boolean; readonly isUsed: boolean } => {
  if (record.providerId !== "manain") return { isNew: false, isUsed: false };
  const states = [record.specs?.["Nueva o usada"], record.specs?.Estado, record.specs?.Condición].flatMap((value) =>
    Array.isArray(value) ? value : value === undefined ? [] : [value]);
  const values = states.map((state) => fold(String(state)));
  return {
    isNew: values.some((state) => ["nueva", "nuevo"].includes(state)),
    isUsed: values.some((state) => ["usada", "usado", "ocasion", "de ocasion", "segunda mano", "seminueva", "seminuevo"].includes(state))
  };
};
