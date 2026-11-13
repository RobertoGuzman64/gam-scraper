import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialMetricOf } from "./editorial-measurements.js";
const additionalHeightConflict = (record: ProductRecord, pattern: RegExp): boolean => {
  const additional = record.specs?.["Título adicional"];
  const height = record.specs?.["Altura de trabajo"];
  if (typeof additional !== "string") return false;
  const titled = pattern.exec(additional);
  if (titled?.[1] === undefined) return false;
  const announced = Number(titled[1].replace(",", "."));
  const published = height === undefined ? null : editorialMetricOf(record.specs, ["Altura de trabajo"]);
  return published === null || published !== announced;
};

export const hasEditorialAdditionalHeightConflict = (record: ProductRecord): boolean =>
  additionalHeightConflict(record,
    /\b(?:PLATAFORMA|BRAZO)\s+(?:ARTICULADA|TELESCOPICA|TIJERA)\s+(?:ELECTRICA|DIESEL)\s+(\d+(?:[.,]\d+)?)\s*MT\b/iu);

export const hasEditorialAdapterHeightConflict = (record: ProductRecord): boolean =>
  additionalHeightConflict(record,
    /^PLATAFORMA (?:ARTICULADA|TELESCOPICA) (?:ELECTRICA|DIESEL) (\d{1,2}(?:[.,]\d{1,2})?) MT$/iu);

export const hasEditorialSourceWorkHeightConflict = (record: ProductRecord): boolean => {
  if (hasEditorialAdditionalHeightConflict(record)) return true;
  const explicit = (text: string | null): number | null => {
    const match = /\baltura\s+de\s+trabajo\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(?:m|mt|metros?)\b/iu.exec(text ?? "");
    return match?.[1] === undefined ? null : Number(match[1].replace(",", "."));
  };
  const title = explicit(record.title);
  const general = explicit(record.longDescription);
  const published = editorialMetricOf(record.specs, ["Altura de trabajo"]);
  if (general !== null && published !== null && general !== published) return true;
  return title !== null && (general !== null && title !== general ||
    published !== null && title !== published);
};

type HeightProduct = {
  readonly title: string | null;
  readonly description: string | null;
  readonly description_general: string | null;
  readonly spec: Readonly<Record<string, unknown>>;
};

type MeasuredHeight = { readonly value: number; readonly start: number; readonly text: string };
type TechnicalHeight = { readonly value: number; readonly kind: "work" | "elevation"; readonly millimetres: boolean };

export type CommercialHeightAssessment = {
  readonly status: "compatible" | "title-normalized" | "summary-normalized" | "possible-distinct-heights" |
    "unresolved" | "not-comparable";
  readonly title: string | null;
  readonly description: string | null;
  readonly titleMetres: number | null;
  readonly summaryMetres: number | null;
  readonly technicalMetres: number | null;
};

const heightPattern = /\b\d{1,3}(?:[.,]\d{1,2})?\s*(?:m|metros?)(?![\p{L}\p{N}])/giu;
const technicalPattern = /^\s*(\d+(?:[.,]\d+)?)\s*(mm|m|metros?)\s*$/iu;
const geometryPattern = /^altura (?:de trabajo|de elevaci[oó]n)(?:\s*\((?:m|mm)\))?$/iu;
const workingPattern = /^altura de trabajo(?:\s*\(m\))?$/iu;

const measure = (text: string | null): MeasuredHeight | null => {
  if (!text) return null;
  const all = [...text.matchAll(heightPattern)];
  if (all.length !== 1) return null;
  const match = all[0];
  if (!match?.[0] || match.index === undefined) return null;
  const numerical = /^\d{1,3}(?:[.,]\d{1,2})?/u.exec(match[0]);
  if (!numerical?.[0]) return null;
  const value = Number(numerical[0].replace(",", "."));
  return value > 0 ? { value, start: match.index, text: match[0] } : null;
};

const technicalHeight = (spec: HeightProduct["spec"]): TechnicalHeight | null => {
  const values: TechnicalHeight[] = [];
  for (const [key, raw] of Object.entries(spec)) {
    if (!geometryPattern.test(key) || typeof raw !== "string") continue;
    const match = technicalPattern.exec(raw);
    if (!match?.[1] || !match[2]) continue;
    const unit = match[2].toLowerCase();
    const millimetres = unit === "mm";
    const value = Number(match[1].replace(",", ".")) / (millimetres ? 1000 : 1);
    if (value <= 0 || value > 120) continue;
    values.push({ value, kind: workingPattern.test(key) ? "work" : "elevation", millimetres });
  }
  if (values.length !== 1) return null;
  return values[0] ?? null;
};

const equal = (a: number, b: number, tolerance = 0.1): boolean => Math.abs(a - b) <= tolerance;

const corroboratedMillimetres = (description: string | null, metres: number): boolean => {
  if (!description) return false;
  const matches = description.matchAll(/\b(\d{1,3}(?:[.,\s]\d{3})+|\d{4,6})\s*mm\b/giu);
  for (const match of matches) {
    if (!match[1]) continue;
    const value = Number(match[1].replace(/[.,\s]/gu, ""));
    if (Number.isFinite(value) && equal(value / 1000, metres, 0.001)) return true;
  }
  return false;
};

const replaceHeight = (text: string, match: MeasuredHeight, value: number): string => {
  const number = Number(value.toFixed(3)).toString().replace(".", ",");
  const unit = /metros?/iu.test(match.text) ? "metros" : "m";
  return `${text.slice(0, match.start)}${number} ${unit}${text.slice(match.start + match.text.length)}`;
};

const genieGs3246Heights = { workingMetres: 11.75, platformMetres: 9.8 } as const;

const corroboratedPlatformSummary = (
  product: HeightProduct, titleHeight: MeasuredHeight, summaryHeight: MeasuredHeight,
  tech: TechnicalHeight | null
): string | null => {
  if (product.spec["Marca"] !== "GENIE" || product.spec["Modelo"] !== "GS-3246" ||
    !/\bGENIE\s+GS-3246\b/iu.test(product.title ?? "") ||
    tech?.kind !== "elevation" || !equal(tech.value, titleHeight.value) ||
    !equal(titleHeight.value, genieGs3246Heights.workingMetres, 0.3) ||
    !equal(summaryHeight.value, genieGs3246Heights.platformMetres, 0.3) ||
    !product.description) return null;
  const end = summaryHeight.start + summaryHeight.text.length;
  const suffix = product.description.slice(end);
  if (!/^\s+de altura\b/iu.test(suffix) || /^\s+de altura de (?:trabajo|elevaci[oó]n)\b/iu.test(suffix)) {
    return null;
  }
  if (/^\s+de altura de plataforma\b/iu.test(suffix)) return product.description;
  return product.description.slice(0, end) + suffix.replace(/^(\s+de altura)\b/iu, "$1 de plataforma");
};

export const assessCommercialHeight = (product: HeightProduct): CommercialHeightAssessment => {
  const titleHeight = measure(product.title);
  const summaryHeight = measure(product.description);
  const tech = technicalHeight(product.spec);
  const initial = { title: product.title, description: product.description,
    titleMetres: titleHeight?.value ?? null, summaryMetres: summaryHeight?.value ?? null,
    technicalMetres: tech?.value ?? null };
  if (!titleHeight || !summaryHeight || !product.title || !product.description) {
    return { ...initial, status: "not-comparable" };
  }
  const difference = Math.abs(titleHeight.value - summaryHeight.value);
  if (difference <= 0.5) return { ...initial, status: "compatible" };
  const platformSummary = corroboratedPlatformSummary(product, titleHeight, summaryHeight, tech);
  if (platformSummary !== null) {
    return { ...initial, description: platformSummary, status: "compatible" };
  }
  if (tech?.kind === "work" && equal(summaryHeight.value, tech.value) &&
    !equal(titleHeight.value, tech.value, 0.5) && /\baltura\b/iu.test(product.description)) {
    return { ...initial, title: replaceHeight(product.title, titleHeight, tech.value), status: "title-normalized" };
  }
  if (tech?.kind === "elevation" && tech.millimetres && equal(titleHeight.value, tech.value) &&
    summaryHeight.value >= tech.value * 3 && summaryHeight.value - tech.value >= 5 &&
    corroboratedMillimetres(product.description_general, tech.value) &&
    /\baltura\b/iu.test(product.description)) {
    return { ...initial, description: replaceHeight(product.description, summaryHeight, tech.value),
      status: "summary-normalized" };
  }
  if (tech?.kind === "elevation" && equal(titleHeight.value, tech.value, 0.5) &&
    equal(difference, 2, 0.1) && /\bplataforma\b/iu.test(product.title)) {
    return { ...initial, status: "possible-distinct-heights" };
  }
  return { ...initial, status: "unresolved" };
};
