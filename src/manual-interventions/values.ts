import type { ProductRecord, SpecsMap, SpecValue } from "../contracts/catalog.js";
import type { ManualInterventionProposal } from "./contracts.js";
import { isSpecField } from "./proposals.js";

export const readProposedField = (
  product: ProductRecord,
  field: ManualInterventionProposal["field"]
): ManualInterventionProposal["expected"] | undefined => {
  if (isSpecField(field)) return product.specs?.[field.slice(5)];
  return product[field];
};

export const writeProposedField = (
  product: ProductRecord,
  change: ManualInterventionProposal
): ProductRecord => {
  if (isSpecField(change.field)) {
    const key = change.field.slice(5);
    if (!product.specs || !Object.hasOwn(product.specs, key)) {
      throw new Error(`El atributo técnico no existe en la fuente: ${key}`);
    }
    if (change.next === null) throw new Error(`El atributo técnico requiere un nuevo valor: ${key}`);
    const specs: SpecsMap = { ...product.specs, [key]: change.next };
    return { ...product, specs };
  }
  if (change.next !== null && typeof change.next !== "string") {
    throw new Error(`El campo ${change.field} requiere texto o null`);
  }
  switch (change.field) {
    case "title": return { ...product, title: change.next };
    case "shortDescription": return { ...product, shortDescription: change.next };
    case "longDescription": return { ...product, longDescription: change.next };
    case "brand": return { ...product, brand: change.next };
    case "model": return { ...product, model: change.next };
  }
};
