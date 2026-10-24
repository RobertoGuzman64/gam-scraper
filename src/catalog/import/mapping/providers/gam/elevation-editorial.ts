import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../attribute-utils.js";
import { gamElevationIdentityConflict } from "./elevation-identity.js";

const compact = (value: string): string => fold(value).replace(/[^a-z0-9]/g, "");

const modelFamily = (value: string): string | null => compact(value).match(/^([a-z]{1,6})\d/)?.[1] ?? null;

const modelInTitle = (title: string, brand: string): string | null => {
  const normalized = fold(title);
  const prefix = ` ${brand} `;
  const index = normalized.lastIndexOf(prefix);
  if (index < 0) return null;
  const model = normalized.slice(index + prefix.length).trim();
  return model && /^[a-z0-9][a-z0-9 .-]*$/.test(model) ? model : null;
};

const modelInSummary = (summary: string, brand: string): string | null => {
  const normalized = fold(summary);
  const match = normalized.match(/^➨\s*([a-z][a-z0-9-]*)\s+(.+?)\s+(?:nuevo|nueva|segunda mano)\b/);
  return match?.[1] === brand && match[2] && /^[a-z0-9][a-z0-9 .-]*$/.test(match[2]) ? match[2] : null;
};

const agreedEquipment = (title: string, summary: string): boolean => {
  const first = fold(title);
  const second = fold(summary);
  if (first.includes("sobre camion") && second.includes("sobre camion")) return !second.includes("tijera");
  return ["tijera", "articulada"].some((family) => first.includes(family) && second.includes(family)) &&
    !["tijera", "articulada"].some((family) => first.includes(family) !== second.includes(family));
};

export const reconcileGamElevationEditorialIdentity = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || !["elevacion", "elevacion-nueva"].includes(record.categoryKey) ||
    !record.title || !record.shortDescription || !record.longDescription || !record.brand || !record.model ||
    !gamElevationIdentityConflict(record)) return record;
  const brand = fold(record.brand);
  const canonical = compact(record.model);
  if (brand.length < 2 || canonical.length < 5 || !/\d/.test(canonical) ||
    compact(String(record.specs?.["Modelo"] ?? "")) !== canonical ||
    fold(String(record.specs?.["Marca"] ?? "")) !== brand) return record;
  let path: string;
  try {
    const url = new URL(record.url);
    if (url.hostname !== "online.gamrentals.com" || !url.pathname.startsWith("/es/")) return record;
    path = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  } catch {
    return record;
  }
  if (!compact(path).includes(canonical) || !compact(path).includes(brand) ||
    !compact(record.longDescription).includes(canonical) || !agreedEquipment(record.title, record.shortDescription)) return record;
  const titleModel = modelInTitle(record.title, brand);
  const summaryModel = modelInSummary(record.shortDescription, brand);
  if (!titleModel || !summaryModel) return record;
  const titleId = compact(titleModel);
  const summaryId = compact(summaryModel);
  const wrong = titleId === canonical && summaryId !== canonical ? summaryModel :
    summaryId === canonical && titleId !== canonical ? titleModel : null;
  if (wrong === null || wrong.length < 4 || modelFamily(wrong) !== modelFamily(record.model) ||
    compact(record.longDescription).includes(compact(wrong))) return record;
  if (titleId !== canonical) {
    const prefix = record.title.slice(0, record.title.length - titleModel.length);
    return { ...record, title: `${prefix}${record.model}` };
  }
  const original = record.shortDescription;
  const start = original.match(/^\s*➨\s*\S+\s+/)?.[0];
  const marker = original.match(/\s+(?:Nuevo|Nueva|Segunda Mano)\b/i);
  if (!start || !marker || marker.index === undefined) return record;
  return { ...record, shortDescription: `${start}${record.model}${original.slice(marker.index)}` };
};
