import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { EditorialSource } from "../../../shared/editorial/domain/editorial-source-contract.js";
import { verifiedEditorialIdentity } from "../../../shared/editorial/domain/editorial-source-contract.js";

export const resolveGamEditorialDomainSource = (record: ProductRecord): EditorialSource | null => {
  if (record.providerId !== "gam" || !verifiedEditorialIdentity(record)) return null;
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  if (!brand || !model) return null;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      url.search || url.hash || path.length !== 3 || path[0] !== "es" ||
      path[2]?.startsWith(`${record.reference}-`) !== true) return null;
    return {
      brand, model,
      familyClues: `${record.title ?? ""} ${url.pathname}`,
      workingHeight: undefined,
      lateralReach: undefined,
      liftingHeight: record.specs?.["Altura de elevación (mm)"],
      liftingHeightUnit: "mm",
      loadCapacity: record.specs?.["Capacidad de carga (kg)"],
      motor: undefined
    };
  } catch {
    return null;
  }
};
