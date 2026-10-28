import type { ProductRecord } from "../../../contracts/catalog.js";

export const requireProductReference = (products: readonly ProductRecord[], reference: string): ProductRecord => {
  const record = products.find((item) => item.reference === reference);
  if (!record) throw new Error(`No existe referencia ${reference}`);
  return record;
};
