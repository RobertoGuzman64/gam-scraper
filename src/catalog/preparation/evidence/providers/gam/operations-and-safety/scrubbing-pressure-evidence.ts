import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "../identity/source-variant-identity.js";

const pressureKey = "Presión máxima de fregado (kg)";
const pressureMeasure = /\bpresi[oó]n(?:\s+de\s+fregado|\s+descendente)?(?:\s+(?:m[aá]xima|ajustable|regulable|variable))*\s+(?:(?:es\s+de|de|alcanza\s+los?)\s+)?(?:hasta\s+)?(\d{1,3}(?:[.,]\d)?)\s*kg\b/giu;
const pressureLevels = /\btres\s+niveles\s+de\s+presi[oó]n\s+descendente\s+ajustables?\s*\(\s*(\d{1,3}(?:[.,]\d)?)\s*kg\s*,\s*(\d{1,3}(?:[.,]\d)?)\s*kg\s+y\s*(\d{1,3}(?:[.,]\d)?)\s*kg\s*\)/giu;
const dualHeadPressure = /\bcepillos\s+cil[ií]ndricos\s+giran\b[^.!?]{0,100}\bpresi[oó]n\s+descendente\s+de\s+hasta\s+(\d{1,3}(?:[.,]\d)?)\s*kg\s*,\s*mientras\s+que\s+los\s+cepillos\s+de\s+disco\b[^.!?]{0,110}\baplican\s+hasta\s+(\d{1,3}(?:[.,]\d)?)\s*kg\s+de\s+presi[oó]n\b/giu;
const hasPressure = /\bpresi[oó]n\b/iu;
const explicitDiscPressure = /\b(?:para\s+los?\s+cabezales?\s+de|en\s+la\s+versi[oó]n\s+de)\s+disco\b/iu;
const alternateHeads = /\b(?:cabezal(?:es)?|cepillos?|versi[oó]n)\b.{0,55}\b(?:disco|cil[ií]ndric[oa]s?|orbital)\b/iu;

const numericValue = (raw: string | undefined): number => Number((raw ?? "").replace(",", "."));
const validPressure = (value: number): boolean => Number.isFinite(value) && value > 0 && value <= 300;
const selectedDisc = (model: string): boolean => /\bD(?:\d{2})?\b/iu.test(model);
const selectedCylinder = (model: string): boolean => /\bC(?:\d{2})?\b/iu.test(model);

const measureFromDescription = (record: ProductRecord): number | null => {
  const text = record.longDescription ?? "";
  const model = record.model ?? "";
  const dual = [...text.matchAll(dualHeadPressure)];
  if (dual.length > 0) {
    if (dual.length !== 1 || [...text.matchAll(pressureLevels)].length > 0 ||
      [...text.matchAll(pressureMeasure)].length !== 1) return null;
    const match = dual[0];
    if (!match) return null;
    const cylinderPressure = numericValue(match[1]);
    const discPressure = numericValue(match[2]);
    if (!validPressure(cylinderPressure) || !validPressure(discPressure) ||
      selectedDisc(model) === selectedCylinder(model)) return null;
    return selectedDisc(model) ? discPressure : cylinderPressure;
  }

  const tiers = [...text.matchAll(pressureLevels)];
  if (tiers.length > 0) {
    if (tiers.length !== 1 || [...text.matchAll(pressureMeasure)].length > 0) return null;
    const match = tiers[0];
    if (!match) return null;
    const first = numericValue(match[1]);
    const second = numericValue(match[2]);
    const maximum = numericValue(match[3]);
    return validPressure(first) && validPressure(second) && validPressure(maximum) &&
      first < second && second < maximum ? maximum : null;
  }

  const matches = [...text.matchAll(pressureMeasure)];
  if (matches.length !== 1) return null;
  const match = matches[0];
  if (!match) return null;
  const value = numericValue(match[1]);
  if (!validPressure(value) || /^presi[oó]n\s+de\s+hasta\b/iu.test(match[0])) return null;

  const before = text.slice(Math.max(0, match.index - 170), match.index);
  const previousEnd = Math.max(before.lastIndexOf("."), before.lastIndexOf("!"), before.lastIndexOf("?"));
  const sentenceStart = previousEnd === -1 ? before : before.slice(previousEnd + 1);
  const after = text.slice(match.index + match[0].length, match.index + match[0].length + 145);
  const sentenceEnd = after.search(/[.!?]/u);
  const sentenceTail = sentenceEnd === -1 ? after : after.slice(0, sentenceEnd);

  if (/\bversi[oó]n\s+de\s+850\s*mm\b/iu.test(sentenceTail) && !/\bD85\b/iu.test(model)) return null;
  if (alternateHeads.test(sentenceTail) && (!selectedDisc(model) || !explicitDiscPressure.test(sentenceTail))) return null;
  if (/\b(?:disco\s+o\s+cil[ií]ndric[oa]s?|cil[ií]ndric[oa]s?\s+o\s+(?:de\s+)?disco)\b/iu.test(sentenceStart)) return null;
  if (/\bcepillos?\s+de\s+disco\b/iu.test(sentenceStart) && selectedCylinder(model)) return null;
  if (/\bcepillos?\s+cil[ií]ndric[oa]s?\b/iu.test(sentenceStart) && !/\bcepillos?\s+de\s+disco\b/iu.test(sentenceStart) &&
    !selectedCylinder(model)) return null;
  if (/\bcepillos?\s+de\s+disco\b/iu.test(sentenceStart) && /\bcepillos?\s+cil[ií]ndric[oa]s?\b/iu.test(sentenceStart)) return null;
  return value;
};

export const recoverGamScrubbingPressureSpec = (record: ProductRecord): SpecsMap => {
  const specs = record.specs ?? {};
  if (record.condition !== "Nuevo" || record.categoryKey !== "limpieza-fregadoras" ||
    record.brand?.toLowerCase() !== "tennant" || !verifiedGamSourceVariant(record) ||
    Object.keys(specs).some((key) => hasPressure.test(key))) return specs;
  const value = measureFromDescription(record);
  return value === null ? specs : { ...specs, [pressureKey]: value };
};
