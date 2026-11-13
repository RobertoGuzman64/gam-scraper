import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { EditorialSource } from "../../../shared/editorial/domain/editorial-source-contract.js";
import { verifiedEditorialUrl } from "../../../shared/editorial/domain/editorial-source-url.js";
import { verifiedEditorialIdentity, verifiedEditorialStructuredIdentity } from "../../../shared/editorial/domain/editorial-source-contract.js";

export const resolveGamEditorialDomainSource = (record: ProductRecord): EditorialSource | null => {
  if (record.providerId !== "gam" || !(verifiedEditorialIdentity(record) || verifiedEditorialStructuredIdentity(record))) return null;
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  if (!brand || !model) return null;
  const url = verifiedEditorialUrl(record.url, ["online.gamrentals.com"]);
  if (!url) return null;
  const path = url.pathname.split("/").filter(Boolean);
  if (path.length !== 3 || path[0] !== "es" ||
    path[2]?.startsWith(`${record.reference}-`) !== true) return null;
  return {
    brand, model,
    familyClues: `${record.title ?? ""} ${url.pathname}`,
    workingHeight: undefined,
    lateralReach: undefined,
    liftingHeight: record.specs?.["Altura de elevación (mm)"],
    liftingHeightUnit: "mm",
    loadCapacity: record.specs?.["Capacidad de carga (kg)"],
    equipmentHeight: record.specs?.["Altura"],
    motor: undefined
  };
};

export const verifiedGamUnbrandedEditorialSource = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !record.reference || record.brand || record.model || !record.title) return false;
  const url = verifiedEditorialUrl(record.url, ["online.gamrentals.com"]);
  if (!url) return false;
  const path = url.pathname.split("/").filter(Boolean);
  return path.length === 3 && path[0] === "es" &&
    path[2]?.startsWith(`${record.reference}-`) === true;
};
