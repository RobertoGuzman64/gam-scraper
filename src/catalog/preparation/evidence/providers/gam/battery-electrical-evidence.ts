import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { normalizedElectricalIdentity, verifiedGamElectricalIdentity } from "./electrical-identity-evidence.js";

const energy = /\bbater[ií]a\b[^.!?]{0,90}?\bde\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*kWh\b/giu;
const everyEnergy = /\b(\d{1,3}(?:[.,]\d{1,2})?)\s*kWh\b/giu;
const craneSupply = /\balimentaci[oó]n\s*:\s*(\d{2,3})\s*voltios\s+(\d{2,4})\s*Ah\b/giu;
const batteryPair = /\b(\d{2,3}(?:[.,]\d{1,2})?)\s*V\s*\/\s*(\d{2,4})\s*Ah\b/giu;
const compactBattery = /\b(?:dos|2)\s+bater[ií]as\s+de\s+12\s*V\s+y\s+(\d{2,3})\s*Ah\b|\bbater[ií]as\s*:\s*2\s*[x×]\s*12\s*V\s*[–-]\s*(\d{2,3})\s*Ah\b/giu;
const allCapacities = /\b(\d{2,4})\s*Ah\b/giu;
const allVoltages = /\b(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:V|voltios)\b/giu;
const parse = (value: string): number => Number(value.replace(",", "."));
const formatted = (value: number, unit: string): string => `${String(value).replace(".", ",")} ${unit}`;
const isMissing = (specs: SpecsMap, pattern: RegExp): boolean => !Object.keys(specs).some((key) => pattern.test(key));
const unique = (text: string, pattern: RegExp, minimum: number, maximum: number): number | null => {
  const values = [...text.matchAll(pattern)].map((match) => parse(match[1] ?? ""));
  const first = values[0];
  return first !== undefined && Number.isFinite(first) && first >= minimum && first <= maximum &&
    values.every((value) => value === first) ? first : null;
};

export const recoverGamElectricalBatterySpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!verifiedGamElectricalIdentity(record)) return source;
  const description = record.longDescription ?? "";
  let result: SpecsMap = source;

  if (record.categoryKey === "carretillas-nuevas" && isMissing(result, /energ[ií]a\s+(?:de\s+)?bater[ií]a|kWh/iu) &&
    !/\bbater[ií]as?\s+(?:alternativas?|opcionales?)\b/iu.test(description)) {
    const value = unique(description, energy, 1, 300);
    const all = unique(description, everyEnergy, 1, 300);
    if (value !== null && value === all) result = { ...result, "Energía de batería (kWh)": formatted(value, "kWh") };
  }

  if (record.categoryKey === "otros-nuevos" && normalizedElectricalIdentity(record.brand ?? "") === "ormig" &&
    /\bgr[uú]a\s+el[eé]ctrica\b/iu.test(record.title ?? "")) {
    const matches = [...description.matchAll(craneSupply)];
    const first = matches[0];
    const voltage = first ? parse(first[1] ?? "") : null;
    const capacity = first ? Number(first[2]) : null;
    if (voltage !== null && capacity !== null && voltage >= 12 && voltage <= 500 &&
      capacity >= 20 && capacity <= 2000 &&
      matches.every((match) => parse(match[1] ?? "") === voltage && Number(match[2]) === capacity) &&
      unique(description, allVoltages, 12, 500) === voltage &&
      unique(description, allCapacities, 20, 2000) === capacity) {
      if (isMissing(result, /voltaje|tensi[oó]n/iu)) result = { ...result, "Voltaje batería (V)": formatted(voltage, "V") };
      if (isMissing(result, /capacidad\s+(?:de\s+la\s+)?bater[ií]a|\(Ah\)/iu)) {
        result = { ...result, "Capacidad de la batería (Ah)": formatted(capacity, "Ah") };
      }
    }
  }

  if (["limpieza-barredoras", "marcas-nuevas"].includes(record.categoryKey) &&
    isMissing(result, /capacidad\s+(?:de\s+la\s+)?bater[ií]a|\(Ah\)/iu)) {
    const matches = [...description.matchAll(compactBattery)];
    const value = matches[0] ? Number(matches[0][1] ?? matches[0][2]) : null;
    if (value !== null && value >= 20 && value <= 500 &&
      matches.every((match) => Number(match[1] ?? match[2]) === value) &&
      unique(description, allCapacities, 20, 500) === value) {
      result = { ...result, "Capacidad de la batería (Ah)": formatted(value, "Ah") };
    }
  }

  if (record.categoryKey === "carretillas-nuevas" &&
    isMissing(result, /voltaje|tensi[oó]n/iu) &&
    isMissing(result, /capacidad\s+(?:de\s+la\s+)?bater[ií]a|\(Ah\)/iu)) {
    const matches = [...description.matchAll(batteryPair)];
    const first = matches[0];
    const voltage = first ? parse(first[1] ?? "") : null;
    const capacity = first ? Number(first[2]) : null;
    if (voltage !== null && capacity !== null && voltage >= 24 && voltage <= 500 &&
      capacity >= 20 && capacity <= 2000 && matches.every((match) =>
        parse(match[1] ?? "") === voltage && Number(match[2]) === capacity) &&
      unique(description, allVoltages, 12, 500) === voltage &&
      unique(description, allCapacities, 20, 2000) === capacity &&
      matches.some((match) => /bater[ií]a/iu.test(description.slice(Math.max(0, (match.index ?? 0) - 100), match.index)))) {
      result = { ...result, "Voltaje batería (V)": formatted(voltage, "V"), "Capacidad de la batería (Ah)": formatted(capacity, "Ah") };
    }
  }

  return result;
};

const singleBatteryPair = /\b(\d{2,3}(?:[.,]\d{1,2})?)\s*V\s*\/\s*(\d{2,4})\s*Ah\b/giu;
const ampereHours = /\b(\d{2,4})\s*Ah\b/giu;
const eligibleBatteryCategories = new Set(["elevacion-nueva", "carretillas-nuevas", "apiladores-nuevos", "otros-nuevos", "marcas-nuevas"]);
const verifiedLithiumVariant = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || record.categoryKey !== "elevacion-nueva" ||
    normalizedElectricalIdentity(record.brand ?? "") !== "xcmg" ||
    normalizedElectricalIdentity(String(record.specs?.["Marca"] ?? "")) !== "xcmg" ||
    normalizedElectricalIdentity(String(record.specs?.["Modelo"] ?? "")) !== normalizedElectricalIdentity(record.model ?? "")) return false;
  const model = normalizedElectricalIdentity(record.model ?? "");
  if (!model.startsWith("xga") || !model.endsWith("li") || !/bater[ií]a\s+de\s+litio/iu.test(record.longDescription ?? "")) return false;
  const base = model.slice(0, -2);
  if (!normalizedElectricalIdentity(record.title ?? "").includes(base) ||
    !normalizedElectricalIdentity(record.longDescription ?? "").includes(base) ||
    !normalizedElectricalIdentity(record.longDescription ?? "").includes("xcmg")) return false;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash && path.length === 3 &&
      path[0] === "es" && path[2]?.startsWith(`${record.reference}-`) === true &&
      normalizedElectricalIdentity(path[2]).includes(model);
  } catch {
    return false;
  }
};
const alternativeBattery = /\b(?:opciones|alternativas|configuraciones|capacidades)\b[^.!?]{0,95}\bAh\b|\bhasta\s+\d{2,4}\s*Ah\b/iu;

export const recoverGamVerifiedBatteryPairSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!eligibleBatteryCategories.has(record.categoryKey) || !(verifiedGamElectricalIdentity(record) || verifiedLithiumVariant(record)) ||
    Object.keys(source).some((key) => /capacidad\s+(?:de\s+la\s+)?bater[ií]a|\(Ah\)/iu.test(key))) return source;
  const text = record.longDescription ?? "";
  if (alternativeBattery.test(text)) return source;
  const matches = [...text.matchAll(singleBatteryPair)];
  const first = matches[0];
  if (!first) {
    if (record.categoryKey !== "otros-nuevos" || normalizedElectricalIdentity(record.brand ?? "") !== "blyyd" ||
      !/pack de bater[ií]as de ion de litio/iu.test(text)) return source;
    const nominal = unique(text, /\bcapacidad nominal en Ah:\s*(\d{2,4})\s*Ah\b/giu, 20, 2000);
    if (nominal === null || unique(text, ampereHours, 20, 2000) !== nominal) return source;
    return { ...source, "Capacidad de la batería (Ah)": formatted(nominal, "Ah") };
  }
  if (!/bater[ií]a/iu.test(text.slice(Math.max(0, first.index - 130), first.index))) return source;
  const voltage = parse(first[1] ?? "");
  const capacity = Number(first[2]);
  if (!Number.isFinite(voltage) || voltage < 12 || voltage > 500 || !Number.isInteger(capacity) ||
    capacity < 20 || capacity > 2000 || matches.some((match) => parse(match[1] ?? "") !== voltage || Number(match[2]) !== capacity) ||
    unique(text, ampereHours, 20, 2000) !== capacity) return source;
  const observedVoltages = [...text.matchAll(allVoltages)].map((match) => parse(match[1] ?? ""));
  if (observedVoltages.some((value) => !Number.isFinite(value) || Math.abs(value - voltage) > 2)) return source;
  const type = normalizedElectricalIdentity(String(source["Tipo de batería"] ?? ""));
  if ((type.includes("plomo") && /bater[ií]as?\s+de\s+litio/iu.test(text)) ||
    (type.includes("litio") && /bater[ií]as?\s+de\s+plomo/iu.test(text))) return source;
  const existingVoltage = Object.entries(source).find(([key]) => /voltaje|tensi[oó]n/iu.test(key));
  if (existingVoltage !== undefined && parse(String(existingVoltage[1]).replace(/\s*V\s*$/iu, "")) !== voltage) return source;
  return {
    ...source,
    ...(existingVoltage === undefined && unique(text, allVoltages, 12, 500) === voltage ?
      { "Voltaje batería (V)": formatted(voltage, "V") } : {}),
    "Capacidad de la batería (Ah)": formatted(capacity, "Ah")
  };
};
