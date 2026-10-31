import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "./measured-machine-specs.js";

const turret = /\b(?:rotaci[oó]n|giro)\s+de\s+(?:la\s+)?(?:torreta|torre)\s*(?::|de)?\s*(?:de\s+)?(±\s*)?(\d{2,3})\s*[°º](?:\s*\+\s*(\d{2,3})\s*[°º])?/giu;
const width = /\banchura(?:\s+total)?\s+de\s+(?:apenas\s+)?(\d{3,4})\s*mm\b/giu;
const fuel = /\bdep[oó]sito\s+de\s+combustible\s+de\s+(\d{2,3})\s*(?:l|litros?)\b/giu;

const normalizedIdentity = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const hasExactIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !identifiedGamMachineModel(record)) return false;
  const brand = record.brand?.trim();
  if (!brand || typeof record.specs?.["Marca"] !== "string" ||
    normalizedIdentity(record.specs["Marca"]) !== normalizedIdentity(brand) ||
    !normalizedIdentity(record.longDescription ?? "").includes(normalizedIdentity(brand))) return false;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && path[0] === "es" &&
      path[2]?.startsWith(`${record.reference}-`) === true &&
      normalizedIdentity(path[2]).includes(normalizedIdentity(record.model ?? ""));
  } catch {
    return false;
  }
};

const uniqueNumber = (text: string, regex: RegExp, min: number, max: number): number | null => {
  const values = [...text.matchAll(regex)].map((match) => Number(match[1]));
  const value = values[0];
  return value !== undefined && Number.isInteger(value) && value >= min && value <= max &&
    values.every((candidate) => candidate === value) ? value : null;
};

const uniqueTurret = (text: string): string | null => {
  const values = [...text.matchAll(turret)].map((match) => {
    const angle = Number(match[2]);
    const second = match[3] === undefined ? null : Number(match[3]);
    if (!Number.isInteger(angle) || angle < 60 || angle > 720 ||
      (second !== null && (angle !== second || match[1]))) return null;
    return second === null ? `${match[1] ? "±" : ""}${angle}°` : `${angle}° + ${second}°`;
  });
  const first = values[0];
  return first !== undefined && first !== null && values.every((value) => value === first) ? first : null;
};

export const recoverGamVerifiedTechnicalSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!hasExactIdentity(record)) return source;

  const text = record.longDescription ?? "";
  let result: SpecsMap = source;
  if (record.categoryKey === "elevacion-nueva" &&
    !Object.keys(source).some((key) => /rotaci[oó]n|giro\s+de\s+torre/iu.test(key))) {
    const value = uniqueTurret(text);
    if (value !== null) result = { ...result, "Rotación de torreta": value };
  }
  if (["elevacion-nueva", "apiladores-nuevos", "otros-nuevos", "limpieza-barredoras"].includes(record.categoryKey) &&
    !Object.keys(source).some((key) => /\banchura\b|\bancho\b/iu.test(key))) {
    const value = uniqueNumber(text, width, 500, 3000);
    if (value !== null) result = { ...result, "Anchura (mm)": `${value} mm` };
  }
  if (["elevacion-nueva", "otros-nuevos"].includes(record.categoryKey) &&
    !Object.keys(source).some((key) => /dep[oó]sito\s+de\s+combustible|capacidad\s+de\s+combustible/iu.test(key))) {
    const value = uniqueNumber(text, fuel, 10, 1000);
    if (value !== null) result = { ...result, "Depósito de combustible": value };
  }
  return result;
};
