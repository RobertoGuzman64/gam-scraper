import type { ProductRecord } from "../../../../contracts/catalog.js";
import { isGomarizOccasionSale } from "../../../../catalog/normalization/gomariz/sale.js";

export const gomarizUsedConditionEvidence = (record: ProductRecord): boolean =>
  isGomarizOccasionSale(record.url, record.categoryKey, record.categoryName) &&
  new URL(record.url).pathname.split("/").filter(Boolean).length === 4;
