import type { ProductRecord, SpecsMap, SpecValue } from "../../../../../contracts/catalog.js";

const explicitHeight = /\baltura\s+(?:m[aá]xima\s+)?de\s+trabajo\s*(?::|de)\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:metros?|m)\b/giu;
const measuredHeight = /^\s*(\d+(?:[.,]\d+)?)\s*(mm|metros?|m)\s*$/iu;
const knownWorkHeight = new Set(["Altura de trabajo", "Altura de trabajo (m)", "Altura de trabajo (mm)"]);

const toNumber = (value: string): number => Number(value.replace(",", "."));

const comparableHeight = (value: SpecValue | undefined): number | null => {
  if (typeof value !== "string") return null;
  const match = value.match(measuredHeight);
  if (!match?.[1] || !match[2]) return null;
  const amount = toNumber(match[1]);
  return match[2].toLowerCase() === "mm" ? amount / 1000 : amount;
};

export const recoverGamExplicitWorkHeightSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.providerId !== "gam" || (record.categoryKey !== "elevacion" && record.categoryKey !== "elevacion-nueva") ||
    Object.keys(source).some((key) => knownWorkHeight.has(key))) return source;

  const matches = [...(record.longDescription ?? "").matchAll(explicitHeight)];
  if (matches.length === 0 || !matches[0]?.[1]) return source;
  const height = toNumber(matches[0][1]);
  if (!Number.isFinite(height) || height <= 0 || matches.some((match) => !match[1] || toNumber(match[1]) !== height)) return source;

  const existingElevation = source["Altura de elevación (m)"] ?? source["Altura de elevación (mm)"];
  if (existingElevation !== undefined) {
    const elevation = comparableHeight(existingElevation);
    if (elevation === null || height === elevation || Math.abs(height - elevation) > 0.5 + Number.EPSILON) return source;
  }

  return { ...source, "Altura de trabajo (m)": `${matches[0][1]} m` };
};
