import { createHash } from "node:crypto";
import type { ProductRecord } from "../../contracts/catalog.js";

const documentedSource = "87f92f9af2f77b07865741dc27570677030f12af7d69964f21879e617b818cdc";

export const hasDocumentedGomarizPriceOnRequest = (record: ProductRecord): boolean => {
  if (record.providerId !== "gomariz" || record.reference !== "TE1152" ||
    record.url !== "https://www.gomarizrent.com/producto/iteco-it12122/" ||
    record.categoryKey !== "venta" || record.condition !== "Segunda mano" ||
    record.brand !== "Iteco" || record.model !== "IT12122" ||
    record.price !== "0,00€") return false;
  return createHash("sha256").update(JSON.stringify([
    record.title, record.shortDescription, record.longDescription, record.specs, record.price
  ])).digest("hex") === documentedSource;
};
