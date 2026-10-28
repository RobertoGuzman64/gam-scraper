import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold, numberToken } from "../../../mapping/attribute-utils.js";

const compact = (value: string): string => fold(value).replace(/[^a-z0-9]/g, "");

export const reconcileGamHandlingHeightEditorial = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.categoryKey !== "carretillas-nuevas" ||
    record.condition !== "Nuevo" || fold(record.brand ?? "") !== "hyster" ||
    fold(String(record.specs?.["Marca"] ?? "")) !== "hyster" ||
    !record.model || fold(String(record.specs?.["Modelo"] ?? "")) !== fold(record.model) ||
    !record.title || !record.shortDescription || !record.longDescription) return record;
  const model = fold(record.model);
  const title = fold(record.title);
  const short = fold(record.shortDescription);
  const long = fold(record.longDescription);
  if (!title.includes(`hyster ${model}`) || !short.includes(`hyster ${model}`) ||
    !long.includes(`hyster ${model}`) || !/\bcarretilla elevadora diesel\b/.test(title) ||
    !/\bcarretilla elevadora diesel\b/.test(short) || !/\bdiesel\b/.test(long) ||
    /\b(?:glp|lpg|electrica|electrico|hibrida|hibrido)\b/.test(`${title} ${short} ${long}`) ||
    fold(String(record.specs?.["Tipo motor"] ?? "")) !== "diesel" ||
    !["", "diesel"].includes(fold(String(record.specs?.["Motorización"] ?? "")))) return record;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "online.gamrentals.com" || parts.length !== 3 || parts[0] !== "es" ||
      parts[1] !== "carretillas-elevadoras-diesel-hyster" ||
      !compact(parts[2] ?? "").endsWith(`hyster${compact(model)}`) ||
      !(parts[2] ?? "").startsWith(`${record.reference}-`)) return record;
  } catch {
    return record;
  }
  const spec = record.specs?.["Altura de elevación (mm)"];
  const specMatch = typeof spec === "string" ? spec.trim().match(/^(\d{3,5})\s*mm$/i) : null;
  const summaryMatches = [...record.shortDescription.matchAll(/\bCarretilla Elevadora Diésel\s+(\d+(?:[.,]\d+)?)\s+metros\b/gi)];
  const descriptionMatches = [...record.longDescription.matchAll(/\baltura de elevación de\s+(\d+(?:[.,]\d+)?)\s+metros\b/gi)];
  if (!specMatch?.[1] || summaryMatches.length !== 1 || descriptionMatches.length !== 1 ||
    !summaryMatches[0]?.[1] || !descriptionMatches[0]?.[1]) return record;
  const expected = numberToken(summaryMatches[0][1]);
  const published = numberToken(descriptionMatches[0][1]);
  if (expected === null || published === null || expected * 1000 !== Number(specMatch[1]) ||
    expected === published || expected < 1 || expected > 16 || published < 1 || published > 16) return record;
  const match = descriptionMatches[0];
  const originalValue = match?.[1];
  const correctedValue = summaryMatches[0]?.[1];
  if (!match || match.index === undefined || !originalValue || !correctedValue) return record;
  const updated = `${record.longDescription.slice(0, match.index)}${match[0].replace(originalValue, correctedValue)}${record.longDescription.slice(match.index + match[0].length)}`;
  return { ...record, longDescription: updated };
};
