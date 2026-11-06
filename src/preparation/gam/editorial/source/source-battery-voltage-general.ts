import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "../../identity/evidence/source-variant-identity.js";

const voltagePattern = /^(\d{1,3}(?:[,.]\d)?)\s*V$/iu;
const batteryContext = /\bbater[ií]as?\b/iu;
const conflictingContext = /\b(?:versi[oó]n(?:es)?|opci[oó]n(?:es)?|opcional(?:es)?|recomienda|admite|compatible\s+con|puede\s+(?:utilizar|trabajar\s+con|incorporar|equipar|configurarse)|sin\s+bater[ií]as?|no\s+(?:incluye|incorpora|tiene)\s+bater[ií]as?)\b/iu;
const conditionalSuffix = /^\s*(?:\([^)]*\)\s*)?(?:opcional(?:es)?|como\s+opci[oó]n)\b/iu;

export const includeGamSourceBatteryVoltageInGeneral = (
  record: ProductRecord, general: string | null, specs: SpecsMap
): string | null => {
  if (!general?.trim() || (record.categoryName !== "Plataformas elevadoras nuevas" && record.categoryName !== "Apiladores nuevos") ||
    !verifiedGamSourceVariant(record)) return general;
  const value = specs["Voltaje batería (V)"];
  if (typeof value !== "string") return general;
  const numeric = voltagePattern.exec(value.trim());
  if (!numeric?.[1]) return general;
  const number = numeric[1].replace(/[,.]/u, "[,.]");
  const literal = new RegExp(`\\b${number}\\s*V\\b`, "giu");
  if (literal.test(general)) return general;
  const description = record.longDescription ?? "";
  const asserted = [...description.matchAll(literal)].some((match) => {
    const index = match.index ?? 0;
    const before = description.slice(Math.max(0, index - 125), index);
    const after = description.slice(index + match[0].length, index + match[0].length + 55);
    return batteryContext.test(`${before} ${after}`) && !conflictingContext.test(before) &&
      !conditionalSuffix.test(after);
  });
  if (!asserted) return general;
  const text = general.trim();
  return `${text}${/[.!?]$/u.test(text) ? "" : "."} La ficha del proveedor especifica una tensión de batería de ${value.trim()}.`;
};
