import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "./measured-machine-specs.js";

const batteryPair = /(\d{2,3}(?:[.,]\d{1,2})?)\s*V\s*(?:\/|y|,)\s*(\d{2,4})\s*Ah\b/giu;
const batteryNominal = /tensi[oó]n\s+nominal\s+(?:aproximada\s+)?de\s+(\d{2,3}(?:[.,]\d{1,2})?)\s*V\s+y\s+una\s+capacidad\s+de\s+(\d{2,4})\s*Ah\b/giu;
const batterySpec = /bater[ií]a|voltaje|tensi[oó]n|acumulador|capacidad\s*\(?ah\)?/iu;

const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const matchesIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !identifiedGamMachineModel(record) ||
    !["elevacion-nueva", "carretillas-nuevas", "apiladores-nuevos", "otros-nuevos", "limpieza-barredoras", "marcas-nuevas"].includes(record.categoryKey)) return false;
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

export const recoverGamBatteryMeasures = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!matchesIdentity(record) || Object.keys(source).some((key) => batterySpec.test(key))) return source;
  const values = identifiedBattery(record.longDescription ?? "");
  if (values === null) return source;
  const [voltage, capacity] = values;
  return {
    ...source,
    "Voltaje batería (V)": `${String(voltage).replace(".", ",")} V`,
    "Capacidad de la batería (Ah)": `${capacity} Ah`
  };
};
