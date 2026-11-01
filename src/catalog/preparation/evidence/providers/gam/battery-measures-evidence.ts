import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "./measured-machine-specs.js";

const batteryPair = /(\d{2,3}(?:[.,]\d{1,2})?)\s*V\s*(?:\/|y|,)\s*(\d{2,4})\s*Ah\b/giu;
const batteryNominal = /tensi[oó]n\s+nominal\s+(?:aproximada\s+)?de\s+(\d{2,3}(?:[.,]\d{1,2})?)\s*V\s+y\s+una\s+capacidad\s+de\s+(\d{2,4})\s*Ah\b/giu;
const batterySpec = /bater[ií]a|voltaje|tensi[oó]n|acumulador|capacidad\s*\(?ah\)?/iu;
const voltageSpec = /voltaje|tensi[oó]n/iu;
const voltageInExistingValue = /\b\d{2,3}(?:[.,]\d{1,2})?\s*V\b/iu;
const singleBatteryVoltage = /\bbater[ií]as?\b[^.!?;\n]{0,105}?\b(\d{2,3}(?:[.,]\d{1,2})?)\s*V\b/giu;
const anyVoltage = /\b(\d{2,3}(?:[.,]\d{1,2})?)\s*V\b/giu;
const alternativeVoltage = /\b\d{2,3}(?:[.,]\d{1,2})?\s*(?:\/|o|u)\s*\d{2,3}(?:[.,]\d{1,2})?\s*V\b/iu;
const combinedBatteryCategories = new Set(["elevacion-nueva", "carretillas-nuevas", "apiladores-nuevos", "otros-nuevos", "limpieza-barredoras", "marcas-nuevas"]);
const isolatedVoltageCategories = new Set(["elevacion-nueva", "apiladores-nuevos", "limpieza-fregadoras", "carretillas-nuevas"]);

const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const matchesIdentity = (record: ProductRecord, categories: ReadonlySet<string>): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !identifiedGamMachineModel(record) ||
    !categories.has(record.categoryKey)) return false;
  const brand = record.brand?.trim();
  if (!brand || typeof record.specs?.["Marca"] !== "string" ||
    normalize(record.specs["Marca"]) !== normalize(brand) ||
    !normalize(record.title ?? "").includes(normalize(brand)) ||
    !normalize(record.longDescription ?? "").includes(normalize(brand))) return false;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && path[0] === "es" &&
      path[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(path[2]).includes(normalize(record.model ?? ""));
  } catch {
    return false;
  }
};

const identifiedBattery = (text: string): readonly [number, number] | null => {
  const measurements: Array<readonly [number, number]> = [];
  for (const pattern of [batteryPair, batteryNominal]) {
    for (const match of text.matchAll(pattern)) {
      const previous = text.slice(Math.max(0, match.index - 160), match.index);
      if (!/bater[ií]a/iu.test(previous)) continue;
      const voltage = Number((match[1] ?? "").replace(",", "."));
      const capacity = Number(match[2]);
      if (!Number.isFinite(voltage) || voltage < 12 || voltage > 500 ||
        !Number.isInteger(capacity) || capacity < 20 || capacity > 2000) return null;
      measurements.push([voltage, capacity]);
    }
  }
  const first = measurements[0];
  if (!first || measurements.some(([voltage, capacity]) => voltage !== first[0] || capacity !== first[1])) return null;
  const mentionedBatteryMeasures = [
    { pattern: /(\d{2,3}(?:[.,]\d{1,2})?)\s*V\b/giu, value: first[0], context: 110 },
    { pattern: /(\d{2,4})\s*Ah\b/giu, value: first[1], context: 130 }
  ];
  for (const { pattern, value, context } of mentionedBatteryMeasures) {
    for (const match of text.matchAll(pattern)) {
      if (!/bater[ií]a/iu.test(text.slice(Math.max(0, match.index - context), match.index))) continue;
      if (Number((match[1] ?? "").replace(",", ".")) !== value) return null;
    }
  }
  return first;
};

const identifiedSingleVoltage = (text: string): number | null => {
  if (alternativeVoltage.test(text) ||
    (([...text.matchAll(batteryPair)].length > 0 || [...text.matchAll(batteryNominal)].length > 0) &&
      identifiedBattery(text) === null)) return null;
  const matches = [...text.matchAll(singleBatteryVoltage)];
  if (matches.length === 0) return null;
  const values = [...text.matchAll(anyVoltage)].map((match) => Number((match[1] ?? "").replace(",", ".")));
  const first = values[0];
  return first !== undefined && Number.isFinite(first) && first >= 12 && first <= 500 &&
    values.every((value) => value === first) ? first : null;
};

export const recoverGamBatteryMeasures = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const keys = Object.keys(source);
  if (matchesIdentity(record, combinedBatteryCategories) && !keys.some((key) => batterySpec.test(key))) {
    const values = identifiedBattery(record.longDescription ?? "");
    if (values !== null) {
      const [voltage, capacity] = values;
      return {
        ...source,
        "Voltaje batería (V)": `${String(voltage).replace(".", ",")} V`,
        "Capacidad de la batería (Ah)": `${capacity} Ah`
      };
    }
  }
  if (!matchesIdentity(record, isolatedVoltageCategories) || keys.some((key) => voltageSpec.test(key)) ||
    (record.categoryKey === "carretillas-nuevas" && Object.values(source).some((value) =>
      voltageInExistingValue.test(String(value))))) return source;
  const voltage = identifiedSingleVoltage(record.longDescription ?? "");
  return voltage === null ? source : { ...source, "Voltaje batería (V)": `${String(voltage).replace(".", ",")} V` };
};
