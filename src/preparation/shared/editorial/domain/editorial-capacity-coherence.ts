import { containsEditorialIdentity } from "./editorial-identity-match.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";

export type EditorialCapacityDocument = {
  readonly title: string | null;
  readonly description?: string | null;
  readonly description_general: string | null;
  readonly sourceUrl: string;
  readonly reference: string | null;
  readonly spec: Readonly<Record<string, unknown>>;
};

type CapacityClaim = { readonly start: number; readonly end: number; readonly amount: number; readonly text: string };

const capacityKg = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,5})(?:[ \t]*)kg$/iu.exec(value.trim());
  const number = match?.[1] ? Number(match[1]) : null;
  return number !== null && Number.isSafeInteger(number) && number >= 50 && number <= 50000 ? number : null;
};

const loadNumber = (value: string, unit: string): number | null => {
  const result = unit.toLocaleLowerCase("es").startsWith("tonelada")
    ? Number(value.replace(",", ".")) * 1000 : Number(value.replace(/[.,]/gu, ""));
  return Number.isSafeInteger(result) && result >= 50 && result <= 50000 ? result : null;
};

const oneClaim = (text: string | null, pattern: RegExp): CapacityClaim | null => {
  if (!text) return null;
  const matches = [...text.matchAll(pattern)];
  const match = matches.length === 1 ? matches[0] : null;
  if (!match || match.index === undefined || !match[1] || !match[2]) return null;
  const amount = loadNumber(match[1], match[2]);
  return amount === null ? null : {
    start: match.index, end: match.index + match[0].length, amount, text: match[0]
  };
};

const summaryClaim = (text: string | null): CapacityClaim | null => oneClaim(text,
  /\b(?:capacidad\s+de\s+carga(?:\s+de)?|cargas?\s+de\s+hasta)\s+(\d{1,5}|\d{1,2}[.,]\d{1,3})\s*(kg|toneladas?)\b/giu);

const generalClaim = (text: string | null): CapacityClaim | null => oneClaim(text,
  /\bcapacidad\s+(?:(?:nominal|de\s+carga)(?:\s+(?:excepcional|indicada|declarada))?)\s+(?:de\s+)?(?:hasta\s+)?(\d{1,5}|\d{1,2}[.,]\d{1,3})\s*(kg|kilogramos)\b/giu);

const titleClaim = (text: string): CapacityClaim | null => oneClaim(text,
  /(?<![\p{L}\p{N}])(\d{1,5}|\d{1,2}[.,]\d{3})\s*(kg)\b/giu);

const formatClaim = (text: string, claim: CapacityClaim, amount: number): string =>
  `${text.slice(0, claim.start)}${claim.text.replace(
    /(\d{1,5}|\d{1,2}[.,]\d{1,3})\s*(kg|kilogramos|toneladas?)\b/iu,
    (_original: string, _number: string, unit: string) =>
      unit.toLocaleLowerCase("es").startsWith("tonelada") && amount % 1000 === 0
        ? `${amount / 1000} ${unit}` : `${amount} ${unit.toLocaleLowerCase("es").startsWith("tonelada") ? "kg" : unit}`
  )}${text.slice(claim.end)}`;

export const normalizeVerifiedEditorialCapacity = (
  source: ProductRecord, document: EditorialCapacityDocument
): Pick<EditorialCapacityDocument, "title" | "description" | "description_general"> => {
  const { title, description, description_general } = document;
  const unchanged = { title, ...(description === undefined ? {} : { description }), description_general };
  const normalized = (value: string): string => value.normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");
  if (!title || source.url !== document.sourceUrl || source.reference !== document.reference ||
    !source.model || !source.brand ||
    !containsEditorialIdentity(title, source.model) ||
    !containsEditorialIdentity(source.title ?? "", source.model) ||
    source.specs?.["Marca"] !== source.brand || source.specs?.["Modelo"] !== source.model ||
    document.spec["Marca"] !== source.brand || document.spec["Modelo"] !== source.model ||
    !/\b(?:transpaleta|carretilla|apilador|preparapedidos|recogepedidos|capacidad\s+de\s+carga)\b/iu.test(title)) {
    return unchanged;
  }
  const sourceKg = capacityKg(source.specs["Capacidad de carga (kg)"]);
  const projectedKg = capacityKg(document.spec["Capacidad de carga (kg)"]);
  if (sourceKg === null || sourceKg !== projectedKg) return unchanged;
  const sourceSummary = summaryClaim(source.shortDescription);
  const sourceGeneral = generalClaim(source.longDescription);
  const summaryAgrees = sourceSummary?.amount === sourceKg;
  const generalAgrees = sourceGeneral?.amount === sourceKg &&
    containsEditorialIdentity(source.longDescription ?? "", source.model);
  if (!summaryAgrees && !generalAgrees) return unchanged;

  const oldTitle = titleClaim(title);
  const normalizedTitle = oldTitle && oldTitle.amount !== sourceKg && (summaryAgrees || generalAgrees)
    ? formatClaim(title, oldTitle, sourceKg) : title;
  const publishedSummary = description === undefined ? null : summaryClaim(description);
  const normalizedSummary = description && sourceSummary && publishedSummary && generalAgrees &&
    sourceSummary.amount !== sourceKg && publishedSummary.amount === sourceSummary.amount
    ? formatClaim(description, publishedSummary, sourceKg) : description;
  const publishedGeneral = generalClaim(description_general);
  const normalizedGeneral = description_general && publishedGeneral && summaryAgrees &&
    publishedGeneral.amount !== sourceKg &&
    oldTitle?.amount === publishedGeneral.amount && oldTitle.amount !== sourceKg
    ? formatClaim(description_general, publishedGeneral, sourceKg) : description_general;
  return {
    title: normalizedTitle,
    ...(description === undefined ? {} : { description: normalizedSummary }),
    description_general: normalizedGeneral
  };
};
