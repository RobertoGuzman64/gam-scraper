import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { editorialQuantity, formatEditorialQuantity } from "./editorial-measurements.js";

const sourceVoltage = (specs: SpecsMap | undefined): number | null => {
  const value = specs?.["Voltaje de la batería"] ?? specs?.["Voltaje batería (V)"];
  const volts = editorialQuantity(value, "V");
  return volts !== null && volts >= 6 && volts <= 1500 ? volts : null;
};

const plain = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");

const alternatives = /\b(?:opcional(?:es)?|opci[oó]n|alternativ[oa]s?|version(?:es)?|compatible\s+con|puede\s+(?:montar|incluir|incorporar|equiparse)|sin\s+bater[ií]a|no\s+(?:incluye|incorpora|monta))\b/iu;

const assertedVoltage = (description: string, volts: number): boolean => {
  const numeric = String(volts).replace(".", "[.,]");
  const pattern = new RegExp(`\\b${numeric}\\s*V\\b`, "giu");
  const matches = [...description.matchAll(pattern)];
  const otherVoltages = [...description.matchAll(/\b(\d{1,4}(?:[.,]\d{1,3})?)\s*V\b/giu)]
    .filter((match) => Number(match[1]?.replace(",", ".")) !== volts);
  if (otherVoltages.some((match) => {
    const position = match.index ?? 0;
    return /\bbater[ií]a(?:s)?\b/iu.test(description.slice(Math.max(0, position - 120), position + 65));
  })) return false;
  return matches.length > 0 && matches.every((match) => {
    const position = match.index ?? 0;
    const previous = description.slice(Math.max(0, position - 120), position).split(/[.!?;\n]/u).at(-1) ?? "";
    const next = description.slice(position + match[0].length, position + match[0].length + 65).split(/[.!?;\n]/u)[0] ?? "";
    return /\bbater[ií]a(?:s)?\b/iu.test(`${previous} ${next}`) &&
      !alternatives.test(plain(`${previous} ${next}`));
  });
};

export const resolveAssertedBatteryVoltage = (
  source: ProductRecord, prepared: ProductRecord, general: string
): string | null => {
  const sourceValue = sourceVoltage(source.specs);
  if (sourceValue === null || sourceValue !== sourceVoltage(prepared.specs)) return null;
  const description = source.longDescription ?? "";
  if (!assertedVoltage(description, sourceValue)) return null;
  const display = formatEditorialQuantity(sourceValue);
  const mentionedVoltages = [...general.matchAll(/\b(\d{1,4}(?:[.,]\d{1,3})?)\s*V\b/giu)];
  if (mentionedVoltages.length > 0) return null;
  return `La ficha del proveedor declara una tensión de batería de ${display} V.`;
};
