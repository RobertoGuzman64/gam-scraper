import type { ProductRecord } from "../../../contracts/catalog.js";

export const normalizePrice = (value: string | null): number | null => {
  if (!value) return null;
  const raw = value.replace(/[\s\u00a0\u202f€]/g, "").replace(/EUR$/i, "");
  let normalized: string;
  if (/^\d+$/.test(raw)) normalized = raw;
  else if (/^\d+[.,]\d{1,2}$/.test(raw)) normalized = raw.replace(",", ".");
  else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) normalized = raw.replace(/[.,]/g, "");
  else if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(raw)) normalized = raw.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(raw)) normalized = raw.replace(/,/g, "");
  else return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

export const imageUrls = (record: ProductRecord): readonly string[] => {
  const unique = new Set<string>();
  for (const value of [...(record.images ?? []), ...(record.image ? [record.image] : [])]) {
    try {
      const url = new URL(value);
      if (/^https?:$/.test(url.protocol) && /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(url.toString())) unique.add(url.toString());
    } catch {
      continue;
    }
  }
  return [...unique];
};

