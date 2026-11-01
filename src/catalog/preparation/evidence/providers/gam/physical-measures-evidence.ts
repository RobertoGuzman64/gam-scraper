import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "./measured-machine-specs.js";

const cleaningCategories = new Set(["limpieza-fregadoras", "limpieza-barredoras"]);
const length = /\blongitud\s+(?:total\s+)?de\s+(\d{1,2}(?:\.\d{3})|\d{3,4})\s*mm\b/giu;
const width = /\banchura\s+(?:total\s+)?(?:de\s+)?(?:apenas\s+)?(\d{1,2}(?:\.\d{3})|\d{3,4})\s*mm\b/giu;
const height = /\baltura\s+(?:total\s+)?de\s+(\d{1,2}(?:\.\d{3})|\d{3,4})\s*mm\b/giu;
const weight = /\bpeso\s+de\s+(\d{1,3}(?:[.,]\d{1,3})?)\s*kg\b/giu;
const alternativeMeasure = /^\s*(?:(?:a|o|u|hasta)\s+|[/–-]\s*)\d[\d.,]*\s*(?:mm|kg)\b|^\s*\([^)]*versi[oó]n/iu;
const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const verifiedIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !identifiedGamMachineModel(record)) return false;
  const brand = normalize(record.brand ?? "");
  if (!brand || !record.model || normalize(String(record.specs?.["Marca"] ?? "")) !== brand ||
    !normalize(record.title ?? "").includes(brand) || !normalize(record.longDescription ?? "").includes(brand)) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" && parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(parts[2]).includes(normalize(record.model));
  } catch {
    return false;
  }
};

const uniqueMillimetres = (text: string, pattern: RegExp): number | null => {
  const matches = [...text.matchAll(pattern)];
  if (matches.length === 0 || matches.some((match) =>
    alternativeMeasure.test(text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 55)))) return null;
  const values = matches.map((match) => Number((match[1] ?? "").replace(/\./g, "")));
  const value = values[0];
  return value !== undefined && Number.isInteger(value) && value >= 300 && value <= 15000 &&
    values.every((candidate) => candidate === value) ? value : null;
};

const uniqueKilograms = (text: string): number | null => {
  const matches = [...text.matchAll(weight)];
  if (matches.length === 0 || matches.some((match) => alternativeMeasure.test(text.slice(
    (match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 55)))) return null;
  const values = matches.map((match) => Number((match[1] ?? "").replace(",", ".")));
  const value = values[0];
  return value !== undefined && Number.isFinite(value) && value >= 5 && value <= 10000 &&
    values.every((candidate) => candidate === value) ? value : null;
};

const hasSpec = (specs: SpecsMap, name: string): boolean => Object.keys(specs)
  .some((key) => [normalize(name), `${normalize(name)}mm`, `${normalize(name)}total`, `${normalize(name)}totalmm`].includes(normalize(key)));

const identifiedLowDischargeSweeper = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    record.categoryKey !== "limpieza-barredoras" || record.brand !== "Tennant" ||
    record.specs?.["Marca"] !== record.brand || record.specs?.["Modelo"] !== record.model ||
    !/^BCS S16L Descarga baja$/iu.test(record.model ?? "") ||
    ![record.title, record.shortDescription, record.longDescription].every((text) =>
      /\bBCS\s+S16L\b/iu.test(text ?? "") && /descarga\s+baja/iu.test(text ?? "")) ||
    !/\bpeso\s+de\s+\d{2,4}\s*kg\s+en\s+su\s+versi[oó]n\s+de\s+descarga\s+baja\b/iu
      .test(record.longDescription ?? "")) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" && parts[1] === "barredoras-industriales-nuevas" &&
      parts[2] === `${record.reference}-bcs-s16l-descarga-baja`;
  } catch {
    return false;
  }
};

export const recoverGamPhysicalMeasures = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (identifiedLowDischargeSweeper(record) && !hasSpec(source, "Peso")) {
    const value = uniqueKilograms(record.longDescription ?? "");
    if (value !== null) return { ...source, Peso: `${String(value).replace(".", ",")} kg` };
  }
  if (!verifiedIdentity(record)) return source;
  const text = record.longDescription ?? "";
  let result: SpecsMap = source;
  if (cleaningCategories.has(record.categoryKey)) {
    for (const [key, pattern] of [["Longitud", length], ["Anchura", width], ["Altura", height]] as const) {
      if (hasSpec(result, key)) continue;
      const value = uniqueMillimetres(text, pattern);
      if (value !== null) result = { ...result, [key]: `${value} mm` };
    }
    if (!hasSpec(result, "Peso") && record.categoryKey === "limpieza-barredoras") {
      const value = uniqueKilograms(text);
      if (value !== null) result = { ...result, Peso: `${String(value).replace(".", ",")} kg` };
    }
  } else if (record.categoryKey === "elevacion-nueva" && !hasSpec(result, "Anchura") &&
    /\banchura\s+total\s+de\s+\d[\d.]*\s*mm\b/iu.test(text)) {
    const value = uniqueMillimetres(text, width);
    if (value !== null) result = { ...result, Anchura: `${value} mm` };
  } else if (["apiladores-nuevos", "otros-nuevos"].includes(record.categoryKey) && !hasSpec(result, "Anchura")) {
    const value = uniqueMillimetres(text, width);
    if (value !== null) result = { ...result, Anchura: `${value} mm` };
  } else if (record.categoryKey === "carretillas-nuevas" && !hasSpec(result, "Longitud")) {
    const value = uniqueMillimetres(text, /\blongitud\s+total\s+de\s+(\d{1,2}(?:\.\d{3})|\d{3,4})\s*mm\b/giu);
    if (value !== null) result = { ...result, Longitud: `${value} mm` };
  } else if (record.categoryKey === "marcas-nuevas" && !hasSpec(result, "Peso") &&
    /\baspirador(?:a|es)?\b/iu.test(text)) {
    const value = uniqueKilograms(text);
    if (value !== null) result = { ...result, Peso: `${String(value).replace(".", ",")} kg` };
  }
  return result;
};
