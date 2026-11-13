import type { ProductRecord } from "../../../../contracts/catalog.js";
import { validMercaelevaTechnicalSource } from "../../technical/mapping/technical.js";
import { verifiedEditorialUrl } from "../../../shared/editorial/domain/editorial-source-url.js";
import type { EditorialSource } from "../../../shared/editorial/domain/editorial-source-contract.js";
import { hasEditorialAdapterHeightConflict } from "../../../shared/editorial/domain/editorial-height-consistency.js";
import { hasEditorialMillimetreUnit } from "../../../shared/editorial/domain/editorial-measurements.js";
import { verifiedEditorialIdentity, verifiedEditorialStructuredIdentity } from "../../../shared/editorial/domain/editorial-source-contract.js";

export const resolveMercaelevaEditorialDomainSource = (record: ProductRecord): EditorialSource | null => {
  if (record.providerId !== "mercaeleva" || record.categoryKey !== "venta" ||
    !validMercaelevaTechnicalSource(record) || !(verifiedEditorialIdentity(record) || verifiedEditorialStructuredIdentity(record))) return null;
  if (record.condition === "Nuevo" && record.specs?.Estado === "Usado" ||
    record.condition === "Segunda mano" && record.specs?.Estado === "Nuevo") return null;
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  if (!brand || !model) return null;
  const url = verifiedEditorialUrl(record.url, ["sales.mercaeleva.com"]);
  if (!url) return null;
  const path = url.pathname.split("/").filter(Boolean);
  if (path[3]?.endsWith(`-${record.reference}`) !== true) return null;
  const additional = record.specs?.["Título adicional"];
  const familyText = `${record.title ?? ""} ${typeof additional === "string" ? additional : ""}`;
  if (hasEditorialAdapterHeightConflict(record)) return null;
  const liftingHeight = record.specs?.["Altura máxima de elevación"];
  return {
    brand, model,
    familyClues: familyText,
    workingHeight: record.specs?.["Altura de trabajo"],
    lateralReach: undefined,
    liftingHeight,
    liftingHeightUnit: hasEditorialMillimetreUnit(liftingHeight) ? "mm" : "m",
    loadCapacity: /\bcarretilla\b/iu.test(familyText) ? record.specs?.["Capacidad máxima de elevación"] : undefined,
    equipmentHeight: record.specs?.["Altura"],
    motor: record.specs?.["Tipo de motor"]
  };
};

export const verifiedMercaelevaUnbrandedEditorialSource = (record: ProductRecord): boolean => {
  if (record.providerId !== "mercaeleva" || !record.reference || record.brand || record.model || !record.title) return false;
  const url = verifiedEditorialUrl(record.url, ["sales.mercaeleva.com"]);
  if (!url) return false;
  const path = url.pathname.split("/").filter(Boolean);
  return path.length === 4 && ["es", "en"].includes(path[0] ?? "") &&
    path[1] === "for-sale" && path[2] === "machine" && path[3] === record.reference;
};
