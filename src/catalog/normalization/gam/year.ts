import type { ProductRecord } from "../../../contracts/catalog.js";

export const explicitGamTitleYear = (title: string | null): string | null => {
  if (!title) return null;
  const match = /\b(?:a[nñ]o(?:\s+de\s+fabricaci[oó]n)?\s*[:–-]?\s*|fabricad[ao]\s+en(?:\s+el\s+a[nñ]o)?\s+)((?:19|20)\d{2})\b/iu.exec(title);
  return match?.[1] ?? null;
};

export const gamSourceYear = (record: Pick<ProductRecord,
  "providerId" | "title" | "year" | "yearSource">): string | null => {
  const year = record.year?.trim() ?? null;
  if (record.providerId !== "gam" || record.yearSource !== "titulo") return year;
  return explicitGamTitleYear(record.title) === year ? year : null;
};

export const gamUrlYear = (value: string, reference?: string | null): string | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      url.search || url.hash) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "es" || parts.length !== 3) return null;
    const match = /^(\d+)-((?:19|20)\d{2})-.+$/u.exec(parts[2] ?? "");
    if (!match || (reference != null && match[1] !== reference)) return null;
    return match[2] ?? null;
  } catch {
    return null;
  }
};
