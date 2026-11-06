import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "../../identity/evidence/source-variant-identity.js";

const gradeKey = "Pendiente superable (%)";
const singleGradient = /\bcapacidad\s+de\s+superar\s+pendientes\s+del\s+(\d{1,2}(?:[.,]\d+)?)\s*%/giu;
const anyGradient = /\b(?:pendientes?|inclinaci[oó]n)\b[^.!?;\n]{0,75}?\b(\d{1,2}(?:[.,]\d+)?)\s*%/giu;
const parse = (literal: string | undefined): number => Number((literal ?? "").replace(",", "."));
const hasGradient = (specs: SpecsMap): boolean => Object.keys(specs).some((key) =>
  /\bpendiente\s+(?:superable|m[aá]xima)\b/iu.test(key));

export const recoverGamSourceGradeabilitySpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.condition !== "Nuevo" || !verifiedGamSourceVariant(record) || hasGradient(source)) return source;
  const text = record.longDescription ?? "";
  if (record.categoryKey === "elevacion-nueva") {
    const matches = [...text.matchAll(singleGradient)];
    const measures = [...text.matchAll(anyGradient)];
    if (matches.length !== 1 || measures.length !== 1) return source;
    const value = parse(matches[0]?.[1]);
    return Number.isFinite(value) && value >= 5 && value <= 60 ? { ...source, [gradeKey]: value } : source;
  }
  return source;
};
