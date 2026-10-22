import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold, numberToken, scalar } from "../../attribute-utils.js";

const ratedPowers = (text: string): number[] | null => {
  const values: number[] = [];
  for (const match of text.matchAll(/\b(\d[\d.,]*)\s*(kvas?|kwa)\b/gi)) {
    if (!match[1]) return null;
    const value = numberToken(match[1]);
    if (value === null || value <= 0) return null;
    values.push(value);
  }
  return values;
};

export const isGamGenerator = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !["otros-nuevos", "energia"].includes(record.categoryKey) ||
    !/^Grupo electr[oó]geno\s/i.test(record.title ?? "")) return false;
  let section = "";
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "online.gamrentals.com" || path[0] !== "es") return false;
    section = path[1] ?? "";
  } catch {
    return false;
  }
  return /^grupos-electrogenos-|^generadores-electricos-segunda-mano$/.test(section);
};

export const gamGeneratorCandidate = (record: ProductRecord, attribute: Attribute): Candidate | null => {
  if (!isGamGenerator(record) || attribute.name !== "Potencia" || attribute.type !== "NUMBER" ||
    attribute.unit_option !== "kVA (grupos) / kW") return null;
  const title = record.title?.match(/^Grupo electr[oó]geno\s+([a-z0-9-]+)\s+([a-z0-9.-]+)\s+(\d[\d.,]*)\s*kVA\s*$/i);
  if (!title?.[1] || !title[2] || !title[3] ||
    fold(title[1]) !== fold(record.brand ?? "") || fold(title[2]) !== fold(record.model ?? "")) return null;
  const power = numberToken(title[3]);
  if (power === null || power <= 0) return null;
  const mentions = ratedPowers(`${record.shortDescription ?? ""} ${record.longDescription ?? ""}`);
  if (mentions === null || mentions.some((value) => value !== power)) return null;
  for (const [key, value] of Object.entries(record.specs ?? {})) {
    if (!/\bpotencia\b/i.test(fold(key)) || /\bmotor\b/i.test(fold(key))) continue;
    const source = scalar(value);
    if (source === null || typeof source === "boolean") return null;
    const found = String(source).trim().match(/^(\d[\d.,]*)\s*(?:kvas?)?$/i);
    const parsed = found?.[1] ? numberToken(found[1]) : null;
    if (parsed !== power) return null;
  }
  return { key: attribute.name, value: power };
};
