import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { editorialQuantityOf, formatEditorialQuantity } from "./editorial-measurements.js";
import type { EditorialFamily } from "./editorial-families.js";
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

const batteryFamilies: readonly EditorialFamily[] = [
  "carretilla-elevadora", "carretilla-retractil", "apilador", "transpaleta", "recogepedidos"
];

const batteryType = (value: SpecsMap[string] | undefined): string | null => {
  if (value === "Li-ion") return "de ion-litio";
  if (value === "Plomo-ácido") return "de plomo-ácido";
  if (value === "Gel") return "de gel";
  return null;
};

const batteryCapacity = (value: SpecsMap[string] | undefined): number | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,4}(?:[.,]\d{1,2})?)\s*Ah$/iu.exec(value.trim());
  const amperesHour = match?.[1] ? Number(match[1].replace(",", ".")) : null;
  return amperesHour !== null && amperesHour > 0 && amperesHour <= 2000 ? amperesHour : null;
};

export const resolveDocumentedBatteryConfiguration = (
  source: ProductRecord, prepared: ProductRecord, family: EditorialFamily, verifiedVoltage: number | null
): string | null => {
  if (!batteryFamilies.includes(family) ||
    !verifiedEditorialUnitPair(source, prepared) || verifiedVoltage === null) return null;
  const keys = ["Tipo de Batería", "Voltaje de la batería", "Capacidad de la batería"] as const;
  if (keys.some((key) => source.specs?.[key] === undefined || source.specs[key] !== prepared.specs?.[key])) return null;
  const type = batteryType(source.specs?.["Tipo de Batería"]);
  const voltage = editorialQuantityOf(source.specs, ["Voltaje de la batería"], "V");
  const capacity = batteryCapacity(source.specs?.["Capacidad de la batería"]);
  if (!type || voltage === null || voltage !== verifiedVoltage || capacity === null) return null;
  const description = source.longDescription ?? "";
  if (/\bbater[ií]as?\b/iu.test(description) &&
    !hasUnconditionalEditorialClaim(description, /\bbater[ií]as?\b/giu)) return null;
  return `batería ${type} con capacidad declarada de ${formatEditorialQuantity(capacity)} Ah`;
};
