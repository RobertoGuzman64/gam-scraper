import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../attribute-utils.js";

const compact = (value: string): string => fold(value).replace(/[^a-z0-9]/g, "");

const modelPrefix = (model: string): string | null => {
  const found = compact(model).match(/^([a-z]{2,})(\d+)/);
  return found?.[1] && found[2] ? found[1] : null;
};

const sourceModelTokens = (text: string, prefix: string): readonly string[] => {
  const normalized = fold(text);
  const pattern = new RegExp(`\\b${prefix}[\\s-]*(\\d+[a-z0-9-]*)`, "g");
  return [...normalized.matchAll(pattern)].flatMap((match) => match[1] ? [compact(match[1])] : []);
};

const isGamElevationPage = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !["elevacion", "elevacion-nueva"].includes(record.categoryKey)) return false;
  try {
    const url = new URL(record.url);
    return url.hostname === "online.gamrentals.com" && url.pathname.split("/").filter(Boolean)[0] === "es";
  } catch {
    return false;
  }
};

export const gamElevationBrandConflict = (record: ProductRecord): boolean => {
  if (!isGamElevationPage(record) || !record.brand || !record.model) return false;
  const specBrand = record.specs?.["Marca"];
  const specModel = record.specs?.["Modelo"];
  if (typeof specBrand !== "string" || typeof specModel !== "string" ||
    fold(specBrand) !== fold(record.brand) || compact(specModel) !== compact(record.model)) return false;
  const short = record.shortDescription ?? "";
  const match = short.match(/^\s*➨\s*([A-Z][A-Z0-9-]{1,24})\s+([A-Z0-9.-]*\d[A-Z0-9.-]*)\b/i);
  if (!match?.[1] || !match[2] || fold(match[1]) === fold(record.brand)) return false;
  const title = record.title ?? "";
  const normalizeWords = (value: string): string => fold(value).replace(/[^a-z0-9]+/g, " ").trim();
  if (!` ${normalizeWords(title)} `.includes(` ${normalizeWords(`${match[1]} ${match[2]}`)} `)) return false;
  const canonicalModel = compact(record.model);
  return !compact(title).includes(canonicalModel) && !compact(short).includes(canonicalModel);
};

export const gamElevationIdentityConflict = (record: ProductRecord): boolean => {
  if (!isGamElevationPage(record)) return false;
  if (gamElevationBrandConflict(record)) return true;
  if (!record.model) return false;
  const prefix = modelPrefix(record.model);
  if (!prefix) return false;
  if (/\d[.,]\d/.test(record.model)) return false;
  const model = compact(record.model).slice(prefix.length);
  const expectedNumber = model.match(/^\d+/)?.[0];
  if (!expectedNumber) return false;
  const titleTokens = sourceModelTokens(record.title ?? "", prefix);
  const shortTokens = sourceModelTokens(record.shortDescription ?? "", prefix);
  const conflictingNumber = [...titleTokens, ...shortTokens].some((token) => token.match(/^\d+/)?.[0] !== expectedNumber);
  if (conflictingNumber) return true;
  const normalizeVariant = (value: string): string => value.replace(/li$/, "");
  const expected = normalizeVariant(model);
  const precise = !/\d\s+[a-z]/i.test(record.model);
  return precise && titleTokens.length > 0 && shortTokens.length > 0 &&
    [...titleTokens, ...shortTokens].some((token) => {
      const candidate = normalizeVariant(token);
      return /[a-z]$/.test(candidate) && candidate !== expected && !expected.startsWith(candidate);
    });
};
