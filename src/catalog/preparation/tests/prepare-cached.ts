import type { ProductRecord } from "../../../contracts/catalog.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";
import type { ImportCatalog } from "../../legacy-export/contracts.js";
import type { PreparedProduct } from "../contracts.js";

const preparations = new WeakMap<ImportCatalog, WeakMap<ProductRecord, PreparedProduct>>();

export const prepareCached = (record: ProductRecord, catalog: ImportCatalog): PreparedProduct => {
  let byRecord = preparations.get(catalog);
  if (!byRecord) {
    byRecord = new WeakMap<ProductRecord, PreparedProduct>();
    preparations.set(catalog, byRecord);
  }
  const existing = byRecord.get(record);
  if (existing) return existing;
  const prepared = prepareProduct(record, catalog);
  byRecord.set(record, prepared);
  return prepared;
};
