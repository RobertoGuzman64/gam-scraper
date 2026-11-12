import type { ProductRecord } from "../../../../contracts/catalog.js";
import { validMercaelevaTechnicalSource } from "../../technical/mapping/technical.js";
import type { EditorialSource } from "../../../shared/editorial/domain/editorial-source-contract.js";
import { verifiedEditorialIdentity } from "../../../shared/editorial/domain/editorial-source-contract.js";

export const resolveMercaelevaEditorialDomainSource = (record: ProductRecord): EditorialSource | null => {
  if (record.providerId !== "mercaeleva" || record.categoryKey !== "venta" ||
    !validMercaelevaTechnicalSource(record) || !verifiedEditorialIdentity(record)) return null;
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  if (!brand || !model) return null;
  const url = new URL(record.url);
  const path = url.pathname.split("/").filter(Boolean);
  if (url.protocol !== "https:" || url.search || url.hash ||
    path[3]?.endsWith(`-${record.reference}`) !== true) return null;
  const additional = record.specs?.["Título adicional"];
  const familyText = `${record.title ?? ""} ${typeof additional === "string" ? additional : ""}`;
  const announcedHeight = typeof additional === "string" ?
    /^PLATAFORMA (?:ARTICULADA|TELESCOPICA) (?:ELECTRICA|DIESEL) (\d{1,2}(?:[.,]\d{1,2})?) MT$/iu.exec(additional)?.[1] : undefined;
  if (announcedHeight !== undefined) {
    const declared = record.specs?.["Altura de trabajo"];
    const declaredHeight = typeof declared === "string" ?
      /^(\d{1,2}(?:[.,]\d{1,2})?)\s*m$/iu.exec(declared.trim())?.[1] : undefined;
    if (declaredHeight === undefined || Number(announcedHeight.replace(",", ".")) !==
      Number(declaredHeight.replace(",", "."))) return null;
  }
  return {
    brand, model,
    familyClues: familyText,
    workingHeight: record.specs?.["Altura de trabajo"],
    lateralReach: undefined,
    liftingHeight: record.specs?.["Altura máxima de elevación"],
    liftingHeightUnit: "m",
    loadCapacity: /\bcarretilla\b/iu.test(familyText) ? record.specs?.["Capacidad máxima de elevación"] : undefined,
    equipmentHeight: record.specs?.["Altura"],
    motor: record.specs?.["Tipo de motor"]
  };
};

export const verifiedMercaelevaUnbrandedEditorialSource = (record: ProductRecord): boolean => {
  if (record.providerId !== "mercaeleva" || !record.reference || record.brand || record.model || !record.title) return false;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.protocol === "https:" && url.hostname === "sales.mercaeleva.com" &&
      !url.search && !url.hash && path[2] === "machine" && path[3] === record.reference;
  } catch {
    return false;
  }
};
