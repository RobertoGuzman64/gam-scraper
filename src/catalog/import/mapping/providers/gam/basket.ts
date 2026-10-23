import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { basketDimensions } from "../../attribute-utils.js";

const sourceDimensions = /^(\d{3,4})\s*[x×]\s*(\d{3,4})\s*[x×]\s*(\d{3,4})\s+metros?$/i;
const fragmentedDimensions = /^(\d{1,2})\s+(\d{1,2}[.,]\d{1,2})\s*[x×]\s*(\d{1,2}[.,]\d{1,2})\s+([\d\sx×]+?)\s+metros?$/i;

export const gamBasketDimensionsFromRepeatedFragments = (value: string): string | null => {
  const matched = value.trim().match(fragmentedDimensions);
  if (!matched?.[1] || !matched[2] || !matched[3] || !matched[4]) return null;
  const [firstInteger, firstFraction] = matched[2].replace(",", ".").split(".");
  const [secondInteger, secondFraction] = matched[3].replace(",", ".").split(".");
  if (!firstInteger || !firstFraction || !secondInteger || !secondFraction || matched[1] !== firstInteger) return null;
  const remaining = matched[4].replace(/\s*[x×]\s*/gi, "x").trim();
  const repeats = [
    `${secondFraction} ${firstFraction}x${secondInteger}`,
    `${firstFraction}x${secondInteger} ${secondFraction}`
  ];
  if (!repeats.includes(remaining)) return null;
  return basketDimensions(`${matched[2]} x ${matched[3]} metros`);
};

const publishedDimensions = /\bdimensiones\s+de\s+(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|metros?)\b/gi;

export const gamBasketDimensionsFromDescription = (record: ProductRecord, value: string): string | null => {
  const raw = value.trim().match(sourceDimensions);
  if (!raw?.[1] || !raw[2] || !raw[3] || !record.longDescription) return null;
  const observed = [Number(raw[1]), Number(raw[2]), Number(raw[3])];
  const description = record.longDescription;
  const matched = [...description.matchAll(publishedDimensions)].filter((match) => {
    const before = description.slice(Math.max(0, (match.index ?? 0) - 120), match.index);
    return /\bcesta\b/i.test(before);
  });
  if (matched.length === 0) return null;
  const normalized = matched.map((match) => {
    const unit = match[4]?.toLowerCase();
    if (!unit) return null;
    const dimensions = [match[1] ?? "", match[2] ?? "", match[3] ?? ""];
    if (dimensions.some((part) => !part)) return null;
    const parts = dimensions.map((part) => unit === "mm" && /^\d{1,3}(?:\.\d{3})+$/.test(part)
      ? part.replace(/\./g, "") : part);
    return basketDimensions(`${parts.join("x")} ${unit}`);
  });
  const first = normalized[0];
  if (!first || normalized.some((entry) => entry !== first)) return null;
  const values = first.slice(0, -2).split(" x ").map((part) => Number(part.replace(",", ".")));
  if (values.length !== 3 || values.some((part, i) => Math.round(part * 1000) !== observed[i])) return null;
  return first;
};
