import type { ProductRecord } from "../../../../contracts/catalog.js";
import { invalidGomarizPlatformHeight } from "../../../../catalog/normalization/gomariz/technical.js";
import type { EditorialSource } from "../../../shared/editorial/domain/editorial-source-contract.js";
import { verifiedEditorialIdentity } from "../../../shared/editorial/domain/editorial-source-contract.js";

const normalized = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");

export const resolveGomarizEditorialDomainSource = (record: ProductRecord): EditorialSource | null => {
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta" ||
    record.condition !== "Segunda mano" || !verifiedEditorialIdentity(record) ||
    invalidGomarizPlatformHeight(record.url, record.specs ?? {})) return null;
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  if (!brand || !model) return null;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.search || url.hash ||
      !["www.gomarizrent.com", "gomarizrent.com"].includes(url.hostname)) return null;
    const slug = normalized(path[path.length - 1] ?? "");
    const validPath = path[0] === "producto" && path.length === 2 ||
      path[0] === "venta" && path.length === 4 ||
      path[0] !== "venta" && path.length === 3;
    if (!validPath || !slug.includes(normalized(model))) return null;
    return {
      brand, model,
      familyClues: `${record.title ?? ""} ${url.pathname}`,
      workingHeight: record.specs?.["Altura de trabajo"],
      lateralReach: record.specs?.["Alcance lateral"],
      liftingHeight: undefined,
      liftingHeightUnit: "m",
      loadCapacity: record.specs?.Capacidad,
      equipmentHeight: undefined,
      motor: record.specs?.Motor
    };
  } catch {
    return null;
  }
};
