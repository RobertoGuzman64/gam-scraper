import type { ProductRecord } from "../../../../contracts/catalog.js";

export type EditorialCapacityDocument = {
  readonly title: string | null;
  readonly description_general: string | null;
  readonly sourceUrl: string;
  readonly reference: string | null;
  readonly spec: Readonly<Record<string, unknown>>;
};

const capacityKg = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,5})(?:[ \t]*)kg$/iu.exec(value.trim());
  const number = match?.[1] ? Number(match[1]) : null;
  return number !== null && Number.isSafeInteger(number) && number >= 50 && number <= 50000 ? number : null;
};

const corroboratedSummaryCapacity = (text: string | null): number | null => {
  if (!text) return null;
  const claims = [...text.matchAll(/\b(?:capacidad\s+de\s+carga(?:\s+de)?|cargas?\s+de\s+hasta)\s+(\d{1,5}|\d{1,2}[.,]\d{1,3})\s*(kg|toneladas?)\b/giu)];
  if (claims.length !== 1 || !claims[0]?.[1] || !claims[0]?.[2]) return null;
  const raw = claims[0][1];
  const unit = claims[0][2].toLocaleLowerCase("es");
  const number = unit.startsWith("tonelada") ? Number(raw.replace(",", ".")) * 1000 :
    Number(raw.replace(/[.,]/gu, ""));
  return Number.isSafeInteger(number) ? number : null;
};

const titleKg = (text: string): { readonly start: number; readonly end: number; readonly amount: number } | null => {
  const matches = [...text.matchAll(/(?<![\p{L}\p{N}])(\d{1,5}|\d{1,2}[.,]\d{3})\s*kg\b/giu)];
  if (matches.length !== 1 || !matches[0]?.[1] || matches[0].index === undefined) return null;
  const amount = Number(matches[0][1].replace(/[.,]/gu, ""));
  return Number.isSafeInteger(amount) ? { start: matches[0].index, end: matches[0].index + matches[0][0].length, amount } : null;
};

export const normalizeVerifiedEditorialCapacity = (
  source: ProductRecord, document: EditorialCapacityDocument
): Pick<EditorialCapacityDocument, "title" | "description_general"> => {
  const { title, description_general } = document;
  if (!title || source.url !== document.sourceUrl || source.reference !== document.reference ||
    !source.model || !source.brand ||
    source.specs?.["Marca"] !== source.brand || source.specs?.["Modelo"] !== source.model ||
    document.spec["Marca"] !== source.brand || document.spec["Modelo"] !== source.model ||
    !/\b(?:transpaleta|carretilla|apilador|capacidad\s+de\s+carga)\b/iu.test(title)) {
    return { title, description_general };
  }
  const sourceKg = capacityKg(source.specs["Capacidad de carga (kg)"]);
  const projectedKg = capacityKg(document.spec["Capacidad de carga (kg)"]);
  if (sourceKg === null || sourceKg !== projectedKg ||
    corroboratedSummaryCapacity(source.shortDescription) !== sourceKg) {
    return { title, description_general };
  }
  const match = titleKg(title);
  if (!match || match.amount === sourceKg) return { title, description_general };
  const resolvedTitle = `${title.slice(0, match.start)}${sourceKg} kg${title.slice(match.end)}`;
  const claimedCapacity = /\b(capacidad\s+de\s+carga\s+(?:indicada|declarada|nominal)\s+de\s+)(\d{1,5})\s*kg\b/giu;
  const general = description_general?.replace(claimedCapacity, (original, phrase: string, raw: string) =>
    Number(raw) === match.amount ? `${phrase}${sourceKg} kg` : original) ?? null;
  return { title: resolvedTitle, description_general: general };
};
