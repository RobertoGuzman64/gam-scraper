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

export const gamElevationIdentityConflict = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !["elevacion", "elevacion-nueva"].includes(record.categoryKey) || !record.model) return false;
  try {
    const url = new URL(record.url);
    if (url.hostname !== "online.gamrentals.com" || url.pathname.split("/").filter(Boolean)[0] !== "es") return false;
  } catch {
    return false;
  }
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
    [...titleTokens, ...shortTokens].every((token) => {
      const candidate = normalizeVariant(token);
      return /[a-z]$/.test(candidate) && candidate !== expected && !expected.startsWith(candidate);
    });
};
