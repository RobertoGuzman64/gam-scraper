import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { editorialQuantityOf, formatEditorialQuantity } from "./editorial-measurements.js";
import { hasUnconditionalEditorialClaim } from "./editorial-claim-evidence.js";
import { verifiedEditorialUnitPair } from "./editorial-unit-provenance.js";

const sourceVoltage = (specs: SpecsMap | undefined): number | null => {
  const volts = editorialQuantityOf(specs, ["Voltaje de la batería", "Voltaje batería (V)", "Voltaje"], "V");
  return volts !== null && volts >= 6 && volts <= 1500 ? volts : null;
};

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
  return matches.length > 0 && hasUnconditionalEditorialClaim(description, pattern) && matches.every((match) => {
    const position = match.index ?? 0;
    const previous = description.slice(Math.max(0, position - 120), position).split(/[.!?;\n]/u).at(-1) ?? "";
    const next = description.slice(position + match[0].length, position + match[0].length + 65).split(/[.!?;\n]/u)[0] ?? "";
    return /\bbater[ií]a(?:s)?\b/iu.test(`${previous} ${next}`);
  });
};

export const resolveAssertedBatteryVoltage = (
  source: ProductRecord, prepared: ProductRecord, general: string
): string | null => {
  if (!verifiedEditorialUnitPair(source, prepared)) return null;
  const sourceValue = sourceVoltage(source.specs);
  if (sourceValue === null || sourceValue !== sourceVoltage(prepared.specs)) return null;
  const description = source.longDescription ?? "";
  if (!assertedVoltage(description, sourceValue)) return null;
  const display = formatEditorialQuantity(sourceValue);
  const mentionedVoltages = [...general.matchAll(/\b(\d{1,4}(?:[.,]\d{1,3})?)\s*V\b/giu)];
  if (mentionedVoltages.length > 0) return null;
  return `La ficha del proveedor declara una tensión de batería de ${display} V.`;
};
