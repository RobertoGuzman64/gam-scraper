import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { editorialQuantityOf, formatEditorialQuantity } from "../measurements/editorial-measurements.js";
import type { EditorialFamily } from "../core/editorial-families.js";
import { hasUnconditionalEditorialClaim } from "./editorial-claim-evidence.js";
import { resolveEditorialFacts } from "../core/editorial-facts.js";
import { verifiedEditorialUnitPair } from "../identity/editorial-unit-provenance.js";

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

const batteryStatusField = (record: ProductRecord, keys: readonly string[]): string | null => {
  const values = keys.flatMap((key) => record.specs?.[key] === undefined ? [] : [record.specs[key]]);
  const normalized = values.map((value) => typeof value === "string" ? value.normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "").trim().toLowerCase() : null);
  const first = normalized[0];
  return first && normalized.every((value) => value === first) ? first : null;
};

export const resolveDeclaredBatteryStatus = (source: ProductRecord, prepared: ProductRecord, texts: string): string | null => {
  const replacementKeys = ["Baterias nuevas", "Baterías nuevas"];
  const statusKeys = ["Estado baterías", "Estado de baterías", "Estado de las baterías"];
  const hasField = (keys: readonly string[]): boolean => keys.some((key) =>
    source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined);
  const replacement = hasField(replacementKeys);
  const status = hasField(statusKeys);
  if (replacement === status || /\bbater[ií]as?\b|\bacumuladores?\b|\bautonom[ií]a\b/iu.test(texts) ||
    !verifiedEditorialUnitPair(source, prepared)) return null;
  const original = resolveEditorialFacts(source);
  const reconciled = resolveEditorialFacts(prepared);
  if (!original || !reconciled || original.family !== reconciled.family ||
    /\b(?:di[eé]sel|gasoil|gasolina|GLP|h[ií]brid[ao]s?)\b/iu.test(texts)) return null;
  const electric = (record: ProductRecord, energy: typeof original.energy): boolean => energy === "eléctrica" ||
    energy === null && /\bel[eé]ctric[ao]\b/iu.test(record.title ?? "");
  if (!electric(source, original.energy) || !electric(prepared, reconciled.energy)) return null;
  const keys = replacement ? replacementKeys : statusKeys;
  const value = batteryStatusField(source, keys);
  if (value === null || value !== batteryStatusField(prepared, keys)) return null;
  if (replacement) {
    if (value === "si") return "El proveedor declara baterías nuevas para esta unidad; no se ha comprobado su instalación ni su estado.";
    if (value === "sin baterias" && !hasField(["Batería", "Bateria", "Baterías", "Baterias", "Capacidad de la batería", "Voltaje de la batería"])) return "El proveedor anuncia esta unidad sin baterías; será necesario comprobar la configuración y el suministro antes de su puesta en servicio.";
    return null;
  }
  const percent = /^(100|[1-9]\d?)\s*%$/u.exec(value)?.[1];
  return percent ? `El campo de estado de baterías del proveedor indica ${percent} % para esta unidad, sin especificar el método de evaluación; no acredita capacidad residual ni autonomía.` : null;
};
