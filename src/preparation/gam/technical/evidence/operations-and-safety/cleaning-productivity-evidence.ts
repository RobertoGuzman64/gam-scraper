import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "../measurements-and-capacities/measured-machine-specs.js";

const cleaningCategories = new Set(["limpieza-fregadoras", "limpieza-barredoras"]);
const squareMetresPerHour = /\b(\d{1,2}(?:\.\d{3}){1,2}|\d{3,5})\s*m(?:²|2)\s*(?:\/\s*h\b|por\s+hora\b)/giu;
const coverageContext = /\b(?:cobertura|productividad|rendimiento|capacidad\s+de\s+fregado|cubrir\s+hasta)\b/iu;
const existingCoverage = /\b(?:cobertura|productividad|rendimiento)\b/iu;
const modeSpecificCoverage = /\bmodo\s+(?:de\s+)?(?:barrido|fregado)\b/iu;
const alternativeWorkingWidths = /\b\d{3,4}\s*mm\s+o\s+\d{3,4}\s*mm\b/iu;
const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const hasOwnIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    !cleaningCategories.has(record.categoryKey) || !identifiedGamMachineModel(record)) return false;
  const brand = record.brand?.trim();
  if (!brand || typeof record.specs?.["Marca"] !== "string" ||
    normalize(brand) !== normalize(record.specs["Marca"]) ||
    !normalize(record.title ?? "").includes(normalize(brand)) ||
    !normalize(record.longDescription ?? "").includes(normalize(brand))) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(parts[2]).includes(normalize(record.model ?? ""));
  } catch {
    return false;
  }
};

const measuredCoverage = (description: string): number | null => {
  if (alternativeWorkingWidths.test(description)) return null;
  const measures = [...description.matchAll(squareMetresPerHour)];
  if (measures.length === 0 || measures.some((match) =>
    !coverageContext.test(description.slice(Math.max(0, match.index - 110), match.index)) ||
    modeSpecificCoverage.test(description.slice(Math.max(0, match.index - 60), match.index)))) return null;
  const values = measures.map((match) => Number((match[1] ?? "").replace(/\./g, "")));
  const first = values[0];
  return first !== undefined && Number.isInteger(first) && first >= 200 && first <= 30000 &&
    values.every((value) => value === first) ? first : null;
};

export const recoverGamCleaningProductivitySpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!hasOwnIdentity(record) || Object.keys(source).some((key) => existingCoverage.test(key))) return source;
  const value = measuredCoverage(record.longDescription ?? "");
  return value === null ? source : { ...source, "Rendimiento de limpieza (m²/h)": value };
};

const definiteWorkingWidth = [
  /\bfranja\s+de\s+limpieza\s+de\s+(\d{1,2}(?:\.\d{3})|\d{3,4})\s*mm\b/giu,
  /\btrayectoria\s+de\s+limpieza\s+total\s+de\s+(\d{1,2}(?:\.\d{3})|\d{3,4})\s*mm\b/giu,
  /\bancho\s+de\s+fregado\s+de\s+(\d{1,2}(?:\.\d{3})|\d{3,4})\s*mm\b/giu
] as const;

export const recoverGamCleaningWorkingWidthSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!hasOwnIdentity(record) || Object.keys(source).some((key) =>
    /\b(?:anchura|ancho)\s*(?:de\s+)?(?:trabajo|fregado|barrido)\b/iu.test(key))) return source;
  const description = record.longDescription ?? "";
  if (/\b(?:anchura|ancho|trayectoria|franja)\b[^.!?]{0,65}\b(?:mm\s+o\s+\d|mm\s+a\s+\d|versi[oó]n|opci[oó]n)\b/iu.test(description)) return source;
  const values = definiteWorkingWidth.flatMap((pattern) => [...description.matchAll(pattern)]
    .map((match) => Number((match[1] ?? "").replace(/\./g, ""))));
  const width = values[0];
  return width !== undefined && Number.isInteger(width) && width >= 300 && width <= 3000 &&
    values.every((value) => value === width) ? { ...source, "Anchura trabajo (mm)": width } : source;
};
