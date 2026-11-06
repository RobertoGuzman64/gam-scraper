import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "./measured-machine-specs.js";
import { verifiedGamSourceVariant } from "../../../identity/evidence/source-variant-identity.js";

const clearance = /\baltura\s+libre\s+al\s+suelo\s+de\s+(\d{2,3})\s*mm\b/giu;
const platform = /\baltura\s+(?:m[aá]xima\s+)?de\s+plataforma\s+de\s+(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:m|metros?)\b/giu;
const distinctPlatform = /\baltura\s+(?:m[aá]xima\s+)?de\s+(?:la\s+)?plataforma\s*(?:de\s+|es\s+de\s+|:\s*)(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:m|metros?)\b/giu;
const workHeight = /\baltura\s+(?:m[aá]xima\s+)?de\s+trabajo\s*(?:de\s+|:\s*)(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:m|metros?)\b/giu;
const normalized = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const verifiedIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !identifiedGamMachineModel(record)) return false;
  const brand = record.brand?.trim();
  if (!brand || typeof record.specs?.["Marca"] !== "string" ||
    normalized(brand) !== normalized(record.specs["Marca"]) ||
    !normalized(record.title ?? "").includes(normalized(brand)) ||
    !normalized(record.longDescription ?? "").includes(normalized(brand))) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && parts[0] === "es" &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalized(parts[2]).includes(normalized(record.model ?? ""));
  } catch {
    return false;
  }
};

const uniqueMeasure = (text: string, pattern: RegExp, minimum: number, maximum: number): number | null => {
  const values = [...text.matchAll(pattern)].map((match) => Number((match[1] ?? "").replace(",", ".")));
  const value = values[0];
  return value !== undefined && Number.isFinite(value) && value >= minimum && value <= maximum &&
    values.every((candidate) => candidate === value) ? value : null;
};

export const recoverGamClearanceAndPlatform = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const identity = verifiedIdentity(record);
  const text = record.longDescription ?? "";
  let result: SpecsMap = source;
  if (identity && record.categoryKey === "carretillas-nuevas" &&
    !Object.keys(source).some((key) => /altura\s+(?:libre\s+)?al\s+suelo|distancia\s+(?:libre\s+)?al\s+suelo|despeje\s+al\s+suelo/iu.test(key))) {
    const value = uniqueMeasure(text, clearance, 40, 400);
    if (value !== null && Number.isInteger(value)) result = { ...result, "Altura al suelo (mm)": `${value} mm` };
  }
  if (identity && record.categoryKey === "elevacion-nueva" && normalized(record.brand ?? "") === "xcmg" &&
    !Object.keys(source).some((key) => /altura\s+(?:de\s+)?plataforma/iu.test(key))) {
    const value = uniqueMeasure(text, platform, 2, 45);
    const elevation = source["Altura de elevación (m)"];
    const elevationMatch = typeof elevation === "string" ? elevation.match(/^(\d+(?:[.,]\d+)?)\s*(?:metros?|m)$/iu) : null;
    const height = elevationMatch?.[1] ? Number(elevationMatch[1].replace(",", ".")) : null;
    if (value !== null && height !== null && height > value && height - value <= 3) {
      result = { ...result, "Altura plataforma (m)": `${String(value).replace(".", ",")} m` };
    }
  }
  if (["elevacion", "elevacion-nueva", "marcas-nuevas"].includes(record.categoryKey) &&
    !Object.keys(result).some((key) => /altura\s+(?:de\s+)?(?:la\s+)?plataforma/iu.test(key)) &&
    verifiedGamSourceVariant(record)) {
    const eligible = (record.categoryKey === "elevacion" && normalized(record.brand ?? "") === "berghorticultura") ||
      (record.categoryKey === "marcas-nuevas" && normalized(record.brand ?? "") === "bravi") ||
      (record.categoryKey === "elevacion-nueva" && ["cte", "xcmg"].includes(normalized(record.brand ?? "")));
    if (eligible) {
      const value = uniqueMeasure(text, distinctPlatform, 1, 45);
      const existingWork = source["Altura de elevación (m)"];
      const existingMatch = typeof existingWork === "string" ? existingWork.match(/^(\d+(?:[.,]\d+)?)\s*(?:metros?|m)$/iu) : null;
      const height = existingMatch?.[1] ? Number(existingMatch[1].replace(",", ".")) :
        source["Altura de elevación (m)"] === undefined ? uniqueMeasure(text, workHeight, 2, 50) : null;
      if (value !== null && height !== null && height > value && height - value >= 1 && height - value <= 3) {
        result = { ...result, "Altura plataforma (m)": `${String(value).replace(".", ",")} m` };
      }
    }
  }
  return result;
};
