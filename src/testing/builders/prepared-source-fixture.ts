import type { ProductRecord } from "../../contracts/catalog.js";
import type { PreparedProduct } from "../../preparation/contracts.js";
import { prepareSourceProduct } from "../../preparation/prepare-product.js";

export const createPreparedSourceFixture = (): ((record: ProductRecord) => PreparedProduct) => {
  const prepared = new WeakMap<ProductRecord, PreparedProduct>();
  return (record: ProductRecord): PreparedProduct => {
    const existing = prepared.get(record);
    if (existing) return existing;
    const result = prepareSourceProduct(record);
    prepared.set(record, result);
    return result;
  };
};
