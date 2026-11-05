import type { ProductRecord } from "../../../contracts/catalog.js";
import { fold, numberToken } from "../mapping/attribute-utils.js";

const compact = (value: string): string => fold(value).replace(/[^a-z0-9]/gu, "");

const candidateCapacity = (description: string): number | null => {
  const match = /\bcapacidad\s+(?:(?:nominal|de carga)(?:\s+de)?\s+)?(?:hasta\s+)?(\d[\d.,]*)\s*(kg|toneladas?)\b/iu.exec(description);
  if (!match?.[1] || !match[2]) {
    const range = /\bcapacidad de carga de\s+(\d+(?:[.,]\d+)?)\s+a\s+\d+(?:[.,]\d+)?\s+toneladas?\b/iu.exec(description);
    const first = range?.[1] ? numberToken(range[1]) : null;
    return first === null ? null : first * 1000;
  }
  const magnitude = numberToken(match[1]);
  return magnitude === null ? null : magnitude * (/^tonelada/iu.test(match[2]) ? 1000 : 1);
};

const sourceIdentityAgreed = (record: ProductRecord): boolean => {
  if (!record.brand || !record.model || !record.title || !record.longDescription ||
    compact(String(record.specs?.Marca ?? "")) !== compact(record.brand) ||
    compact(String(record.specs?.Modelo ?? "")) !== compact(record.model) ||
    !compact(record.title).includes(compact(`${record.brand} ${record.model}`)) ||
    !(compact(record.longDescription).includes(compact(`${record.brand} ${record.model}`)) ||
      (compact(record.longDescription).includes(compact(record.brand)) &&
        compact(record.longDescription).includes(compact(record.model))))) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" && (parts[2] ?? "").startsWith(`${record.reference}-`) &&
      compact(parts[2] ?? "").includes(compact(`${record.brand}${record.model}`));
  } catch {
    return false;
  }
};

export const reconcileGamSourceCapacitySummary = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || !record.shortDescription || !sourceIdentityAgreed(record)) return record;
  const spec = record.specs?.["Capacidad de carga (kg)"];
  const match = typeof spec === "string" ? /^(\d[\d.,]*)\s*kg$/iu.exec(spec) : null;
  const capacity = match?.[1] ? numberToken(match[1]) : null;
  if (capacity === null || capacity !== candidateCapacity(record.longDescription ?? "")) return record;
  const titleCapacity = [...(record.title ?? "").matchAll(/\b(\d[\d.,]*)\s*kg\b/giu)];
  if (titleCapacity.length !== 1 || !titleCapacity[0]?.[1] || numberToken(titleCapacity[0][1]) !== capacity) return record;
  const short = /\b(capacidad de carga de\s+)(\d[\d.,]*)\s*kg\b/iu.exec(record.shortDescription);
  if (!short?.[1] || !short[2] || short.index === undefined) return record;
  const published = numberToken(short[2]);
  if (published === null || published === capacity) return record;
  const currentIdentity = compact(`${record.brand} ${record.model}`);
  const sourceHeading = /^\s*➨\s*(.+?)\s*(?:de segunda mano|nueva?|segunda mano|➨)/iu.exec(record.shortDescription)?.[1]?.trim();
  if (!sourceHeading) return record;
  if (compact(sourceHeading) !== currentIdentity) {
    if (compact(record.longDescription ?? "").includes(compact(sourceHeading))) return record;
    const first = (record.longDescription ?? "").match(/^(.{30,240}?\.)(?=\s+[A-ZÁÉÍÓÚ]|$)/u)?.[1];
    if (!first || !compact(first).includes(currentIdentity)) return record;
    return { ...record, shortDescription: `➨ ${record.brand} ${record.model} ➨ ${first}` };
  }
  const start = short.index + short[1].length;
  return { ...record, shortDescription:
    `${record.shortDescription.slice(0, start)}${capacity}${record.shortDescription.slice(start + short[2].length)}` };
};

export const preparedGamSourceCapacityShort = (editorialRecord: ProductRecord, record: ProductRecord, preparedShort: string | null): string | null => {
  if (editorialRecord.providerId !== "gam" || !editorialRecord.shortDescription ||
    editorialRecord.shortDescription === record.shortDescription ||
    preparedShort !== editorialRecord.shortDescription) return preparedShort;
  return record.shortDescription;
};
