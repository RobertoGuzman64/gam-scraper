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
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×]\s*(\d+(?:[.,]\d+)?))?\s*(mm|cm|m|metros?)(?:\s+metros?)?$/i);
  if (!match?.[1] || !match[2] || !match[4]) return null;
  const unit = match[4].toLowerCase();
  if (match[3] && unit.startsWith("metro")) return null;
  const ratio = unit === "mm" ? 1000 : unit === "cm" ? 100 : 1;
  const values = [match[1], match[2], match[3]].filter((part): part is string => part !== undefined)
    .map((part) => Number(part.replace(",", ".")) / ratio);
  if (values.some((dimension) => !Number.isFinite(dimension) || dimension <= 0 || dimension > 20)) return null;
  return `${values.map((dimension) => String(dimension).replace(".", ",")).join(" x ")} m`;
};
