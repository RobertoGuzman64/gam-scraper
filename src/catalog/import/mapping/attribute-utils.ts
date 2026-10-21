import type { SpecScalar, SpecValue } from "../../../contracts/catalog.js";

export const fold = (value: string): string => value.toLocaleLowerCase("es").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export const scalar = (value: SpecValue): SpecScalar | null => {
  if (Array.isArray(value)) return value.length === 1 ? value[0] ?? null : null;
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null;
};

export const numberToken = (raw: string): number | null => {
  const value = raw.replace(/[\u00a0\u202f]/g, " ").trim();
  if (!/^\d[\d., ]*$/.test(value)) return null;
  let compact = value.replace(/ /g, "");
  if (/\d \d/.test(value) && !/^\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})?$/.test(value)) return null;
  const dot = compact.lastIndexOf(".");
  const comma = compact.lastIndexOf(",");
  const last = Math.max(dot, comma);
  if (last >= 0) {
    const rest = compact.slice(last + 1);
    const before = compact.slice(0, last);
    if (rest.length <= 2 && rest.length > 0) compact = `${before.replace(/[.,]/g, "")}.${rest}`;
    else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(compact)) compact = compact.replace(/[.,]/g, "");
    else return null;
  }
  const num = Number(compact);
  return Number.isFinite(num) && num >= 0 ? num : null;
};

export const basketDimensions = (value: SpecScalar): string | null => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:m|metros?)$/i);
  if (!match?.[1] || !match[2]) return null;
  const length = Number(match[1].replace(",", "."));
  const width = Number(match[2].replace(",", "."));
  if (!Number.isFinite(length) || !Number.isFinite(width) || length <= 0 || width <= 0) return null;
  return `${String(length).replace(".", ",")} x ${String(width).replace(".", ",")} m`;
};

