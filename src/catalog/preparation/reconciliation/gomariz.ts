import type { ProductRecord } from "../../../contracts/catalog.js";
import { verifiedGomarizPlatformHeight } from "../../normalization/providers/gomariz/technical.js";

export const reconcileGomarizVerifiedPlatformHeight = (record: ProductRecord): ProductRecord => {
  try {
    const source = new URL(record.url);
    if (source.search || source.hash) return record;
  } catch {
    return record;
  }
  const height = verifiedGomarizPlatformHeight(record);
  if (height === null) return record;
  return {
    ...record,
    specs: { ...record.specs, "Altura plataforma": `${height.toLocaleString("es-ES", { maximumFractionDigits: 2 })} m` }
  };
};
